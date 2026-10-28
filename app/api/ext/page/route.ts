import { z } from "zod";
import { db, type ProductRow } from "@/lib/supabase";
import { applySnapshot } from "@/lib/pricing";
import { InstallId, PageSchema, cors, crowdAllowed, findProduct, identityFromPage, pageToProduct, rateOk } from "@/lib/ext";
import { providers, retailerLabel } from "@/lib/providers";
import { deliveryLabel } from "@/lib/delivery";
import { matchKey } from "@/lib/match";
import { sameProductOffers } from "@/lib/compare";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";

const Body = z.object({ page: PageSchema, installId: InstallId, contribute: z.boolean().default(false), locale: z.string().max(5).optional() });

const BIG_DROP = 0.25; // dalingen vanaf 25% moeten door een tweede gebruiker bevestigd worden
const shop = (p: ProductRow) => p.merchant || retailerLabel[p.retailer] || new URL(p.url).hostname.replace(/^www\./, "");
const pkey = (p: ProductRow) => `${p.retailer}-${p.country}-${p.external_id}`;

export async function OPTIONS() { return cors(new Response(null, { status: 204 })); }

/**
 * Extensie meldt een productpagina. Antwoord: wat we van het product weten en waar het goedkoper is.
 * Met contribute=true en een bekend product registreren we ook de prijs (met plausibiliteitscontrole).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return cors(Response.json({ error: "invalid" }, { status: 400 }));
  const { page, installId, contribute } = parsed.data;
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "en";
  if (!(await rateOk(installId, "page"))) return cors(Response.json({ error: "rate" }, { status: 429 }));

  const id = await identityFromPage(page);
  if (!id) return cors(Response.json({ known: false, trackable: false }));
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  let product = await findProduct(id);
  let observed: "applied" | "unconfirmed" | "skipped" = "skipped";

  if (product && contribute && crowdAllowed(id)) {
    const last = product.last_price !== null ? Number(product.last_price) : null;
    const sameCurrency = !page.currency || page.currency === product.currency;
    const plausible = last === null || (page.price > last * 0.3 && page.price < last * 3);
    const fresh = product.last_checked_at && Date.now() - +new Date(product.last_checked_at) < 60 * 60_000 && last === page.price;
    if (sameCurrency && plausible && !fresh) {
      const snap = pageToProduct(page, id);
      const bigDrop = last !== null && (last - page.price) / last >= BIG_DROP;
      let ok = !bigDrop;
      if (bigDrop) {
        const since = new Date(Date.now() - 48 * 3600_000).toISOString();
        const { data: others } = await db().from("price_history").select("price,install_id")
          .eq("product_id", product.id).eq("source", "ext-unconfirmed").gte("checked_at", since).neq("install_id", installId).limit(20);
        ok = (others ?? []).some((o) => Math.abs(Number(o.price) - page.price) / page.price <= 0.02);
      }
      if (ok) {
        await applySnapshot(product, snap, "ext", installId);
        observed = "applied";
        product = (await findProduct(id)) ?? product;
      } else {
        await db().from("price_history").insert({ product_id: product.id, price: page.price, source: "ext-unconfirmed", install_id: installId });
        observed = "unconfirmed";
      }
    }
  }

  // Zelfde product elders (EAN of productsleutel), zelfde valuta, op voorraad
  const ean = product?.ean ?? (page.ean && /^\d{13}$/.test(page.ean) ? page.ean : null);
  const mk = product?.match_key && !product.match_key.startsWith("-") ? product.match_key : matchKey(page.title);
  const currency = product?.currency ?? page.currency ?? null;
  const same = await sameProductOffers({ id: product?.id ?? "", ean, match_key: mk, currency: currency ?? "" }, 30);
  const myShop = product ? shop(product) : pageToProduct(page, id).merchant ?? "";
  const offers = same
    .filter((o) => !(o.retailer === id.retailer && o.external_id === id.externalId))
    .filter((o) => shop(o).toLowerCase() !== myShop.toLowerCase()) // andere winkels, niet dezelfde winkel
    .map((o) => ({ o, total: Number(o.last_price) + Number(o.shipping_cost ?? 0) }))
    .sort((a, b) => a.total - b.total || (a.o.delivery_max_days ?? 99) - (b.o.delivery_max_days ?? 99)) // bij gelijke prijs: snelste levering
    .filter((x, i, arr) => arr.findIndex((y) => shop(y.o).toLowerCase() === shop(x.o).toLowerCase()) === i) // per winkel de goedkoopste
    .slice(0, 3)
    .map(({ o, total }) => ({
      shop: shop(o), country: o.country, price: Number(o.last_price), total, currency: o.currency,
      delivery: deliveryLabel(o.delivery_min_days, o.delivery_max_days, locale) || null,
      link: `${base}/go/${pkey(o)}?src=ext`,
    }));

  if (!product) return cors(Response.json({ known: false, trackable: true, offers }));
  const history = providers[product.retailer].showHistory;
  return cors(Response.json({
    known: true, trackable: true, observed,
    key: pkey(product), title: product.title, currency: product.currency,
    price: product.last_price !== null ? Number(product.last_price) : null,
    lowest: history && product.lowest_price !== null ? Number(product.lowest_price) : null,
    highest: history && product.highest_price !== null ? Number(product.highest_price) : null,
    pageUrl: `${base}/${locale}/p/${pkey(product)}`,
    offers,
  }));
}

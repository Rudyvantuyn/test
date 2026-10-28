import { z } from "zod";
import { InstallId, PageSchema, cors, crowdAllowed, identityFromPage, pageToProduct, rateOk } from "@/lib/ext";
import { PendingSourceError, ProviderError, key as productKey, resolveInput, retailerLabel, type ResolvedProduct } from "@/lib/providers";
import { genericProvider } from "@/lib/providers/generic";
import { upsertProduct } from "@/lib/products";
import { createWatch, savePending } from "@/lib/watches";
import { isLocale, t } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  page: PageSchema, installId: InstallId, email: z.string().email().max(200), locale: z.string().max(5).optional(),
  targetPrice: z.number().positive().max(1_000_000).nullish(),
  maxDeliveryDays: z.number().int().min(0).max(60).nullish(),
  anyRetailer: z.boolean().default(true),
  conditionFilter: z.enum(["new", "used", "refurbished"]).nullish(),
});

const timeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export async function OPTIONS() { return cors(new Response(null, { status: 204 })); }

/** Extensie: "Volg deze prijs" op een productpagina. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return cors(Response.json({ error: "invalid" }, { status: 400 }));
  const b = parsed.data;
  const locale = b.locale && isLocale(b.locale) ? b.locale : "en";
  if (!(await rateOk(b.installId, "watch"))) return cors(Response.json({ error: "rate" }, { status: 429 }));
  const opts = { email: b.email, locale, targetPrice: b.targetPrice ?? null, maxDeliveryDays: b.maxDeliveryDays ?? null, anyRetailer: b.anyRetailer, conditionFilter: b.conditionFilter ?? null };

  const id = await identityFromPage(b.page);
  if (!id) return cors(Response.json({ error: t(locale).extNotProduct }, { status: 400 }));

  try {
    let r: ResolvedProduct;
    let source = "server";
    if (id.feedOffer || ((id.retailer === "bol" || id.retailer === "ebay" || id.retailer === "amazon") && !crowdAllowed(id))) {
      r = await resolveInput(id.url); // gekoppelde bron: server-data is leidend (of PendingSourceError)
    } else if (id.retailer === "generic") {
      try { r = await timeout(genericProvider.resolve(id.url, new URL(id.url)), 8000); } // eerst zelf controleren
      catch { r = pageToProduct(b.page, id); source = "ext"; }                          // winkel blokkeert: paginadata
    } else {
      r = pageToProduct(b.page, id); source = "ext";
    }
    const productId = await upsertProduct(r, source);
    const watchId = await createWatch(productId, r.ean, opts);
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    return cors(Response.json({ ok: true, key: productKey(r), watchId, title: r.title, pageUrl: `${base}/${locale}/p/${productKey(r)}` }));
  } catch (e) {
    if (e instanceof PendingSourceError) {
      await savePending(e, opts);
      return cors(Response.json({ ok: true, pending: true, message: t(locale).pending(retailerLabel[e.retailer] || e.retailer) }, { status: 202 }));
    }
    const status = e instanceof ProviderError && e.status >= 400 && e.status < 500 ? e.status : 502;
    return cors(Response.json({ error: e instanceof Error ? e.message : "error" }, { status }));
  }
}

/**
 * Generieke provider: leest schema.org Product / OpenGraph-prijsdata van elke webshop
 * (Coolblue, MediaMarkt, Zalando, Otto, Fnac, Currys, ...). Laag volume: 1 verzoek per
 * product per cron-run. Affiliate-links via AFFILIATE_LINK_TEMPLATES (Awin, Tradedoubler, ...).
 */
import { createHash } from "node:crypto";
import { countryFromHost, currencyForCountry, type PriceProvider, type ProductRef, type ResolvedProduct, ProviderError } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 12_000;

type Parsed = { title: string | null; price: number | null; currency: string | null; image: string | null; canonical: string | null };

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf("."))
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function walk(node: unknown, visit: (o: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Record<string, unknown>);
    for (const v of Object.values(node as Record<string, unknown>)) walk(v, visit);
  }
}

function meta(html: string, attr: "property" | "name" | "itemprop", key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c) : null;
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function parseProductHtml(html: string): Parsed {
  const out: Parsed = { title: null, price: null, currency: null, image: null, canonical: null };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    walk(data, (o) => {
      const t = o["@type"];
      const types = Array.isArray(t) ? t : [t];
      if (!types.some((x) => typeof x === "string" && /product/i.test(x))) return;
      if (out.price !== null) return;
      out.title ??= typeof o.name === "string" ? o.name : null;
      const img = o.image;
      out.image ??= typeof img === "string" ? img : Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : (img[0] as { url?: string })?.url ?? null) : (img as { url?: string })?.url ?? null;
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      if (offers && typeof offers === "object") {
        const of = offers as Record<string, unknown>;
        const nested = Array.isArray(of.offers) ? (of.offers[0] as Record<string, unknown>) : null;
        out.price = toNumber(of.price ?? of.lowPrice ?? nested?.price ?? (of.priceSpecification as { price?: unknown })?.price);
        out.currency = (of.priceCurrency ?? nested?.priceCurrency ?? null) as string | null;
      }
    });
  }
  out.title ??= meta(html, "property", "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  out.price ??= toNumber(meta(html, "property", "product:price:amount") ?? meta(html, "property", "og:price:amount") ?? meta(html, "itemprop", "price"));
  out.currency ??= meta(html, "property", "product:price:currency") ?? meta(html, "property", "og:price:currency") ?? meta(html, "itemprop", "priceCurrency");
  out.image ??= meta(html, "property", "og:image");
  out.canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? meta(html, "property", "og:url");
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en,nl;q=0.8,de;q=0.7" },
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (res.status === 404 || res.status === 410) throw new ProviderError(404, "Pagina niet gevonden");
    if (res.status === 403 || res.status === 429) throw new ProviderError(429, "Winkel blokkeert verzoeken");
    if (!res.ok) throw new ProviderError(res.status, `Winkel gaf ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const cleanUrl = (u: URL) => {
  const c = new URL(u.toString());
  for (const k of [...c.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|tag|aff)/i.test(k)) c.searchParams.delete(k);
  c.hash = "";
  return c.toString();
};

export const genericProvider: PriceProvider = {
  id: "generic",
  showHistory: true,
  batchLimit: 300,
  matches: () => true,

  async resolve(_input, url) {
    if (!url) throw new ProviderError(400, "Plak een productlink van een webshop");
    const html = await fetchHtml(url.toString());
    const p = parseProductHtml(html);
    if (!p.title || p.price === null) {
      throw new ProviderError(422, "Kon geen prijs vinden op deze pagina. Deze winkel wordt (nog) niet ondersteund.");
    }
    const canonical = cleanUrl(p.canonical ? new URL(p.canonical, url) : url);
    const country = countryFromHost(new URL(canonical).hostname);
    return {
      retailer: "generic", country,
      externalId: createHash("sha256").update(canonical).digest("hex").slice(0, 20),
      ean: null, title: p.title.slice(0, 300), url: canonical, imageUrl: p.image,
      currency: (p.currency ?? currencyForCountry[country] ?? "EUR").toUpperCase(), price: p.price,
    };
  },

  async fetchPrices(items) {
    const out = new Map<string, number | null>();
    const CONCURRENCY = 3;
    let i = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (i < items.length) {
          const it = items[i++];
          try {
            out.set(it.externalId, parseProductHtml(await fetchHtml(it.url)).price);
          } catch (e) {
            if (e instanceof ProviderError && e.status === 404) out.set(it.externalId, null);
            else console.error("generic fetch", it.url, e instanceof Error ? e.message : e);
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }),
    );
    return out;
  },

  affiliateLink(ref) {
    let templates: Record<string, string> = {};
    try { templates = JSON.parse(process.env.AFFILIATE_LINK_TEMPLATES ?? "{}"); } catch { /* ignore */ }
    const host = new URL(ref.url).hostname.replace(/^www\./, "");
    const tpl = templates[host] ?? Object.entries(templates).find(([d]) => host.endsWith(`.${d}`))?.[1];
    if (!tpl) return ref.url;
    return tpl.replace("{url_enc}", encodeURIComponent(ref.url)).replace("{url}", ref.url);
  },
};

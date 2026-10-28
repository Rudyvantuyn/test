/**
 * Generieke provider: leest schema.org Product / OpenGraph-data (prijs, voorraad, levertijd,
 * verzendkosten) van elke webshop. Laag volume: 1 verzoek per product per cron-run.
 * Affiliate: per-domein template (AFFILIATE_LINK_TEMPLATES) of catch-all (GENERIC_AFFILIATE_REDIRECT,
 * bv. Skimlinks/Sovrn die ~50.000 winkels automatisch monetariseren).
 */
import { createHash } from "node:crypto";
import { normalizeCondition, parseDeliveryText } from "../delivery";
import { retailerForHost } from "../retailers";
import { countryFromHost, currencyForCountry, type OfferSnapshot, type PriceProvider, ProviderError } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 12_000;

export type Parsed = {
  title: string | null; price: number | null; currency: string | null; image: string | null; canonical: string | null;
  ean: string | null; inStock: boolean | null; condition: string | null; shippingCost: number | null;
  deliveryMin: number | null; deliveryMax: number | null; deliveryText: string | null; brand: string | null;
  listPrice: number | null; promoUntil: string | null;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf("."))
    ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
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

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function meta(html: string, attr: "property" | "name" | "itemprop", key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const c = html.match(re)?.[0]?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c) : null;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : null);
const QV = (v: unknown): number | null => (v && typeof v === "object" ? toNumber((v as Record<string, unknown>).value ?? (v as Record<string, unknown>).maxValue) : toNumber(v));

/** Geeft het JSON-object terug waarin positie `at` staat (tekst tussen de omsluitende accolades). */
function enclosingObject(s: string, at: number, maxLen = 3000): string | null {
  let depth = 0, start = -1;
  for (let i = at; i >= Math.max(0, at - maxLen); i--) {
    const c = s[i];
    if (c === "}") depth++;
    else if (c === "{") { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < Math.min(s.length, start + maxLen); i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

/**
 * Zoekt een "van"-prijs in ingesloten JSON (Next.js/React-data van winkels zoals Coolblue).
 * Telt alleen als in hetzelfde object ook de huidige verkoopprijs staat, zodat prijzen van
 * andere producten op de pagina niet worden meegenomen.
 */
export function embeddedListPrice(html: string, price: number): number | null {
  const s = html.replace(/\\"/g, '"');
  const num = price.toFixed(2).replace(/\.?0+$/, "").replace(".", "\\.");
  const saleRe = new RegExp(`"(?:salesPrice|salePrice|currentPrice|sellingPrice|finalPrice|offerPrice|price)"\\s*:\\s*(?:\\{[^{}]{0,80}?"(?:includingVat|amount|value|price|gross)"\\s*:\\s*)?"?${num}(?:\\.0+)?(?![\\d.])`);
  const re = /"(?:listPrice|strikethroughPrice|strikeThroughPrice|wasPrice|oldPrice|originalPrice|previousPrice|regularPrice|rrp|msrp|recommendedRetailPrice)"\s*:\s*(?:\{[^{}]{0,80}?"(?:includingVat|amount|value|price|gross)"\s*:\s*)?"?(\d+(?:[.,]\d{1,2})?)/gi;
  const counts = new Map<number, number>();
  for (const m of s.matchAll(re)) {
    const lp = toNumber(m[1]);
    if (lp === null || !(lp > price * 1.02 && lp < price * 5)) continue;
    const obj = enclosingObject(s, m.index ?? 0);
    if (!obj || !saleRe.test(obj)) continue;
    counts.set(lp, (counts.get(lp) ?? 0) + 1);
  }
  let best: number | null = null, n = 0;
  for (const [lp, c] of counts) if (c > n) { best = lp; n = c; }
  return best;
}

export function parseProductHtml(html: string): Parsed {
  const out: Parsed = {
    title: null, price: null, currency: null, image: null, canonical: null, ean: null, inStock: null,
    condition: null, shippingCost: null, deliveryMin: null, deliveryMax: null, deliveryText: null, brand: null,
    listPrice: null, promoUntil: null,
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    walk(data, (o) => {
      const types = Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]];
      if (!types.some((x) => typeof x === "string" && /product/i.test(x)) || out.price !== null) return;
      out.title ??= str(o.name);
      out.brand ??= str(o.brand) ?? str((o.brand as { name?: unknown })?.name);
      const img = o.image;
      out.image ??= str(img) ?? (Array.isArray(img) ? (img[0] as { url?: string })?.url ?? null : (img as { url?: string })?.url ?? null);
      out.ean ??= [o.gtin13, o.gtin, o.gtin14, o.ean].map(str).find((x) => x && /^\d{13}$/.test(x)) ?? null;
      const offersRaw = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      if (!offersRaw || typeof offersRaw !== "object") return;
      let of = offersRaw as Record<string, unknown>;
      if (Array.isArray(of.offers) && of.offers[0]) of = { ...of, ...(of.offers[0] as Record<string, unknown>) };
      const specs = (Array.isArray(of.priceSpecification) ? of.priceSpecification : of.priceSpecification ? [of.priceSpecification] : []) as Record<string, unknown>[];
      const saleSpec = specs.find((x) => !/ListPrice|Strikethrough|MSRP|SRP/i.test(String(x.priceType ?? "")));
      const listSpec = specs.find((x) => /ListPrice|Strikethrough|MSRP|SRP/i.test(String(x.priceType ?? "")));
      out.price = toNumber(of.price ?? of.lowPrice ?? saleSpec?.price);
      out.listPrice = toNumber(listSpec?.price);
      out.promoUntil = str(of.priceValidUntil)?.slice(0, 10) ?? null;
      out.currency = str(of.priceCurrency) ?? str((of.priceSpecification as { priceCurrency?: unknown })?.priceCurrency);
      const av = str(of.availability);
      if (av) out.inStock = /InStock|LimitedAvailability|OnlineOnly|PreSale|InStoreOnly/i.test(av);
      out.condition = str(of.itemCondition)?.replace(/^.*\//, "") ?? null;
      const sd = Array.isArray(of.shippingDetails) ? of.shippingDetails[0] : of.shippingDetails;
      if (sd && typeof sd === "object") {
        const s = sd as Record<string, unknown>;
        out.shippingCost = QV(s.shippingRate);
        const dt = s.deliveryTime as Record<string, unknown> | undefined;
        if (dt) {
          const h = (dt.handlingTime ?? {}) as Record<string, unknown>, tr = (dt.transitTime ?? {}) as Record<string, unknown>;
          const min = (toNumber(h.minValue) ?? 0) + (toNumber(tr.minValue) ?? 0);
          const max = (toNumber(h.maxValue) ?? toNumber(h.minValue) ?? 0) + (toNumber(tr.maxValue) ?? toNumber(tr.minValue) ?? 0);
          if (max > 0) { out.deliveryMin = min; out.deliveryMax = max; }
        }
      }
    });
  }
  out.title ??= meta(html, "property", "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  out.price ??= toNumber(meta(html, "property", "product:price:amount") ?? meta(html, "property", "og:price:amount") ?? meta(html, "itemprop", "price"));
  out.currency ??= meta(html, "property", "product:price:currency") ?? meta(html, "property", "og:price:currency") ?? meta(html, "itemprop", "priceCurrency");
  out.image ??= meta(html, "property", "og:image");
  out.canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? meta(html, "property", "og:url");
  const avail = meta(html, "property", "product:availability") ?? meta(html, "property", "og:availability");
  if (out.inStock === null && avail) out.inStock = /instock|in stock|available/i.test(avail);
  out.condition ??= meta(html, "property", "product:condition");
  if (out.price !== null) {
    out.listPrice ??= toNumber(meta(html, "property", "product:original_price:amount") ?? meta(html, "property", "og:price:standard_amount"));
    out.listPrice ??= embeddedListPrice(html, out.price);
    if (out.listPrice !== null && !(out.listPrice > out.price * 1.02 && out.listPrice < out.price * 5)) out.listPrice = null;
  }
  if (out.listPrice === null) out.promoUntil = null;
  // levertijd-tekst uit zichtbare tekst (bv. "Morgen in huis", "Lieferung in 1-2 Werktagen"); niet bij uitverkocht
  if (out.deliveryMax === null && out.inStock !== false) {
    const txt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const m = txt.match(/(morgen in huis|vandaag (?:nog )?besteld,? morgen (?:in huis|bezorgd)|lieferung (?:in|innerhalb) [^.<]{1,30}(?:werktag|tag)\w*|(?:bezorgd|geleverd) (?:binnen|in) \d+(?:\s*[-–]\s*\d+)? (?:werk)?dag\w*|(?:delivery|delivered) (?:in|within) \d+(?:\s*[-–]\s*\d+)? (?:business |working )?days?|next[- ]day delivery|livraison (?:sous|en) \d+(?:\s*[-–]\s*\d+)? jours?)/i);
    if (m) { out.deliveryText = m[1]; const d = parseDeliveryText(m[1]); out.deliveryMin = d.min; out.deliveryMax = d.max; }
  }
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en,nl;q=0.8,de;q=0.7" },
      signal: ctrl.signal, cache: "no-store", redirect: "follow",
    });
    if (res.status === 404 || res.status === 410) throw new ProviderError(404, "Pagina niet gevonden");
    if (res.status === 403 || res.status === 429 || res.status === 503) throw new ProviderError(429, "Winkel blokkeert verzoeken");
    if (!res.ok) throw new ProviderError(res.status, `Winkel gaf ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

export const cleanUrl = (u: URL) => {
  const c = new URL(u.toString());
  for (const k of [...c.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|tag|aff|awc|tduid)/i.test(k)) c.searchParams.delete(k);
  c.hash = "";
  return c.toString();
};

function toSnapshot(p: Parsed, host: string): OfferSnapshot {
  return {
    price: p.price!, shippingCost: p.shippingCost, deliveryMinDays: p.deliveryMin, deliveryMaxDays: p.deliveryMax,
    deliveryText: p.deliveryText, condition: normalizeCondition(p.condition) ?? "new", inStock: p.inStock ?? true,
    merchant: retailerForHost(host)?.name ?? host.replace(/^www\./, ""),
    listPrice: p.listPrice, promoUntil: p.promoUntil,
  };
}

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
      const known = retailerForHost(url.hostname);
      throw new ProviderError(422, known
        ? `${known.name} levert geen productdata aan onze robot. Deze winkel wordt via het ${known.network}-netwerk gekoppeld; probeer het later opnieuw.`
        : "Kon geen prijs vinden op deze pagina. Deze winkel wordt (nog) niet ondersteund.");
    }
    const canonical = cleanUrl(p.canonical ? new URL(p.canonical, url) : url);
    const host = new URL(canonical).hostname;
    const country = countryFromHost(host);
    return {
      retailer: "generic", country,
      externalId: createHash("sha256").update(canonical).digest("hex").slice(0, 20),
      ean: p.ean, title: p.title.slice(0, 300), url: canonical, imageUrl: p.image,
      currency: (p.currency ?? currencyForCountry[country] ?? "EUR").toUpperCase(),
      ...toSnapshot(p, host),
    };
  },

  async fetchOffers(items) {
    const out = new Map<string, OfferSnapshot | null>();
    let i = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (i < items.length) {
        const it = items[i++];
        try {
          const p = parseProductHtml(await fetchHtml(it.url));
          out.set(it.externalId, p.price === null ? null : toSnapshot(p, new URL(it.url).hostname));
        } catch (e) {
          if (e instanceof ProviderError && e.status === 404) out.set(it.externalId, null);
          else console.error("generic fetch", it.url, e instanceof Error ? e.message : e);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }));
    return out;
  },

  affiliateLink(ref) {
    let templates: Record<string, string> = {};
    try { templates = JSON.parse(process.env.AFFILIATE_LINK_TEMPLATES ?? "{}"); } catch { /* ignore */ }
    const host = new URL(ref.url).hostname.replace(/^www\./, "");
    const tpl = templates[host] ?? Object.entries(templates).find(([d]) => host.endsWith(`.${d}`))?.[1] ?? process.env.GENERIC_AFFILIATE_REDIRECT;
    if (!tpl) return ref.url;
    return tpl.replace("{url_enc}", encodeURIComponent(ref.url)).replace("{url}", ref.url);
  },
};

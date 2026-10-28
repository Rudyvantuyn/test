/**
 * Feed-provider: prijzen, levertijd en verzendkosten uit productfeeds van affiliate-netwerken.
 * Geladen door /api/cron/feeds in `feed_offers`; deze provider leest alleen uit de database.
 */
import { createHash } from "node:crypto";
import { db } from "../supabase";
import { normalizeCondition } from "../delivery";
import type { OfferSnapshot, PriceProvider, ResolvedProduct } from "./types";

export const urlHash = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 20);

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|tag|aff|awc|tduid|cid|pid|sid)/i.test(k)) u.searchParams.delete(k);
  return u.toString().replace(/\/+$/, "").replace(/^https?:\/\//, "");
}

export type FeedOffer = {
  id: number; source_id: number; url_hash: string; merchant_product_id: string; ean: string | null; title: string;
  url: string; deeplink: string; price: number; currency: string; image_url: string | null; shipping_cost: number | null;
  delivery_text: string | null; delivery_min_days: number | null; delivery_max_days: number | null; condition: string | null;
  in_stock: boolean; merchant: string | null; updated_at: string; list_price: number | null;
  feed_sources: { country: string; merchant: string } | { country: string; merchant: string }[];
};

const COLS = "id,source_id,url_hash,merchant_product_id,ean,title,url,deeplink,price,currency,image_url,shipping_cost,delivery_text,delivery_min_days,delivery_max_days,condition,in_stock,merchant,updated_at,list_price,feed_sources!inner(country,merchant)";
const src = (o: FeedOffer) => (Array.isArray(o.feed_sources) ? o.feed_sources[0] : o.feed_sources);

export async function findFeedOffer(url: URL): Promise<FeedOffer | null> {
  const { data } = await db().from("feed_offers").select(COLS).eq("url_hash", urlHash(normalizeUrl(url.toString()))).limit(1).maybeSingle();
  return (data as unknown as FeedOffer) ?? null;
}

export async function findFeedOffersByEan(ean: string, countries: string[]): Promise<FeedOffer[]> {
  let q = db().from("feed_offers").select(COLS).eq("ean", ean).eq("in_stock", true).limit(50);
  if (countries.length) q = q.in("feed_sources.country", countries);
  const { data } = await q;
  return ((data ?? []) as unknown as FeedOffer[]);
}

export function snapshot(o: FeedOffer): OfferSnapshot {
  const stale = Date.now() - +new Date(o.updated_at) > 3 * 86_400_000;
  return {
    price: Number(o.price), shippingCost: o.shipping_cost === null ? null : Number(o.shipping_cost),
    deliveryMinDays: o.delivery_min_days, deliveryMaxDays: o.delivery_max_days, deliveryText: o.delivery_text,
    condition: normalizeCondition(o.condition) ?? "new", inStock: o.in_stock && !stale, deeplink: o.deeplink,
    merchant: o.merchant ?? src(o).merchant,
    listPrice: o.list_price === null ? null : Number(o.list_price),
  };
}

export function offerToProduct(o: FeedOffer): ResolvedProduct {
  return {
    retailer: "feed", country: src(o).country, externalId: o.url_hash, ean: o.ean, title: o.title,
    url: o.url, imageUrl: o.image_url, currency: o.currency, ...snapshot(o),
  };
}

export const feedProvider: PriceProvider = {
  id: "feed",
  showHistory: true,
  batchLimit: 5000,
  matches: () => false, // wordt expliciet via findFeedOffer gebruikt

  async resolve(_input, url) {
    if (!url) throw new Error("Link vereist");
    const o = await findFeedOffer(url);
    if (!o) throw new Error("Niet in feed");
    return offerToProduct(o);
  },

  async fetchOffers(items) {
    const out = new Map<string, OfferSnapshot | null>();
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500).map((x) => x.externalId);
      const { data, error } = await db().from("feed_offers").select(COLS).in("url_hash", chunk);
      if (error) { console.error("feed fetch", error); continue; }
      const seen = new Set<string>();
      for (const r of (data ?? []) as unknown as FeedOffer[]) { seen.add(r.url_hash); out.set(r.url_hash, snapshot(r)); }
      for (const h of chunk) if (!seen.has(h)) out.set(h, null);
    }
    return out;
  },

  async findByEan(ean, countries) {
    return (await findFeedOffersByEan(ean, countries)).map(offerToProduct);
  },

  affiliateLink(ref) { return ref.url; },
};

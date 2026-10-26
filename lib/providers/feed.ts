/**
 * Feed-provider: prijzen uit productfeeds van affiliate-netwerken (Awin, Tradedoubler, Daisycon,
 * Partnerize, CJ). Dit is de schaalbare, toegestane route voor winkels die bots blokkeren
 * (MediaMarkt, Currys, Fnac, Otto, ...). De feeds worden door /api/cron/feeds in `feed_offers`
 * geladen; deze provider leest alleen uit de database en doet geen HTTP-verzoeken.
 */
import { createHash } from "node:crypto";
import { db } from "../supabase";
import type { PriceProvider, ResolvedProduct } from "./types";

export const urlHash = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 20);

/** Normaliseert een productlink zodat feed-URL en gebruikers-URL overeenkomen. */
export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|tag|aff|awc|tduid|cid|pid|sid)/i.test(k)) u.searchParams.delete(k);
  let s = u.toString().replace(/\/+$/, "");
  s = s.replace(/^https?:\/\//, "");
  return s;
}

export type FeedOffer = {
  id: number;
  source_id: number;
  url_hash: string;
  merchant_product_id: string;
  ean: string | null;
  title: string;
  url: string;
  deeplink: string;
  price: number;
  currency: string;
  image_url: string | null;
  country: string;
};

export async function findFeedOffer(url: URL): Promise<FeedOffer | null> {
  const hash = urlHash(normalizeUrl(url.toString()));
  const { data } = await db()
    .from("feed_offers")
    .select("id,source_id,url_hash,merchant_product_id,ean,title,url,deeplink,price,currency,image_url,feed_sources!inner(country)")
    .eq("url_hash", hash)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const src = data.feed_sources as unknown as { country: string } | { country: string }[];
  return { ...(data as unknown as Omit<FeedOffer, "country">), country: Array.isArray(src) ? src[0].country : src.country };
}

export function offerToProduct(o: FeedOffer): ResolvedProduct {
  return {
    retailer: "feed", country: o.country, externalId: o.url_hash, ean: o.ean, title: o.title,
    url: o.url, imageUrl: o.image_url, currency: o.currency, price: Number(o.price),
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

  async fetchPrices(items) {
    const out = new Map<string, number | null>();
    const supa = db();
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500).map((x) => x.externalId);
      const { data, error } = await supa.from("feed_offers").select("url_hash,price,updated_at").in("url_hash", chunk);
      if (error) { console.error("feed fetch", error); continue; }
      const seen = new Set<string>();
      for (const r of data ?? []) {
        seen.add(r.url_hash);
        // Verouderde feedrij (> 3 dagen niet ververst) = aanbod waarschijnlijk weg
        const stale = Date.now() - +new Date(r.updated_at) > 3 * 86_400_000;
        out.set(r.url_hash, stale ? null : Number(r.price));
      }
      for (const h of chunk) if (!seen.has(h)) out.set(h, null);
    }
    return out;
  },

  affiliateLink(ref) {
    // Deeplink staat in feed_offers; /go haalt die op via feedDeeplink(). Fallback: ruwe URL.
    return ref.url;
  },
};

export async function feedDeeplink(urlHashKey: string): Promise<string | null> {
  const { data } = await db().from("feed_offers").select("deeplink").eq("url_hash", urlHashKey).maybeSingle();
  return data?.deeplink ?? null;
}

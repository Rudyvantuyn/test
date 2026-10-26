/**
 * eBay Browse API + eBay Partner Network (EPN). Alle eBay-sites.
 * App-keys zijn gratis (developer.ebay.com); de EPN campaign-id in de X-EBAY-C-ENDUSERCTX header
 * zorgt dat `itemAffiliateWebUrl` in het antwoord je tracking-link is. Limiet: 5000 calls/dag (basis).
 */
import { daysUntil, normalizeCondition } from "../delivery";
import { type OfferSnapshot, type PriceProvider, type ResolvedProduct, ProviderError } from "./types";

export const EBAY_MARKETS: Record<string, { host: string; id: string; currency: string }> = {
  US: { host: "ebay.com", id: "EBAY_US", currency: "USD" },
  GB: { host: "ebay.co.uk", id: "EBAY_GB", currency: "GBP" },
  DE: { host: "ebay.de", id: "EBAY_DE", currency: "EUR" },
  NL: { host: "ebay.nl", id: "EBAY_NL", currency: "EUR" },
  BE: { host: "ebay.be", id: "EBAY_BE", currency: "EUR" },
  FR: { host: "ebay.fr", id: "EBAY_FR", currency: "EUR" },
  IT: { host: "ebay.it", id: "EBAY_IT", currency: "EUR" },
  ES: { host: "ebay.es", id: "EBAY_ES", currency: "EUR" },
  AT: { host: "ebay.at", id: "EBAY_AT", currency: "EUR" },
  CH: { host: "ebay.ch", id: "EBAY_CH", currency: "CHF" },
  IE: { host: "ebay.ie", id: "EBAY_IE", currency: "EUR" },
  PL: { host: "ebay.pl", id: "EBAY_PL", currency: "PLN" },
  CA: { host: "ebay.ca", id: "EBAY_CA", currency: "CAD" },
  AU: { host: "ebay.com.au", id: "EBAY_AU", currency: "AUD" },
  HK: { host: "ebay.com.hk", id: "EBAY_HK", currency: "HKD" },
  SG: { host: "ebay.com.sg", id: "EBAY_SG", currency: "SGD" },
  MY: { host: "ebay.com.my", id: "EBAY_MY", currency: "MYR" },
  PH: { host: "ebay.ph", id: "EBAY_PH", currency: "PHP" },
};
const hostToCountry = Object.fromEntries(Object.entries(EBAY_MARKETS).map(([cc, m]) => [m.host, cc]));

export const ebayCountryFromHost = (host: string) => hostToCountry[host.toLowerCase().replace(/^(www|m)\./, "")] ?? null;
export const ebayConfigured = () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

let token: { value: string; expiresAt: number } | null = null;
async function getToken() {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new ProviderError(503, "eBay API niet geconfigureerd");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    cache: "no-store",
  });
  if (!res.ok) throw new ProviderError(res.status, `eBay token mislukt: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return token.value;
}

type EbayItem = {
  itemId: string; legacyItemId?: string; title: string; itemWebUrl: string; itemAffiliateWebUrl?: string;
  price?: { value: string; currency: string }; condition?: string; gtin?: string;
  image?: { imageUrl: string };
  shippingOptions?: { shippingCost?: { value: string; currency: string }; minEstimatedDeliveryDate?: string; maxEstimatedDeliveryDate?: string }[];
  estimatedAvailabilities?: { estimatedAvailabilityStatus?: string }[];
  seller?: { username?: string };
};

async function ebayGet(path: string, country: string): Promise<EbayItem> {
  const m = EBAY_MARKETS[country];
  const campid = process.env.EBAY_CAMPAIGN_ID;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getToken()}`, Accept: "application/json", "X-EBAY-C-MARKETPLACE-ID": m.id,
  };
  if (campid) headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${campid},affiliateReferenceId=pricedrop`;
  const res = await fetch(`https://api.ebay.com/buy/browse/v1${path}`, { headers, cache: "no-store" });
  if (res.status === 404) throw new ProviderError(404, "Item niet gevonden bij eBay");
  if (res.status === 429) throw new ProviderError(429, "eBay rate limit");
  if (!res.ok) throw new ProviderError(res.status, `eBay API fout ${res.status}`);
  return (await res.json()) as EbayItem;
}

function snapshot(i: EbayItem): OfferSnapshot | null {
  if (!i.price) return null;
  const ship = i.shippingOptions?.[0];
  const status = i.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus;
  return {
    price: Number(i.price.value),
    shippingCost: ship?.shippingCost ? Number(ship.shippingCost.value) : null,
    deliveryMinDays: daysUntil(ship?.minEstimatedDeliveryDate?.slice(0, 10)),
    deliveryMaxDays: daysUntil(ship?.maxEstimatedDeliveryDate?.slice(0, 10)),
    deliveryText: null,
    condition: normalizeCondition(i.condition),
    inStock: !status || status === "IN_STOCK" || status === "LIMITED_STOCK",
    deeplink: i.itemAffiliateWebUrl ?? null,
    merchant: i.seller?.username ? `eBay · ${i.seller.username}` : "eBay",
  };
}

export const ebayProvider: PriceProvider = {
  id: "ebay",
  showHistory: true,
  batchLimit: 1500,
  matches: (u) => ebayCountryFromHost(u.hostname) !== null,

  async resolve(_input, url) {
    if (!url) throw new ProviderError(400, "Plak een eBay-link");
    const country = ebayCountryFromHost(url.hostname);
    const legacy = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1] ?? url.searchParams.get("item");
    if (!country || !legacy) throw new ProviderError(400, "Geen eBay item-id gevonden in deze link");
    const item = await ebayGet(`/item/get_item_by_legacy_id?legacy_item_id=${legacy}`, country);
    const snap = snapshot(item);
    if (!snap) throw new ProviderError(404, "Geen prijs gevonden voor dit eBay-item");
    return {
      retailer: "ebay", country, externalId: legacy, ean: item.gtin && /^\d{13}$/.test(item.gtin) ? item.gtin : null,
      title: item.title, url: `https://www.${EBAY_MARKETS[country].host}/itm/${legacy}`,
      imageUrl: item.image?.imageUrl ?? null, currency: item.price?.currency ?? EBAY_MARKETS[country].currency,
      ...snap,
    };
  },

  async fetchOffers(items) {
    const out = new Map<string, OfferSnapshot | null>();
    for (const it of items) {
      try {
        out.set(it.externalId, snapshot(await ebayGet(`/item/get_item_by_legacy_id?legacy_item_id=${it.externalId}`, it.country)));
      } catch (e) {
        if (e instanceof ProviderError && e.status === 404) out.set(it.externalId, null);
        else if (e instanceof ProviderError && e.status === 429) break;
        else console.error("ebay fetch", it.externalId, e);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return out;
  },

  affiliateLink(ref) {
    const campid = process.env.EBAY_CAMPAIGN_ID;
    if (!campid) return ref.url;
    const u = new URL(ref.url);
    u.searchParams.set("mkcid", "1"); u.searchParams.set("mkevt", "1"); u.searchParams.set("campid", campid);
    u.searchParams.set("toolid", "10001"); u.searchParams.set("customid", "pricedrop");
    return u.toString();
  },
};

/**
 * bol.com Marketing Catalog API (affiliate API). NL + BE. 1200 requests/uur.
 * Docs: https://api.bol.com/marketing/docs/catalog-api/
 */
import { daysUntil, normalizeCondition } from "../delivery";
import { type OfferSnapshot, type PriceProvider, type ResolvedProduct, ProviderError } from "./types";

const TOKEN_URL = "https://login.bol.com/token?grant_type=client_credentials";
const BASE = "https://api.bol.com/marketing/catalog/v1";
let cachedToken: { value: string; expiresAt: number } | null = null;

export const bolConfigured = () => !!(process.env.BOL_CLIENT_ID && process.env.BOL_CLIENT_SECRET);

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.BOL_CLIENT_ID, secret = process.env.BOL_CLIENT_SECRET;
  if (!id || !secret) throw new ProviderError(503, "bol API niet geconfigureerd");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new ProviderError(res.status, `bol token mislukt: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cachedToken.value;
}

async function bolGet<T>(path: string, country: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("country-code", country);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json", "Accept-Language": "nl" },
    cache: "no-store",
  });
  if (res.status === 404) throw new ProviderError(404, "Product of aanbod niet gevonden");
  if (res.status === 429) throw new ProviderError(429, "bol rate limit");
  if (!res.ok) throw new ProviderError(res.status, `bol API fout ${res.status}`);
  return (await res.json()) as T;
}

type BolProduct = {
  ean: string; bolProductId: string; title: string; url: string;
  image?: { renditions?: { width: number; url: string }[] };
  offer?: { price: number; deliveryDescription?: string };
};
type BolOffer = {
  price: number; condition?: string; url?: string; deliveryDescription?: string;
  minDeliveryDate?: string; maxDeliveryDate?: string; seller?: { name: string };
};

function snapshot(o: BolOffer): OfferSnapshot {
  return {
    price: o.price,
    shippingCost: null, // bol: gratis verzending boven drempel; niet in API
    deliveryMinDays: daysUntil(o.minDeliveryDate),
    deliveryMaxDays: daysUntil(o.maxDeliveryDate) ?? daysUntil(o.minDeliveryDate),
    deliveryText: o.deliveryDescription ?? null,
    condition: normalizeCondition(o.condition) ?? "new",
    inStock: true,
    merchant: o.seller?.name ?? "bol",
  };
}

async function fullProduct(ean: string, country: string): Promise<ResolvedProduct> {
  const p = await bolGet<BolProduct>(`/products/${ean}`, country, { "include-image": "true", "include-offer": "true" });
  let snap: OfferSnapshot | null = null;
  try { snap = snapshot(await bolGet<BolOffer>(`/products/${ean}/offers/best`, country, { "include-seller": "true" })); }
  catch (e) { if (!(e instanceof ProviderError && e.status === 404)) throw e; }
  const r = [...(p.image?.renditions ?? [])].sort((a, b) => a.width - b.width);
  return {
    retailer: "bol", country, externalId: p.ean, ean: p.ean, title: p.title, url: p.url,
    imageUrl: (r.find((x) => x.width >= 300) ?? r[r.length - 1])?.url ?? null,
    currency: "EUR",
    ...(snap ?? { price: p.offer?.price ?? Number.NaN, inStock: !!p.offer }),
    price: snap?.price ?? p.offer?.price ?? Number.NaN,
  };
}

export const bolProvider: PriceProvider = {
  id: "bol",
  showHistory: true,
  batchLimit: 900,
  matches: (u) => /(^|\.)bol\.com$/.test(u.hostname),

  async resolve(input, url) {
    const country = url?.pathname.startsWith("/be/") ? "BE" : "NL";
    let ean: string;
    if (/^\d{13}$/.test(input)) ean = input;
    else {
      const id = url
        ? (url.pathname.match(/\/p\/[^/]+\/(\d{14,16})\/?/) ?? url.pathname.match(/\/(\d{14,16})\/?/))?.[1]
        : input.match(/^\d{14,16}$/)?.[0];
      if (!id) throw new ProviderError(400, "Geen bol product-id gevonden in deze link");
      ean = (await bolGet<{ ean: string }>(`/products/${id}/to-ean`, country)).ean;
    }
    const p = await fullProduct(ean, country);
    if (Number.isNaN(p.price)) throw new ProviderError(404, "Product is momenteel niet leverbaar bij bol");
    return p;
  },

  async fetchOffers(items) {
    const out = new Map<string, OfferSnapshot | null>();
    for (const it of items) {
      try {
        out.set(it.externalId, snapshot(await bolGet<BolOffer>(`/products/${it.externalId}/offers/best`, it.country, { "include-seller": "true" })));
      } catch (e) {
        if (e instanceof ProviderError && e.status === 404) out.set(it.externalId, null);
        else if (e instanceof ProviderError && e.status === 429) break;
        else console.error("bol fetch", it.externalId, e);
      }
    }
    return out;
  },

  async findByEan(ean, countries) {
    if (!bolConfigured()) return [];
    const out: ResolvedProduct[] = [];
    for (const c of countries.filter((x) => x === "NL" || x === "BE")) {
      try { const p = await fullProduct(ean, c); if (!Number.isNaN(p.price)) out.push(p); }
      catch (e) { if (!(e instanceof ProviderError && e.status === 404)) console.error("bol findByEan", e); }
    }
    return out;
  },

  affiliateLink(ref, label) {
    const siteId = process.env.BOL_SITE_ID;
    if (!siteId) return ref.url;
    const u = new URL("https://partner.bol.com/click/click");
    u.searchParams.set("p", "2"); u.searchParams.set("t", "url"); u.searchParams.set("s", siteId);
    u.searchParams.set("f", "TXL"); u.searchParams.set("url", ref.url); u.searchParams.set("name", label);
    return u.toString();
  },
};

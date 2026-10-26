/**
 * bol.com Marketing Catalog API (affiliate API). NL + BE.
 * Docs: https://api.bol.com/marketing/docs/catalog-api/  — 1200 requests/uur.
 */
import { type PriceProvider, type ProductRef, type ResolvedProduct, ProviderError } from "./types";

const TOKEN_URL = "https://login.bol.com/token?grant_type=client_credentials";
const BASE = "https://api.bol.com/marketing/catalog/v1";
let cachedToken: { value: string; expiresAt: number } | null = null;

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
  offer?: { price: number };
};

export const bolProvider: PriceProvider = {
  id: "bol",
  showHistory: true,
  batchLimit: 900,
  matches: (u) => /(^|\.)bol\.com$/.test(u.hostname),

  async resolve(input, url) {
    const country = url?.pathname.startsWith("/be/") ? "BE" : "NL";
    let ean: string | null = null;
    if (/^\d{13}$/.test(input)) ean = input;
    else {
      const id = url
        ? (url.pathname.match(/\/p\/[^/]+\/(\d{14,16})\/?/) ?? url.pathname.match(/\/(\d{14,16})\/?/))?.[1]
        : input.match(/^\d{14,16}$/)?.[0];
      if (!id) throw new ProviderError(400, "Geen bol product-id gevonden in deze link");
      ean = (await bolGet<{ ean: string }>(`/products/${id}/to-ean`, country)).ean;
    }
    const p = await bolGet<BolProduct>(`/products/${ean}`, country, { "include-image": "true", "include-offer": "true" });
    const r = [...(p.image?.renditions ?? [])].sort((a, b) => a.width - b.width);
    return {
      retailer: "bol", country, externalId: p.ean, ean: p.ean, title: p.title, url: p.url,
      imageUrl: (r.find((x) => x.width >= 300) ?? r[r.length - 1])?.url ?? null,
      currency: "EUR", price: p.offer?.price ?? null,
    };
  },

  async fetchPrices(items) {
    const out = new Map<string, number | null>();
    for (const it of items) {
      try {
        const o = await bolGet<{ price: number }>(`/products/${it.externalId}/offers/best`, it.country);
        out.set(it.externalId, o.price);
      } catch (e) {
        if (e instanceof ProviderError && e.status === 404) out.set(it.externalId, null);
        else if (e instanceof ProviderError && e.status === 429) break;
        else console.error("bol fetch", it.externalId, e);
      }
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

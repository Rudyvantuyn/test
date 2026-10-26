/**
 * bol.com Marketing Catalog API client (affiliate API).
 * Docs: https://api.bol.com/marketing/docs/catalog-api/
 * Auth: OAuth2 client credentials via https://login.bol.com/token
 * Limiet: 1200 requests/uur. Tokens worden in-memory gecached.
 */

const TOKEN_URL = "https://login.bol.com/token?grant_type=client_credentials";
const BASE = "https://api.bol.com/marketing/catalog/v1";
const COUNTRY = "NL";

let cachedToken: { value: string; expiresAt: number } | null = null;

export class BolApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.BOL_CLIENT_ID;
  const secret = process.env.BOL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("BOL_CLIENT_ID / BOL_CLIENT_SECRET ontbreken");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new BolApiError(res.status, `Token ophalen mislukt: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function bolGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getToken();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("country-code", COUNTRY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Accept-Language": "nl",
    },
    cache: "no-store",
  });
  if (res.status === 404) throw new BolApiError(404, "Product of aanbod niet gevonden");
  if (res.status === 429) throw new BolApiError(429, "Rate limit bereikt");
  if (!res.ok) throw new BolApiError(res.status, `bol API fout ${res.status} op ${path}`);
  return (await res.json()) as T;
}

export type BolProduct = {
  ean: string;
  bolProductId: string;
  title: string;
  url: string;
  image?: { renditions?: { width: number; height: number; url: string }[] };
  offer?: { price: number; strikethroughPrice?: number; deliveryDescription?: string };
  rating?: number;
};

export type BolBestOffer = {
  ean: string;
  price: number;
  strikethroughPrice?: number;
  url: string;
  deliveryDescription?: string;
  seller?: { name: string };
};

export function getProduct(ean: string) {
  return bolGet<BolProduct>(`/products/${ean}`, {
    "include-image": "true",
    "include-offer": "true",
    "include-rating": "true",
  });
}

export function getBestOffer(ean: string) {
  return bolGet<BolBestOffer>(`/products/${ean}/offers/best`, { "include-seller": "true" });
}

export async function bolProductIdToEan(bolProductId: string): Promise<string> {
  const r = await bolGet<{ ean: string }>(`/products/${bolProductId}/to-ean`);
  return r.ean;
}

/**
 * Haalt een EAN uit gebruikersinvoer: een 13-cijferige EAN, een bol productId
 * (9200000xxxxxxxxx / 9300000xxxxxxxxx) of een bol.com product-URL.
 */
export async function resolveEan(input: string): Promise<string> {
  const s = input.trim();
  if (/^\d{13}$/.test(s)) return s;
  if (/^\d{14,16}$/.test(s)) return bolProductIdToEan(s);
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error("Voer een bol.com link of EAN in");
  }
  if (!/(^|\.)bol\.com$/.test(url.hostname)) throw new Error("Alleen bol.com links worden ondersteund");
  // Formaten: /nl/nl/p/slug/9300000012345678/  of /p/slug/9200000099487092/
  const m = url.pathname.match(/\/p\/[^/]+\/(\d{14,16})\/?/) ?? url.pathname.match(/\/(\d{14,16})\/?/);
  if (!m) throw new Error("Kon geen product-id vinden in deze link");
  return bolProductIdToEan(m[1]);
}

/**
 * Bouwt een bol affiliate tracking-link.
 * Standaard partner.bol.com click-formaat; controleer in je affiliate dashboard
 * (Links -> Deeplink generator) of dit overeenkomt met jouw account.
 */
export function affiliateLink(productUrl: string, label = "prijsdaler"): string {
  const siteId = process.env.BOL_SITE_ID;
  if (!siteId) return productUrl;
  const u = new URL("https://partner.bol.com/click/click");
  u.searchParams.set("p", "2");
  u.searchParams.set("t", "url");
  u.searchParams.set("s", siteId);
  u.searchParams.set("f", "TXL");
  u.searchParams.set("url", productUrl);
  u.searchParams.set("name", label);
  return u.toString();
}

export function mainImageUrl(p: BolProduct): string | null {
  const r = p.image?.renditions;
  if (!r?.length) return null;
  // kies de rendering rond 300px breed, anders de grootste
  const sorted = [...r].sort((a, b) => a.width - b.width);
  return (sorted.find((x) => x.width >= 300) ?? sorted[sorted.length - 1]).url;
}

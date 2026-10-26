/**
 * Amazon Product Advertising API 5.0 — alle marketplaces.
 * Vereist Amazon Associates-account per regio + API-keys (na 3 verkopen binnen 180 dagen).
 * GetItems: max 10 ASINs per call, standaard 1 call/sec en 8640 calls/dag.
 * Let op: de PA-API-licentie verbiedt het tonen van historische prijzen; daarom showHistory=false.
 */
import { createHash, createHmac } from "node:crypto";
import { type PriceProvider, type ProductRef, type ResolvedProduct, ProviderError } from "./types";

type Market = { host: string; region: string; currency: string };
export const AMAZON_MARKETS: Record<string, Market> = {
  US: { host: "www.amazon.com", region: "us-east-1", currency: "USD" },
  CA: { host: "www.amazon.ca", region: "us-east-1", currency: "CAD" },
  MX: { host: "www.amazon.com.mx", region: "us-east-1", currency: "MXN" },
  BR: { host: "www.amazon.com.br", region: "us-east-1", currency: "BRL" },
  GB: { host: "www.amazon.co.uk", region: "eu-west-1", currency: "GBP" },
  DE: { host: "www.amazon.de", region: "eu-west-1", currency: "EUR" },
  FR: { host: "www.amazon.fr", region: "eu-west-1", currency: "EUR" },
  IT: { host: "www.amazon.it", region: "eu-west-1", currency: "EUR" },
  ES: { host: "www.amazon.es", region: "eu-west-1", currency: "EUR" },
  NL: { host: "www.amazon.nl", region: "eu-west-1", currency: "EUR" },
  BE: { host: "www.amazon.com.be", region: "eu-west-1", currency: "EUR" },
  SE: { host: "www.amazon.se", region: "eu-west-1", currency: "SEK" },
  PL: { host: "www.amazon.pl", region: "eu-west-1", currency: "PLN" },
  TR: { host: "www.amazon.com.tr", region: "eu-west-1", currency: "TRY" },
  AE: { host: "www.amazon.ae", region: "eu-west-1", currency: "AED" },
  SA: { host: "www.amazon.sa", region: "eu-west-1", currency: "SAR" },
  EG: { host: "www.amazon.eg", region: "eu-west-1", currency: "EGP" },
  IN: { host: "www.amazon.in", region: "eu-west-1", currency: "INR" },
  JP: { host: "www.amazon.co.jp", region: "us-west-2", currency: "JPY" },
  AU: { host: "www.amazon.com.au", region: "us-west-2", currency: "AUD" },
  SG: { host: "www.amazon.sg", region: "us-west-2", currency: "SGD" },
};

const hostToCountry = Object.fromEntries(Object.entries(AMAZON_MARKETS).map(([cc, m]) => [m.host.replace(/^www\./, ""), cc]));

export function amazonCountryFromHost(host: string): string | null {
  const h = host.toLowerCase().replace(/^(www|smile|m)\./, "");
  return hostToCountry[h] ?? null;
}

function creds(country: string) {
  const accessKey = process.env.AMAZON_ACCESS_KEY, secretKey = process.env.AMAZON_SECRET_KEY;
  const tag = process.env[`AMAZON_PARTNER_TAG_${country}`] ?? process.env.AMAZON_PARTNER_TAG;
  if (!accessKey || !secretKey || !tag) throw new ProviderError(503, `Amazon ${country} niet geconfigureerd`);
  return { accessKey, secretKey, tag };
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s, "utf8").digest();

/** AWS Signature V4 voor PA-API 5. */
async function paapi<T>(country: string, operation: "GetItems", payload: Record<string, unknown>): Promise<T> {
  const m = AMAZON_MARKETS[country];
  if (!m) throw new ProviderError(400, `Onbekende Amazon marketplace ${country}`);
  const { accessKey, secretKey, tag } = creds(country);
  const host = `webservices.${m.host.replace(/^www\./, "")}`;
  const path = `/paapi5/${operation.toLowerCase()}`;
  const body = JSON.stringify({ ...payload, PartnerTag: tag, PartnerType: "Associates", Marketplace: m.host });
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=utf-8",
    host,
    "x-amz-date": amzDate,
    "x-amz-target": target,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = ["POST", path, "", canonicalHeaders, signedHeaders, sha256(body)].join("\n");
  const scope = `${dateStamp}/${m.region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), m.region), "ProductAdvertisingAPI"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: { ...headers, Authorization: authorization },
    body,
    cache: "no-store",
  });
  if (res.status === 429) throw new ProviderError(429, "Amazon rate limit");
  const json = (await res.json().catch(() => ({}))) as T & { Errors?: { Code: string; Message: string }[] };
  if (!res.ok && !(json as { ItemsResult?: unknown }).ItemsResult) {
    throw new ProviderError(res.status, `Amazon API ${res.status}: ${json.Errors?.[0]?.Message ?? "fout"}`);
  }
  return json;
}

type Item = {
  ASIN: string;
  DetailPageURL: string;
  ItemInfo?: { Title?: { DisplayValue?: string } };
  Images?: { Primary?: { Medium?: { URL: string }; Large?: { URL: string } } };
  Offers?: { Listings?: { Price?: { Amount: number; Currency: string } }[] };
};
type GetItemsResponse = { ItemsResult?: { Items?: Item[] }; Errors?: { Code: string; Message: string }[] };

const RESOURCES = ["ItemInfo.Title", "Images.Primary.Medium", "Offers.Listings.Price", "Offers.Listings.Availability.Type"];

async function getItems(country: string, asins: string[]): Promise<Item[]> {
  const r = await paapi<GetItemsResponse>(country, "GetItems", { ItemIds: asins, Resources: RESOURCES });
  return r.ItemsResult?.Items ?? [];
}

export function asinFromUrl(u: URL): string | null {
  const m =
    u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i) ??
    u.pathname.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
  return m ? m[1].toUpperCase() : null;
}

/** Volgt amzn.to / amzn.eu korte links naar de echte URL. */
export async function expandShortLink(u: URL): Promise<URL> {
  if (!/^(amzn\.to|amzn\.eu|amzn\.asia|a\.co)$/.test(u.hostname)) return u;
  const res = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
  return new URL(res.url);
}

export const amazonProvider: PriceProvider = {
  id: "amazon",
  showHistory: false,
  batchLimit: 2000, // 200 GetItems-calls x 10 ASINs; cron draait meerdere keren per dag
  matches: (u) => amazonCountryFromHost(u.hostname) !== null || /^(amzn\.to|amzn\.eu|amzn\.asia|a\.co)$/.test(u.hostname),

  async resolve(input, url) {
    if (!url) throw new ProviderError(400, "Plak een Amazon-productlink");
    const real = await expandShortLink(url);
    const country = amazonCountryFromHost(real.hostname);
    const asin = asinFromUrl(real);
    if (!country || !asin) throw new ProviderError(400, "Geen ASIN gevonden in deze Amazon-link");
    const [item] = await getItems(country, [asin]);
    if (!item) throw new ProviderError(404, "Product niet gevonden bij Amazon");
    const listing = item.Offers?.Listings?.[0]?.Price;
    return {
      retailer: "amazon", country, externalId: asin, ean: null,
      title: item.ItemInfo?.Title?.DisplayValue ?? `Amazon ${asin}`,
      url: `https://${AMAZON_MARKETS[country].host}/dp/${asin}`,
      imageUrl: item.Images?.Primary?.Medium?.URL ?? null,
      currency: listing?.Currency ?? AMAZON_MARKETS[country].currency,
      price: listing?.Amount ?? null,
    };
  },

  async fetchPrices(items) {
    const out = new Map<string, number | null>();
    const byCountry = new Map<string, ProductRef[]>();
    for (const it of items) byCountry.set(it.country, [...(byCountry.get(it.country) ?? []), it]);
    for (const [country, refs] of byCountry) {
      for (let i = 0; i < refs.length; i += 10) {
        const chunk = refs.slice(i, i + 10);
        try {
          const found = await getItems(country, chunk.map((r) => r.externalId));
          for (const r of chunk) {
            const item = found.find((x) => x.ASIN === r.externalId);
            if (item) out.set(r.externalId, item.Offers?.Listings?.[0]?.Price?.Amount ?? null);
          }
        } catch (e) {
          if (e instanceof ProviderError && e.status === 429) return out;
          console.error("amazon fetch", country, e);
        }
        await new Promise((r) => setTimeout(r, 1100)); // 1 TPS
      }
    }
    return out;
  },

  affiliateLink(ref, label) {
    const tag = process.env[`AMAZON_PARTNER_TAG_${ref.country}`] ?? process.env.AMAZON_PARTNER_TAG;
    const u = new URL(ref.url);
    if (tag) u.searchParams.set("tag", tag);
    u.searchParams.set("ref_", `pd_${label}`.slice(0, 32));
    return u.toString();
  },
};

/**
 * Browserextensie: productidentiteit afleiden uit een pagina, en bepalen wanneer we prijzen
 * van gebruikers (crowd) mogen gebruiken. Alle invoer van de extensie is onbetrouwbaar.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, type ProductRow } from "./supabase";
import { AMAZON_MARKETS, amazonConfigured, amazonCountryFromHost, asinFromUrl } from "./providers/amazon";
import { EBAY_MARKETS, ebayConfigured, ebayCountryFromHost } from "./providers/ebay";
import { bolConfigured } from "./providers/bol";
import { cleanUrl } from "./providers/generic";
import { findFeedOffer } from "./providers/feed";
import { normalizeCondition, parseDeliveryText } from "./delivery";
import { retailerForHost } from "./retailers";
import { countryFromHost, currencyForCountry, type Retailer, type ResolvedProduct } from "./providers/types";

export const PageSchema = z.object({
  url: z.string().url().max(2000),
  canonical: z.string().url().max(2000).nullish(),
  title: z.string().min(2).max(400),
  price: z.number().positive().max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/).nullish(),
  listPrice: z.number().positive().max(1_000_000).nullish(),
  image: z.string().url().max(2000).nullish(),
  ean: z.string().regex(/^\d{8,14}$/).nullish(),
  deliveryText: z.string().max(200).nullish(),
  inStock: z.boolean().nullish(),
  condition: z.string().max(40).nullish(),
  shippingCost: z.number().min(0).max(10_000).nullish(),
});
export type Page = z.infer<typeof PageSchema>;

export const InstallId = z.string().regex(/^[a-f0-9-]{16,64}$/);

export type Identity = { retailer: Retailer; country: string; externalId: string; url: string; feedOffer?: boolean };

/** Leidt winkel, land en product-id af uit de URL (niet uit wat de extensie beweert). */
export async function identityFromPage(page: Page): Promise<Identity | null> {
  const u = new URL(page.url);
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname;

  const amz = amazonCountryFromHost(host);
  if (amz) {
    const asin = asinFromUrl(u);
    if (!asin) return null;
    return { retailer: "amazon", country: amz, externalId: asin, url: `https://${AMAZON_MARKETS[amz].host}/dp/${asin}` };
  }
  const eb = ebayCountryFromHost(host);
  if (eb) {
    const id = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1];
    if (!id) return null;
    return { retailer: "ebay", country: eb, externalId: id, url: `https://www.${EBAY_MARKETS[eb].host}/itm/${id}` };
  }
  // Eigen adres als identiteit (zie generic.ts: canonical van bundels wijst naar het basisproduct)
  const canonical = cleanUrl(new URL(page.url));
  if (/(^|\.)bol\.com$/.test(host)) {
    const ean = page.ean && /^\d{13}$/.test(page.ean) ? page.ean : null;
    if (ean) return { retailer: "bol", country: u.pathname.startsWith("/be/") ? "BE" : "NL", externalId: ean, url: canonical };
  }
  const offer = await findFeedOffer(new URL(canonical)).catch(() => null);
  if (offer) {
    const src = Array.isArray(offer.feed_sources) ? offer.feed_sources[0] : offer.feed_sources;
    return { retailer: "feed", country: src.country, externalId: offer.url_hash, url: offer.url, feedOffer: true };
  }
  return {
    retailer: "generic", country: countryFromHost(new URL(canonical).hostname),
    externalId: createHash("sha256").update(canonical).digest("hex").slice(0, 20), url: canonical,
  };
}

/** Mogen we voor deze bron prijzen van gebruikers gebruiken? */
export function crowdAllowed(id: Identity): boolean {
  switch (id.retailer) {
    case "feed": return false; // feed is leidend
    case "bol": return !bolConfigured();
    case "ebay": return !ebayConfigured();
    case "amazon": return !amazonConfigured(id.country) && process.env.CROWD_PRICES_AMAZON === "on";
    default: return true;
  }
}

export function pageToProduct(page: Page, id: Identity): ResolvedProduct {
  const d = parseDeliveryText(page.deliveryText);
  const host = new URL(id.url).hostname;
  return {
    retailer: id.retailer, country: id.country, externalId: id.externalId,
    ean: page.ean && /^\d{13}$/.test(page.ean) ? page.ean : null,
    title: page.title.trim().slice(0, 300), url: id.url, imageUrl: page.image ?? null,
    currency: page.currency ?? currencyForCountry[id.country] ?? "EUR",
    price: page.price, listPrice: page.listPrice ?? null, shippingCost: page.shippingCost ?? null,
    deliveryText: page.deliveryText ?? null, deliveryMinDays: d.min, deliveryMaxDays: d.max,
    condition: normalizeCondition(page.condition) ?? "new", inStock: page.inStock ?? true,
    merchant: id.retailer === "amazon" ? "Amazon" : id.retailer === "bol" ? "bol" : id.retailer === "ebay" ? "eBay" : retailerForHost(host)?.name ?? host.replace(/^www\./, ""),
  };
}

export async function findProduct(id: Identity): Promise<ProductRow | null> {
  const { data } = await db().from("products").select("*").match({ retailer: id.retailer, country: id.country, external_id: id.externalId }).maybeSingle();
  return (data as ProductRow) ?? null;
}

/** Limiet per installatie per dag; false = limiet bereikt. */
export async function rateOk(installId: string, kind: "page" | "watch") {
  const { data, error } = await db().rpc("ext_hit", { p_install: `${kind}:${installId}`, p_limit: kind === "page" ? 1500 : 60 });
  if (error) { console.error("ext_hit", error); return true; }
  return data === true;
}

export function cors(res: Response) {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type");
  return res;
}

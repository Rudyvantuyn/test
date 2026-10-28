import { bolProvider, bolConfigured } from "./bol";
import { amazonProvider, amazonConfigured, amazonCountryFromHost, asinFromUrl, expandShortLink } from "./amazon";
import { ebayProvider, ebayConfigured, ebayCountryFromHost } from "./ebay";
import { genericProvider } from "./generic";
import { feedProvider, findFeedOffer, offerToProduct } from "./feed";
import { PendingSourceError, type PriceProvider, type Retailer, type ResolvedProduct } from "./types";

export * from "./types";

export const providers: Record<Retailer, PriceProvider> = {
  bol: bolProvider, amazon: amazonProvider, ebay: ebayProvider, feed: feedProvider, generic: genericProvider,
};

/** Kiest de juiste provider voor gebruikersinvoer en lost het product op. */
export async function resolveInput(input: string): Promise<ResolvedProduct> {
  const s = input.trim();
  if (/^\d{13}$/.test(s)) {
    if (!bolConfigured()) throw new PendingSourceError("bol", "NL", s, `https://www.bol.com/nl/nl/s/?searchtext=${s}`);
    return bolProvider.resolve(s, null);
  }
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); }
  catch { throw new Error("Voer een geldige productlink in"); }
  if (amazonProvider.matches(url)) {
    const real = await expandShortLink(url).catch(() => url);
    const country = amazonCountryFromHost(real.hostname);
    if (!amazonConfigured(country ?? undefined)) throw new PendingSourceError("amazon", country, asinFromUrl(real), real.toString());
    return amazonProvider.resolve(s, real);
  }
  if (ebayProvider.matches(url)) {
    if (!ebayConfigured()) throw new PendingSourceError("ebay", ebayCountryFromHost(url.hostname), url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1] ?? null, url.toString());
    return ebayProvider.resolve(s, url);
  }
  if (bolProvider.matches(url)) {
    if (!bolConfigured()) throw new PendingSourceError("bol", url.pathname.startsWith("/be/") ? "BE" : "NL", null, url.toString());
    return bolProvider.resolve(s, url);
  }
  const offer = await findFeedOffer(url).catch(() => null); // 1) affiliate-feed (met deeplink)
  if (offer) return offerToProduct(offer);
  return genericProvider.resolve(s, url); // 2) productpagina zelf
}

/** Zoekt hetzelfde product (EAN) bij andere bronnen, voor de vergelijking "waar is het goedkoopst / snelst". */
export async function findOffersByEan(ean: string, countries: string[], exclude?: { retailer: Retailer; externalId: string }): Promise<ResolvedProduct[]> {
  const results = await Promise.all(
    Object.values(providers).filter((p) => p.findByEan).map((p) => p.findByEan!(ean, countries).catch((e) => { console.error("findByEan", p.id, e); return [] as ResolvedProduct[]; })),
  );
  return results.flat().filter((r) => !(exclude && r.retailer === exclude.retailer && r.externalId === exclude.externalId));
}

export const retailerLabel: Record<Retailer, string> = { bol: "bol.com", amazon: "Amazon", ebay: "eBay", generic: "", feed: "" };

/** Buurlanden waar dezelfde EAN waarschijnlijk ook verkocht wordt (voor vergelijking). */
export const COMPARE_COUNTRIES: Record<string, string[]> = {
  NL: ["NL", "BE", "DE"], BE: ["BE", "NL", "FR", "DE"], DE: ["DE", "AT", "NL"], AT: ["AT", "DE"], CH: ["CH", "DE"],
  FR: ["FR", "BE"], GB: ["GB", "IE"], IE: ["IE", "GB"], US: ["US"], CA: ["CA", "US"], ES: ["ES", "PT"], PT: ["PT", "ES"], IT: ["IT"],
};

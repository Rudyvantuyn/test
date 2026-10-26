/** Gemeenschappelijke interface voor alle winkels/landen. */
export type Retailer = "bol" | "amazon" | "generic" | "feed";

export type ResolvedProduct = {
  retailer: Retailer;
  country: string; // ISO-3166 alpha-2: NL, BE, DE, US, GB ...
  externalId: string; // EAN (bol), ASIN (amazon), url-hash (generic)
  ean?: string | null;
  title: string;
  url: string; // canonieke productpagina (zonder affiliate)
  imageUrl?: string | null;
  currency: string; // EUR, USD, GBP ...
  price: number | null;
};

export type ProductRef = { retailer: Retailer; country: string; externalId: string; url: string };

export interface PriceProvider {
  id: Retailer;
  /** Mag prijsgeschiedenis publiek getoond worden? (Amazon PA-API verbiedt dit.) */
  showHistory: boolean;
  /** Max. producten per cron-run voor deze provider. */
  batchLimit: number;
  matches(url: URL): boolean;
  resolve(input: string, url: URL | null): Promise<ResolvedProduct>;
  /** Haalt actuele prijzen op; null = niet leverbaar. Ontbrekende keys = fout/overslaan. */
  fetchPrices(items: ProductRef[]): Promise<Map<string, number | null>>;
  affiliateLink(ref: ProductRef, label: string): string;
}

export const key = (r: ProductRef | ResolvedProduct) => `${r.retailer}-${r.country}-${r.externalId}`;

export function parseKey(k: string): { retailer: Retailer; country: string; externalId: string } | null {
  const m = k.match(/^(bol|amazon|generic|feed)-([A-Z]{2})-([A-Za-z0-9]{6,40})$/);
  return m ? { retailer: m[1] as Retailer, country: m[2], externalId: m[3] } : null;
}

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Land afleiden uit een TLD / hostname. */
export function countryFromHost(host: string): string {
  const h = host.toLowerCase();
  const map: Record<string, string> = {
    nl: "NL", be: "BE", de: "DE", fr: "FR", it: "IT", es: "ES", uk: "GB", ie: "IE", se: "SE", pl: "PL",
    at: "AT", ch: "CH", dk: "DK", no: "NO", fi: "FI", pt: "PT", cz: "CZ", ca: "CA", au: "AU", jp: "JP",
    mx: "MX", br: "BR", in: "IN", sg: "SG", ae: "AE", sa: "SA", tr: "TR", eg: "EG",
  };
  const m = h.match(/\.co\.([a-z]{2})$|\.com\.([a-z]{2})$|\.([a-z]{2})$/);
  const cc = m?.[1] ?? m?.[2] ?? m?.[3];
  if (cc && map[cc]) return map[cc];
  if (h.endsWith(".com")) return "US";
  return "US";
}

export const currencyForCountry: Record<string, string> = {
  NL: "EUR", BE: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", IE: "EUR", AT: "EUR", FI: "EUR", PT: "EUR",
  GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", JP: "JPY", SE: "SEK", PL: "PLN", CH: "CHF", DK: "DKK", NO: "NOK",
  CZ: "CZK", MX: "MXN", BR: "BRL", IN: "INR", SG: "SGD", AE: "AED", SA: "SAR", TR: "TRY", EG: "EGP",
};

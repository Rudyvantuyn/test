/** Gemeenschappelijke interface voor alle winkels/landen. */
export type Retailer = "bol" | "amazon" | "ebay" | "generic" | "feed";
export type Condition = "new" | "used" | "refurbished";

/** Momentopname van een aanbod. */
export type OfferSnapshot = {
  price: number;
  shippingCost?: number | null;
  deliveryMinDays?: number | null;
  deliveryMaxDays?: number | null;
  deliveryText?: string | null;
  condition?: Condition | null;
  inStock?: boolean;
  /** Kant-en-klare affiliate-link (eBay/feeds); anders wordt affiliateLink() gebruikt. */
  deeplink?: string | null;
  merchant?: string | null;
  /** Adviesprijs of doorgestreepte "van"-prijs; aanwezig = actie. */
  listPrice?: number | null;
  /** Einddatum van de actie (YYYY-MM-DD), indien bekend. */
  promoUntil?: string | null;
};

export type ResolvedProduct = OfferSnapshot & {
  retailer: Retailer;
  country: string; // ISO-3166 alpha-2
  externalId: string; // EAN (bol), ASIN (amazon), item id (ebay), url-hash (generic/feed)
  ean?: string | null;
  title: string;
  url: string;
  imageUrl?: string | null;
  currency: string;
};

export type ProductRef = { retailer: Retailer; country: string; externalId: string; url: string };

export interface PriceProvider {
  id: Retailer;
  /** Mag prijsgeschiedenis publiek getoond worden? (Amazon PA-API verbiedt dit.) */
  showHistory: boolean;
  batchLimit: number;
  matches(url: URL): boolean;
  resolve(input: string, url: URL | null): Promise<ResolvedProduct>;
  /** null = niet leverbaar; ontbrekende key = fout, later opnieuw. */
  fetchOffers(items: ProductRef[]): Promise<Map<string, OfferSnapshot | null>>;
  affiliateLink(ref: ProductRef, label: string): string;
  /** Zoek aanbiedingen van hetzelfde product (EAN) bij deze bron, voor vergelijking. */
  findByEan?(ean: string, countries: string[]): Promise<ResolvedProduct[]>;
}

export const key = (r: ProductRef | ResolvedProduct) => `${r.retailer}-${r.country}-${r.externalId}`;

export function parseKey(k: string): { retailer: Retailer; country: string; externalId: string } | null {
  const m = k.match(/^(bol|amazon|ebay|generic|feed)-([A-Z]{2})-([A-Za-z0-9]{6,40})$/);
  return m ? { retailer: m[1] as Retailer, country: m[2], externalId: m[3] } : null;
}

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bron herkend maar (nog) niet gekoppeld: aanvraag wordt bewaard en later automatisch verwerkt. */
export class PendingSourceError extends Error {
  constructor(public retailer: Retailer, public country: string | null, public externalId: string | null, public url: string) {
    super(`${retailer} nog niet actief`);
  }
}

const TLD_COUNTRY: Record<string, string> = {
  nl: "NL", be: "BE", de: "DE", fr: "FR", it: "IT", es: "ES", uk: "GB", ie: "IE", se: "SE", pl: "PL",
  at: "AT", ch: "CH", dk: "DK", no: "NO", fi: "FI", pt: "PT", cz: "CZ", ca: "CA", au: "AU", jp: "JP",
  mx: "MX", br: "BR", in: "IN", sg: "SG", ae: "AE", sa: "SA", tr: "TR", eg: "EG", nz: "NZ", hk: "HK",
  kr: "KR", za: "ZA", ar: "AR", cl: "CL", co: "CO", my: "MY", ph: "PH", th: "TH", id: "ID", vn: "VN",
  gr: "GR", hu: "HU", ro: "RO", sk: "SK", bg: "BG", hr: "HR", si: "SI", lt: "LT", lv: "LV", ee: "EE",
};

/** Land afleiden uit een hostname. */
export function countryFromHost(host: string): string {
  const h = host.toLowerCase();
  const m = h.match(/\.co\.([a-z]{2})$|\.com\.([a-z]{2})$|\.([a-z]{2})$/);
  const cc = m?.[1] ?? m?.[2] ?? m?.[3];
  if (cc && TLD_COUNTRY[cc]) return TLD_COUNTRY[cc];
  return "US";
}

export const currencyForCountry: Record<string, string> = {
  NL: "EUR", BE: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", IE: "EUR", AT: "EUR", FI: "EUR", PT: "EUR",
  GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", HR: "EUR",
  GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", JP: "JPY", SE: "SEK", PL: "PLN", CH: "CHF", DK: "DKK",
  NO: "NOK", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", MX: "MXN", BR: "BRL", IN: "INR", SG: "SGD", HK: "HKD",
  AE: "AED", SA: "SAR", TR: "TRY", EG: "EGP", KR: "KRW", ZA: "ZAR", AR: "ARS", CL: "CLP", CO: "COP",
  MY: "MYR", PH: "PHP", TH: "THB", ID: "IDR", VN: "VND",
};

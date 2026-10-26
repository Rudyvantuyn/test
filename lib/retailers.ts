/**
 * Register van verkoopsites waaraan we kunnen verdienen, per land en netwerk.
 * `network` bepaalt hoe de affiliate-link tot stand komt:
 *  - api:    eigen provider (bol, amazon, ebay)
 *  - feed:   productfeed via netwerk (Awin, Tradedoubler, Daisycon, TradeTracker, Partnerize, Impact, CJ, Rakuten, Belboon, Webgains, Admitad)
 *  - own:    eigen partnerprogramma van de winkel
 *  - catch-all: Skimlinks/Sovrn maken van elke link automatisch een affiliate-link (zie GENERIC_AFFILIATE_REDIRECT)
 * Commissies zijn indicatief; controleer in het netwerk.
 */
export type Network =
  | "api" | "awin" | "tradedoubler" | "daisycon" | "tradetracker" | "partnerize" | "impact" | "cj"
  | "rakuten" | "belboon" | "webgains" | "admitad" | "own" | "catch-all";

export type RetailerInfo = {
  domain: string;
  name: string;
  countries: string[];
  network: Network;
  commission: string;
  category?: string;
  note?: string;
};

const EU = ["NL", "BE", "DE", "FR", "IT", "ES", "AT", "PL", "SE", "IE", "PT", "DK", "FI", "CZ"];

export const RETAILERS: RetailerInfo[] = [
  // ---- Marktplaatsen met eigen API (providers in lib/providers) ----
  { domain: "amazon.*", name: "Amazon", countries: ["US", "CA", "MX", "BR", "GB", "DE", "FR", "IT", "ES", "NL", "BE", "SE", "PL", "TR", "AE", "SA", "EG", "IN", "JP", "AU", "SG"], network: "api", commission: "1–10%", note: "PA-API na 3 verkopen" },
  { domain: "ebay.*", name: "eBay", countries: ["US", "GB", "DE", "NL", "FR", "IT", "ES", "AT", "CH", "BE", "IE", "PL", "CA", "AU", "HK", "SG", "MY", "PH"], network: "api", commission: "1–4%", note: "eBay Partner Network + Browse API" },
  { domain: "bol.com", name: "bol", countries: ["NL", "BE"], network: "api", commission: "2–8%" },
  // ---- Wereldwijd / meerdere landen ----
  { domain: "aliexpress.com", name: "AliExpress", countries: ["*"], network: "own", commission: "3–9%", note: "AliExpress Portals; ook via Admitad" },
  { domain: "temu.com", name: "Temu", countries: ["*"], network: "impact", commission: "tot 20%" },
  { domain: "shein.com", name: "SHEIN", countries: ["*"], network: "impact", commission: "10–20%" },
  { domain: "etsy.com", name: "Etsy", countries: ["*"], network: "awin", commission: "4%" },
  { domain: "apple.com", name: "Apple", countries: ["*"], network: "partnerize", commission: "1–7%" },
  { domain: "nike.com", name: "Nike", countries: ["*"], network: "partnerize", commission: "tot 11%" },
  { domain: "adidas.*", name: "adidas", countries: ["*"], network: "awin", commission: "tot 7%" },
  { domain: "zalando.*", name: "Zalando", countries: EU, network: "awin", commission: "tot 8%" },
  { domain: "asos.com", name: "ASOS", countries: ["*"], network: "awin", commission: "tot 6%" },
  { domain: "hm.com", name: "H&M", countries: ["*"], network: "partnerize", commission: "tot 7%" },
  { domain: "ikea.com", name: "IKEA", countries: EU, network: "awin", commission: "tot 5%", note: "niet in elk land" },
  { domain: "decathlon.*", name: "Decathlon", countries: EU, network: "awin", commission: "tot 5%" },
  { domain: "lego.com", name: "LEGO", countries: ["*"], network: "rakuten", commission: "3%" },
  { domain: "booking.com", name: "Booking.com", countries: ["*"], network: "own", commission: "25–40% van de marge", category: "reizen" },
  { domain: "samsung.com", name: "Samsung", countries: ["*"], network: "cj", commission: "tot 3%" },
  { domain: "dell.com", name: "Dell", countries: ["*"], network: "cj", commission: "tot 6%" },
  { domain: "hp.com", name: "HP", countries: ["*"], network: "awin", commission: "tot 5%" },
  { domain: "lenovo.com", name: "Lenovo", countries: ["*"], network: "rakuten", commission: "tot 5%" },
  { domain: "dyson.*", name: "Dyson", countries: ["*"], network: "awin", commission: "tot 3%" },
  { domain: "philips.*", name: "Philips", countries: EU, network: "awin", commission: "tot 5%" },
  // ---- Nederland / België ----
  { domain: "coolblue.nl", name: "Coolblue", countries: ["NL", "BE", "DE"], network: "tradetracker", commission: "2–4%" },
  { domain: "mediamarkt.nl", name: "MediaMarkt NL", countries: ["NL"], network: "awin", commission: "1–3%" },
  { domain: "wehkamp.nl", name: "Wehkamp", countries: ["NL"], network: "daisycon", commission: "tot 6%" },
  { domain: "fonq.nl", name: "fonQ", countries: ["NL"], network: "daisycon", commission: "tot 6%" },
  { domain: "alternate.nl", name: "Alternate", countries: ["NL", "BE", "DE"], network: "daisycon", commission: "1–3%" },
  { domain: "blokker.nl", name: "Blokker", countries: ["NL"], network: "daisycon", commission: "tot 5%" },
  { domain: "debijenkorf.nl", name: "De Bijenkorf", countries: ["NL", "BE"], network: "awin", commission: "tot 6%" },
  { domain: "kruidvat.nl", name: "Kruidvat", countries: ["NL", "BE"], network: "tradetracker", commission: "tot 5%" },
  { domain: "expert.nl", name: "Expert", countries: ["NL"], network: "daisycon", commission: "1–3%" },
  { domain: "bcc.nl", name: "BCC", countries: ["NL"], network: "daisycon", commission: "1–3%" },
  { domain: "vandenborre.be", name: "Vanden Borre", countries: ["BE"], network: "tradetracker", commission: "1–3%" },
  { domain: "krefel.be", name: "Krëfel", countries: ["BE"], network: "daisycon", commission: "1–3%" },
  // ---- Duitsland / Oostenrijk / Zwitserland ----
  { domain: "mediamarkt.de", name: "MediaMarkt DE", countries: ["DE", "AT", "CH"], network: "awin", commission: "1–3%" },
  { domain: "saturn.de", name: "Saturn", countries: ["DE"], network: "awin", commission: "1–3%" },
  { domain: "otto.de", name: "OTTO", countries: ["DE"], network: "own", commission: "tot 8%", note: "OTTO Partnerprogramm (Awin)" },
  { domain: "notebooksbilliger.de", name: "notebooksbilliger", countries: ["DE", "AT"], network: "awin", commission: "1–3%" },
  { domain: "cyberport.de", name: "Cyberport", countries: ["DE", "AT"], network: "awin", commission: "1–3%" },
  { domain: "alternate.de", name: "Alternate DE", countries: ["DE"], network: "awin", commission: "1–3%" },
  { domain: "conrad.de", name: "Conrad", countries: ["DE", "AT", "NL"], network: "awin", commission: "tot 5%" },
  { domain: "galaxus.de", name: "Galaxus", countries: ["DE", "AT", "CH"], network: "own", commission: "1–3%" },
  { domain: "digitec.ch", name: "Digitec", countries: ["CH"], network: "own", commission: "1–3%" },
  { domain: "thalia.de", name: "Thalia", countries: ["DE", "AT"], network: "awin", commission: "tot 7%" },
  { domain: "douglas.de", name: "Douglas", countries: ["DE", "NL", "AT"], network: "awin", commission: "tot 8%" },
  { domain: "aboutyou.de", name: "About You", countries: EU, network: "awin", commission: "tot 8%" },
  { domain: "lidl.de", name: "Lidl", countries: ["DE", "NL", "AT"], network: "awin", commission: "tot 6%" },
  // ---- Verenigd Koninkrijk / Ierland ----
  { domain: "currys.co.uk", name: "Currys", countries: ["GB", "IE"], network: "awin", commission: "1–3%" },
  { domain: "argos.co.uk", name: "Argos", countries: ["GB"], network: "awin", commission: "1–4%" },
  { domain: "johnlewis.com", name: "John Lewis", countries: ["GB"], network: "awin", commission: "1–5%" },
  { domain: "very.co.uk", name: "Very", countries: ["GB"], network: "awin", commission: "tot 5%" },
  { domain: "ao.com", name: "AO", countries: ["GB"], network: "awin", commission: "1–3%" },
  { domain: "boots.com", name: "Boots", countries: ["GB"], network: "awin", commission: "tot 6%" },
  { domain: "next.co.uk", name: "Next", countries: ["GB"], network: "awin", commission: "tot 5%" },
  { domain: "scan.co.uk", name: "Scan", countries: ["GB"], network: "awin", commission: "1–3%" },
  { domain: "harveynorman.ie", name: "Harvey Norman", countries: ["IE", "AU"], network: "awin", commission: "1–3%" },
  // ---- Frankrijk / Italië / Spanje ----
  { domain: "fnac.com", name: "Fnac", countries: ["FR", "BE", "ES", "PT"], network: "awin", commission: "1–5%" },
  { domain: "darty.com", name: "Darty", countries: ["FR"], network: "awin", commission: "1–3%" },
  { domain: "cdiscount.com", name: "Cdiscount", countries: ["FR"], network: "own", commission: "tot 5%", note: "ook Awin" },
  { domain: "boulanger.com", name: "Boulanger", countries: ["FR"], network: "awin", commission: "1–3%" },
  { domain: "ldlc.com", name: "LDLC", countries: ["FR", "ES"], network: "awin", commission: "1–3%" },
  { domain: "leroymerlin.*", name: "Leroy Merlin", countries: ["FR", "ES", "IT", "PL"], network: "awin", commission: "tot 5%" },
  { domain: "unieuro.it", name: "Unieuro", countries: ["IT"], network: "awin", commission: "1–3%" },
  { domain: "eprice.it", name: "ePRICE", countries: ["IT"], network: "tradedoubler", commission: "1–3%" },
  { domain: "mediaworld.it", name: "MediaWorld", countries: ["IT"], network: "awin", commission: "1–3%" },
  { domain: "pccomponentes.com", name: "PcComponentes", countries: ["ES", "PT"], network: "awin", commission: "1–3%" },
  { domain: "elcorteingles.es", name: "El Corte Inglés", countries: ["ES", "PT"], network: "awin", commission: "tot 5%" },
  { domain: "worten.pt", name: "Worten", countries: ["PT", "ES"], network: "awin", commission: "1–3%" },
  // ---- Scandinavië / Polen ----
  { domain: "elgiganten.se", name: "Elgiganten", countries: ["SE", "DK"], network: "awin", commission: "1–3%" },
  { domain: "komplett.*", name: "Komplett", countries: ["NO", "SE", "DK"], network: "awin", commission: "1–3%" },
  { domain: "power.*", name: "Power", countries: ["NO", "SE", "DK", "FI"], network: "awin", commission: "1–3%" },
  { domain: "x-kom.pl", name: "x-kom", countries: ["PL"], network: "awin", commission: "1–3%" },
  { domain: "allegro.pl", name: "Allegro", countries: ["PL", "CZ", "SK", "HU"], network: "own", commission: "tot 5%" },
  { domain: "alza.*", name: "Alza", countries: ["CZ", "SK", "HU", "DE", "AT"], network: "own", commission: "1–4%" },
  // ---- Noord-Amerika ----
  { domain: "walmart.com", name: "Walmart", countries: ["US", "CA", "MX"], network: "impact", commission: "1–4%" },
  { domain: "bestbuy.com", name: "Best Buy", countries: ["US", "CA"], network: "impact", commission: "0.5–3%" },
  { domain: "target.com", name: "Target", countries: ["US"], network: "impact", commission: "1–8%" },
  { domain: "homedepot.com", name: "The Home Depot", countries: ["US", "CA"], network: "impact", commission: "1–8%" },
  { domain: "lowes.com", name: "Lowe's", countries: ["US"], network: "cj", commission: "tot 2%" },
  { domain: "newegg.com", name: "Newegg", countries: ["US", "CA"], network: "cj", commission: "0.5–3%" },
  { domain: "bhphotovideo.com", name: "B&H", countries: ["US"], network: "impact", commission: "2–8%" },
  { domain: "wayfair.com", name: "Wayfair", countries: ["US", "CA", "GB", "DE"], network: "cj", commission: "tot 7%" },
  { domain: "macys.com", name: "Macy's", countries: ["US"], network: "rakuten", commission: "tot 5%" },
  { domain: "costco.com", name: "Costco", countries: ["US"], network: "catch-all", commission: "–", note: "geen programma; via Skimlinks niet beschikbaar" },
  // ---- Azië-Pacific / overig ----
  { domain: "rakuten.co.jp", name: "Rakuten Ichiba", countries: ["JP"], network: "own", commission: "1–4%" },
  { domain: "flipkart.com", name: "Flipkart", countries: ["IN"], network: "own", commission: "tot 12%" },
  { domain: "lazada.*", name: "Lazada", countries: ["SG", "MY", "PH", "TH", "ID", "VN"], network: "own", commission: "tot 10%" },
  { domain: "shopee.*", name: "Shopee", countries: ["SG", "MY", "PH", "TH", "ID", "VN", "BR"], network: "own", commission: "tot 10%" },
  { domain: "jbhifi.com.au", name: "JB Hi-Fi", countries: ["AU"], network: "cj", commission: "1–3%" },
  { domain: "kogan.com", name: "Kogan", countries: ["AU", "NZ"], network: "cj", commission: "1–3%" },
  { domain: "noon.com", name: "noon", countries: ["AE", "SA", "EG"], network: "own", commission: "tot 8%" },
  { domain: "mercadolibre.*", name: "Mercado Libre", countries: ["MX", "BR", "AR", "CL", "CO"], network: "own", commission: "tot 10%" },
  { domain: "takealot.com", name: "Takealot", countries: ["ZA"], network: "own", commission: "tot 5%" },
];

export const NETWORK_LABEL: Record<Network, string> = {
  api: "Eigen API", awin: "Awin", tradedoubler: "Tradedoubler", daisycon: "Daisycon", tradetracker: "TradeTracker",
  partnerize: "Partnerize", impact: "Impact", cj: "CJ", rakuten: "Rakuten Advertising", belboon: "Belboon",
  webgains: "Webgains", admitad: "Admitad", own: "Eigen programma", "catch-all": "Skimlinks / Sovrn",
};

function domainMatches(pattern: string, host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (pattern.endsWith(".*")) {
    const base = pattern.slice(0, -2);
    return h === base || h.startsWith(`${base}.`) || h.includes(`.${base}.`) || new RegExp(`(^|\\.)${base.replace(".", "\\.")}\\.[a-z.]+$`).test(h);
  }
  return h === pattern || h.endsWith(`.${pattern}`);
}

export function retailerForHost(host: string): RetailerInfo | null {
  return RETAILERS.find((r) => domainMatches(r.domain, host)) ?? null;
}

export function retailersForCountry(country: string): RetailerInfo[] {
  return RETAILERS.filter((r) => r.countries.includes("*") || r.countries.includes(country));
}

export const ALL_COUNTRIES = [...new Set(RETAILERS.flatMap((r) => r.countries).filter((c) => c !== "*"))].sort();

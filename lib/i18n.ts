export const locales = ["nl", "en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const isLocale = (s: string): s is Locale => (locales as readonly string[]).includes(s);

const dict = {
  nl: {
    siteName: "Prijsdaler",
    tagline: "Betaal nooit te veel. Bij geen enkele webshop.",
    lead: "Plak een productlink van Amazon, bol.com of vrijwel elke andere webshop. Wij mailen je zodra de prijs daalt.",
    navDeals: "Grootste dalers",
    inputProduct: "Plak een productlink (Amazon, bol.com, Coolblue, MediaMarkt, ...)",
    inputEmail: "Jouw e-mailadres",
    inputTarget: "Optioneel: mail me onder",
    submit: "Volg deze prijs",
    busy: "Bezig…",
    success: (title: string, price: string | null) => `Je volgt nu "${title}"${price ? ` (nu ${price})` : ""}. We mailen je bij een prijsdaling.`,
    free: "Gratis. Geen account nodig. Afmelden kan met één klik in elke mail.",
    howTitle: "Hoe het werkt",
    how: ["Plak de link van een product en vul je e-mailadres in.", "Wij controleren de prijs meerdere keren per dag.", "Daalt de prijs? Dan krijg je direct een mail."],
    supportedTitle: "Ondersteunde winkels",
    supported: "Amazon (21 landen), bol.com (NL/BE) en elke webshop met standaard productdata, zoals Coolblue, MediaMarkt, Zalando, Otto, Fnac en Currys.",
    dealsTitle: "Grootste prijsdalingen van vandaag",
    dealsLead: "Automatisch bijgewerkt op basis van de producten die onze gebruikers volgen.",
    noDeals: "Nog geen dalingen gemeten in de afgelopen 24 uur.",
    view: "Bekijk",
    current: "Huidige prijs",
    lowest: "Laagste",
    highest: "Hoogste",
    lowestEver: "Laagste prijs ooit",
    measurements: "metingen",
    viewAt: (shop: string) => `Bekijk bij ${shop}`,
    historyTitle: "Prijsverloop",
    noHistory: "Nog te weinig metingen voor een grafiek.",
    noHistoryAllowed: "Voor deze winkel tonen we alleen de actuele prijs.",
    setAlert: "Prijsalert instellen",
    lastChecked: "Laatst gecontroleerd",
    footer: "Prijsdaler is niet verbonden aan de genoemde winkels. Productlinks zijn affiliate-links; bij aankoop ontvangen wij een commissie, jij betaalt niets extra.",
    metaTitle: "Prijsalerts voor Amazon, bol.com en elke webshop",
    metaDesc: "Volg de prijs van elk product. Ontvang een e-mail zodra de prijs daalt. Gratis, zonder account.",
    productMeta: (t: string) => `${t} prijsgeschiedenis & prijsalert`,
    email: {
      subject: (pct: number, title: string, price: string) => `Prijsdaling (-${pct}%): ${title} nu ${price}`,
      heading: "Prijsdaling",
      now: "Nu",
      cta: (shop: string) => `Bekijk bij ${shop}`,
      hint: "Prijzen kunnen snel weer stijgen.",
      history: "Prijsgeschiedenis bekijken",
      footer: "Je ontvangt dit omdat je dit product volgt. Links zijn affiliate-links: bij aankoop ontvangen wij een kleine commissie, jij betaalt niets extra.",
      unsubscribe: "Afmelden",
    },
  },
  en: {
    siteName: "PriceDrop",
    tagline: "Never overpay. At any store.",
    lead: "Paste a product link from Amazon, bol.com or almost any other store. We email you the moment the price drops.",
    navDeals: "Biggest drops",
    inputProduct: "Paste a product link (Amazon, bol.com, Currys, MediaMarkt, ...)",
    inputEmail: "Your email address",
    inputTarget: "Optional: email me below",
    submit: "Track this price",
    busy: "Working…",
    success: (title: string, price: string | null) => `You're now tracking "${title}"${price ? ` (currently ${price})` : ""}. We'll email you when the price drops.`,
    free: "Free. No account needed. Unsubscribe with one click in every email.",
    howTitle: "How it works",
    how: ["Paste a product link and enter your email.", "We check the price several times a day.", "Price dropped? You get an email right away."],
    supportedTitle: "Supported stores",
    supported: "Amazon (21 countries), bol.com (NL/BE) and any store with standard product data, such as Currys, MediaMarkt, Zalando, Otto, Fnac and Coolblue.",
    dealsTitle: "Biggest price drops today",
    dealsLead: "Updated automatically from the products our users track.",
    noDeals: "No drops recorded in the last 24 hours yet.",
    view: "View",
    current: "Current price",
    lowest: "Lowest",
    highest: "Highest",
    lowestEver: "Lowest price ever",
    measurements: "checks",
    viewAt: (shop: string) => `View at ${shop}`,
    historyTitle: "Price history",
    noHistory: "Not enough data for a chart yet.",
    noHistoryAllowed: "For this store we only show the current price.",
    setAlert: "Set a price alert",
    lastChecked: "Last checked",
    footer: "PriceDrop is not affiliated with the stores mentioned. Product links are affiliate links; we may earn a commission on purchases at no extra cost to you.",
    metaTitle: "Price alerts for Amazon, bol.com and any store",
    metaDesc: "Track the price of any product. Get an email when it drops. Free, no account.",
    productMeta: (t: string) => `${t} price history & price alert`,
    email: {
      subject: (pct: number, title: string, price: string) => `Price drop (-${pct}%): ${title} now ${price}`,
      heading: "Price drop",
      now: "Now",
      cta: (shop: string) => `View at ${shop}`,
      hint: "Prices can go back up quickly.",
      history: "View price history",
      footer: "You receive this because you track this product. Links are affiliate links: we may earn a small commission at no extra cost to you.",
      unsubscribe: "Unsubscribe",
    },
  },
  de: {
    siteName: "Preisfall",
    tagline: "Nie wieder zu viel bezahlen. In keinem Shop.",
    lead: "Füge einen Produktlink von Amazon, bol.com oder fast jedem anderen Shop ein. Wir mailen dir, sobald der Preis fällt.",
    navDeals: "Größte Preisstürze",
    inputProduct: "Produktlink einfügen (Amazon, MediaMarkt, Otto, Zalando, ...)",
    inputEmail: "Deine E-Mail-Adresse",
    inputTarget: "Optional: benachrichtige mich unter",
    submit: "Preis verfolgen",
    busy: "Einen Moment…",
    success: (title: string, price: string | null) => `Du verfolgst jetzt „${title}“${price ? ` (aktuell ${price})` : ""}. Wir mailen dir bei einem Preisfall.`,
    free: "Kostenlos. Kein Konto nötig. Abmelden mit einem Klick in jeder E-Mail.",
    howTitle: "So funktioniert es",
    how: ["Produktlink einfügen und E-Mail-Adresse eingeben.", "Wir prüfen den Preis mehrmals täglich.", "Preis gefallen? Du bekommst sofort eine E-Mail."],
    supportedTitle: "Unterstützte Shops",
    supported: "Amazon (21 Länder), bol.com (NL/BE) und jeder Shop mit Standard-Produktdaten wie MediaMarkt, Saturn, Otto, Zalando, Fnac und Currys.",
    dealsTitle: "Größte Preisstürze heute",
    dealsLead: "Automatisch aktualisiert anhand der Produkte, die unsere Nutzer verfolgen.",
    noDeals: "In den letzten 24 Stunden noch keine Preisstürze gemessen.",
    view: "Ansehen",
    current: "Aktueller Preis",
    lowest: "Tiefster",
    highest: "Höchster",
    lowestEver: "Tiefster Preis aller Zeiten",
    measurements: "Messungen",
    viewAt: (shop: string) => `Bei ${shop} ansehen`,
    historyTitle: "Preisverlauf",
    noHistory: "Noch zu wenige Messungen für ein Diagramm.",
    noHistoryAllowed: "Für diesen Shop zeigen wir nur den aktuellen Preis.",
    setAlert: "Preisalarm einrichten",
    lastChecked: "Zuletzt geprüft",
    footer: "Preisfall steht in keiner Verbindung zu den genannten Shops. Produktlinks sind Affiliate-Links; bei einem Kauf erhalten wir eine Provision, für dich ändert sich der Preis nicht.",
    metaTitle: "Preisalarm für Amazon, bol.com und jeden Shop",
    metaDesc: "Verfolge den Preis jedes Produkts. E-Mail, sobald er fällt. Kostenlos, ohne Konto.",
    productMeta: (t: string) => `${t} Preisverlauf & Preisalarm`,
    email: {
      subject: (pct: number, title: string, price: string) => `Preisfall (-${pct}%): ${title} jetzt ${price}`,
      heading: "Preisfall",
      now: "Jetzt",
      cta: (shop: string) => `Bei ${shop} ansehen`,
      hint: "Preise können schnell wieder steigen.",
      history: "Preisverlauf ansehen",
      footer: "Du erhältst diese E-Mail, weil du dieses Produkt verfolgst. Links sind Affiliate-Links: bei einem Kauf erhalten wir eine kleine Provision, für dich ändert sich nichts.",
      unsubscribe: "Abmelden",
    },
  },
} as const;

export type Dict = (typeof dict)[Locale];
export const t = (l: Locale): Dict => dict[l];

export const intlLocale: Record<Locale, string> = { nl: "nl-NL", en: "en-GB", de: "de-DE" };

export function money(amount: number, currency: string, locale: Locale = "en") {
  try {
    return new Intl.NumberFormat(intlLocale[locale], { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Kiest een locale uit een Accept-Language header. */
export function pickLocale(acceptLanguage: string | null): Locale {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

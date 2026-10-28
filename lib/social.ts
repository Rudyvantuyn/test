/** Openbare social-kanalen per land, getoond op de site. */
export const TELEGRAM: Record<string, string> = {
  NL: "https://t.me/pricedropalertNL",
};

/** Welk kanaal past bij een taal (NL/BE -> NL). Valt terug op het eerste beschikbare kanaal. */
export function telegramFor(locale: string): string | null {
  const byLocale: Record<string, string> = { nl: "NL", de: "DE", en: "GB" };
  return TELEGRAM[byLocale[locale] ?? ""] ?? null;
}

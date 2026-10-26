import { bolProvider } from "./bol";
import { amazonProvider } from "./amazon";
import { genericProvider } from "./generic";
import { feedProvider, findFeedOffer, offerToProduct } from "./feed";
import type { PriceProvider, Retailer, ResolvedProduct } from "./types";

export * from "./types";
export { feedDeeplink } from "./feed";

export const providers: Record<Retailer, PriceProvider> = {
  bol: bolProvider, amazon: amazonProvider, feed: feedProvider, generic: genericProvider,
};

/** Kiest de juiste provider voor gebruikersinvoer en lost het product op. */
export async function resolveInput(input: string): Promise<ResolvedProduct> {
  const s = input.trim();
  if (/^\d{13}$/.test(s)) return bolProvider.resolve(s, null);
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new Error("Voer een geldige productlink in");
  }
  const direct = [bolProvider, amazonProvider].find((p) => p.matches(url));
  if (direct) return direct.resolve(s, url);
  // 1) staat de link in een affiliate-feed? (geen HTTP nodig, altijd met deeplink)
  const offer = await findFeedOffer(url).catch(() => null);
  if (offer) return offerToProduct(offer);
  // 2) anders: productdata van de pagina zelf
  return genericProvider.resolve(s, url);
}

export const retailerLabel: Record<Retailer, string> = { bol: "bol.com", amazon: "Amazon", generic: "", feed: "" };

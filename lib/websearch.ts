/**
 * Zoekmachine-API om hetzelfde product bij andere winkels te vinden (Brave Search API).
 * Zonder BRAVE_SEARCH_API_KEY doet deze module niets.
 */
const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export const webSearchConfigured = () => !!process.env.BRAVE_SEARCH_API_KEY;

const SKIP_HOSTS = /(^|\.)(google\.|youtube\.|facebook\.|instagram\.|tiktok\.|reddit\.|tweakers\.net|kieskeurig\.|pricerunner\.|idealo\.|wikipedia\.|pinterest\.|x\.com|twitter\.)/;

export async function searchProductPages(query: string, country: string, ownHost: string, limit = 10): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("country", country.toLowerCase());
  url.searchParams.set("count", "20");
  url.searchParams.set("safesearch", "moderate");
  const res = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": key }, cache: "no-store" }).catch(() => null);
  if (!res?.ok) { console.error("websearch", res?.status); return []; }
  const json = (await res.json()) as { web?: { results?: { url: string }[] } };
  const own = ownHost.replace(/^www\./, "");
  const out: string[] = [], hosts = new Set<string>();
  for (const r of json.web?.results ?? []) {
    let u: URL;
    try { u = new URL(r.url); } catch { continue; }
    const host = u.hostname.replace(/^www\./, "");
    if (host === own || SKIP_HOSTS.test(host) || hosts.has(host)) continue; // per winkel één pagina
    if (u.pathname.length < 5) continue; // homepage
    hosts.add(host);
    out.push(u.toString());
    if (out.length >= limit) break;
  }
  return out;
}

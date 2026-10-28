/**
 * Hetzelfde product bij andere winkels vinden en opslaan, zodat vergelijking en "ook bij andere
 * winkels"-alerts werken. Bronnen: bestaande producten (EAN of productsleutel), feeds, bol (EAN),
 * en de zoekpagina van Coolblue (NL/BE), de enige grote open winkel met server-side zoekresultaten.
 */
import { db, type ProductRow } from "./supabase";
import { matchKey, primaryModel } from "./match";
import { upsertProduct } from "./products";
import { findOffersByEan, COMPARE_COUNTRIES } from "./providers";
import { genericProvider } from "./providers/generic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Andere aanbieders van hetzelfde product die al in de database staan. */
export async function sameProductOffers(p: Pick<ProductRow, "id" | "ean" | "match_key" | "currency">, limit = 40): Promise<ProductRow[]> {
  const ors: string[] = [];
  if (p.ean) ors.push(`ean.eq.${p.ean}`);
  if (p.match_key && !p.match_key.startsWith("-")) ors.push(`match_key.eq.${p.match_key}`); // "-" = geen sleutel
  if (!ors.length) return [];
  let q = db().from("products").select("*").or(ors.join(",")).eq("in_stock", true).not("last_price", "is", null).limit(limit);
  if (p.id) q = q.neq("id", p.id);
  if (p.currency) q = q.eq("currency", p.currency);
  const { data } = await q;
  return (data ?? []) as ProductRow[];
}

async function searchCoolblue(p: ProductRow): Promise<number> {
  if (!["NL", "BE"].includes(p.country) || /coolblue/i.test(p.merchant ?? "") || /coolblue\./.test(p.url)) return 0;
  const key = p.match_key && !p.match_key.startsWith("-") ? p.match_key : matchKey(p.title);
  const model = primaryModel(key);
  if (!key || !model) return 0;
  const brand = key.split("|")[0];
  const res = await fetch(`https://www.coolblue.nl/zoeken?query=${encodeURIComponent(`${brand} ${model}`)}`, {
    headers: { "user-agent": UA, accept: "text/html", "accept-language": "nl-NL,nl;q=0.9" }, cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return 0;
  const html = await res.text();
  const links = [...new Set([...html.matchAll(/https:\/\/www\.coolblue\.nl\/product\/\d+\/[a-z0-9-]+\.html/g)].map((m) => m[0]))]
    .filter((l) => l.replace(/-/g, "").includes(model))
    .slice(0, 4);
  let added = 0;
  for (const link of links) {
    try {
      const r = await genericProvider.resolve(link, new URL(link));
      if (matchKey(r.title) !== key) continue; // alleen exact hetzelfde product (incl. kleur/opslag)
      await upsertProduct(r);
      added++;
    } catch { /* volgende */ }
  }
  return added;
}

/** Zoekt en bewaart andere aanbieders voor een product. Best effort, nooit fataal. */
export async function expandOffers(p: ProductRow): Promise<number> {
  let added = 0;
  try {
    if (p.ean) {
      const found = await findOffersByEan(p.ean, COMPARE_COUNTRIES[p.country] ?? [p.country], { retailer: p.retailer, externalId: p.external_id });
      for (const o of found.slice(0, 20)) { try { await upsertProduct(o); added++; } catch { /* skip */ } }
    }
    added += await searchCoolblue(p);
  } catch (e) { console.error("expandOffers", p.id, e); }
  return added;
}

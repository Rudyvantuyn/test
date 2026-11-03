/** Goedkopere alternatieven: zelfde soort, zelfde kernkenmerk (bv. 55 inch), ander product, lagere prijs. */
import { db, type ProductRow } from "./supabase";
import { comparable, MIN_PRICE_RATIO, specLabel, type Category, type Specs } from "./specs";

export type AltRow = ProductRow & { category: string | null; specs: Specs };

export async function findAlternatives(p: AltRow, limit = 6): Promise<AltRow[]> {
  if (!p.category || p.category.startsWith("-") || p.last_price === null) return [];
  const own = Number(p.last_price) + Number(p.shipping_cost ?? 0);
  const cat = p.category as Category;
  const floor = own * (MIN_PRICE_RATIO[cat] ?? 0.4);
  const { data } = await db().from("products").select("*")
    .eq("category", p.category).eq("in_stock", true).eq("currency", p.currency).neq("id", p.id)
    .lt("last_price", own * 0.98).gte("last_price", floor).order("last_price", { ascending: true }).limit(300);
  const seen = new Set<string>();
  const out = ((data ?? []) as AltRow[]).filter((o) => {
    if (!comparable(cat, p.specs ?? {}, o.specs ?? {})) return false;
    const k = o.match_key && !o.match_key.startsWith("-") ? o.match_key : o.id;
    if (p.match_key && k === p.match_key) return false; // hetzelfde product bij een andere winkel hoort in "vergelijk", niet hier
    // Zelfde model in een andere kleur of bij een andere winkel: één keer tonen (de goedkoopste)
    const model = o.match_key && !o.match_key.startsWith("-") ? o.match_key.split("|").slice(0, 2).join("|") : o.id;
    const ownModel = p.match_key && !p.match_key.startsWith("-") ? p.match_key.split("|").slice(0, 2).join("|") : null;
    if (ownModel && model === ownModel) return false;
    if (seen.has(model)) return false;
    seen.add(model);
    // Slecht beoordeeld (onder 3,5 van 5 bij minstens 5 reviews) is geen goed alternatief
    if (o.rating != null && Number(o.rating) < 3.5 && (o.review_count ?? 0) >= 5) return false;
    return Number(o.last_price) + Number(o.shipping_cost ?? 0) < own * 0.98;
  });
  // Waarde: prijs, licht gecorrigeerd voor beoordeling (4,5 ster = 3% "goedkoper", 3,5 ster = 3% "duurder")
  const value = (o: AltRow) => Number(o.last_price) * (o.rating != null && (o.review_count ?? 0) >= 5 ? 1 - 0.06 * (Number(o.rating) - 4) : 1);
  out.sort((a, b) => value(a) - value(b));
  // Tv's: eerst hetzelfde paneeltype (OLED blijft OLED), dan de rest; binnen een groep op prijs
  if (cat === "tv" && p.specs?.panel) out.sort((a, b) => Number(b.specs?.panel === p.specs.panel) - Number(a.specs?.panel === p.specs.panel) || value(a) - value(b));
  return out.slice(0, limit);
}

/** Compacte vorm voor e-mail en extensie. */
export type AltSummary = { key: string; title: string; shop: string; total: number; currency: string; rating: number | null; reviews: number | null; spec: string };
export function summarize(p: AltRow, alts: AltRow[], shopName: (r: ProductRow) => string, lang = "nl"): AltSummary[] {
  return alts.map((a) => ({
    key: `${a.retailer}-${a.country}-${a.external_id}`, title: a.title, shop: shopName(a),
    total: Number(a.last_price) + Number(a.shipping_cost ?? 0), currency: a.currency,
    rating: a.rating != null ? Number(a.rating) : null, reviews: a.review_count ?? null,
    spec: p.category ? specLabel(p.category as Category, a.specs ?? {}, lang) : "",
  }));
}

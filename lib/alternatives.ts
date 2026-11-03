/** Goedkopere alternatieven: zelfde soort, zelfde kernkenmerk (bv. 55 inch), ander product, lagere prijs. */
import { db, type ProductRow } from "./supabase";
import { comparable, type Category, type Specs } from "./specs";

export type AltRow = ProductRow & { category: string | null; specs: Specs };

export async function findAlternatives(p: AltRow, limit = 6): Promise<AltRow[]> {
  if (!p.category || p.category.startsWith("-") || p.last_price === null) return [];
  const own = Number(p.last_price) + Number(p.shipping_cost ?? 0);
  const { data } = await db().from("products").select("*")
    .eq("category", p.category).eq("in_stock", true).eq("currency", p.currency).neq("id", p.id)
    .lt("last_price", own * 0.98).order("last_price", { ascending: true }).limit(300);
  const cat = p.category as Category;
  const seen = new Set<string>();
  const out = ((data ?? []) as AltRow[]).filter((o) => {
    if (!comparable(cat, p.specs ?? {}, o.specs ?? {})) return false;
    const k = o.match_key && !o.match_key.startsWith("-") ? o.match_key : o.id;
    if (p.match_key && k === p.match_key) return false; // hetzelfde product bij een andere winkel hoort in "vergelijk", niet hier
    if (seen.has(k)) return false; // zelfde product bij meerdere winkels: alleen de goedkoopste
    seen.add(k);
    return Number(o.last_price) + Number(o.shipping_cost ?? 0) < own * 0.98;
  });
  // Tv's: eerst hetzelfde paneeltype (OLED blijft OLED), dan de rest; binnen een groep op prijs
  if (cat === "tv" && p.specs?.panel) out.sort((a, b) => Number(b.specs?.panel === p.specs.panel) - Number(a.specs?.panel === p.specs.panel) || Number(a.last_price) - Number(b.last_price));
  return out.slice(0, limit);
}

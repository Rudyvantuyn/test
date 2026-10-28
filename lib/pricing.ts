import { db, type ProductRow, type WatchRow } from "./supabase";
import { sendPriceDropEmail } from "./email";
import type { OfferSnapshot } from "./providers/types";

const MIN_DROP_PCT = 0.03; // bij "elke daling": alleen mailen vanaf 3%

export type ApplyResult = { drop: boolean; emails: number; errors: number };

/** Actie alleen tonen als de "van"-prijs echt hoger is (min. 2%) en niet absurd (max. 5x). */
export function cleanListPrice(price: number, list: number | null | undefined): number | null {
  if (list == null || !Number.isFinite(list)) return null;
  return list > price * 1.02 && list < price * 5 ? list : null;
}

/**
 * Verwerkt een nieuwe prijsmeting voor een product: geschiedenis, min/max, levering, actie,
 * en bij een daling de e-mails naar alle passende watches (zelfde product of zelfde EAN).
 * Gedeeld door de prijscheck-cron en de browserextensie.
 */
export async function applySnapshot(p: ProductRow, o: OfferSnapshot | null, source = "server", installId: string | null = null): Promise<ApplyResult> {
  const supa = db();
  const now = new Date().toISOString();
  const res: ApplyResult = { drop: false, emails: 0, errors: 0 };
  if (o === null) {
    await supa.from("products").update({ last_checked_at: now, in_stock: false }).eq("id", p.id);
    return res;
  }
  const price = o.price;
  const listPrice = cleanListPrice(price, o.listPrice);
  await supa.from("price_history").insert({ product_id: p.id, price, source, install_id: installId });
  await supa.from("products").update({
    last_price: price, last_checked_at: now,
    lowest_price: p.lowest_price === null ? price : Math.min(Number(p.lowest_price), price),
    highest_price: p.highest_price === null ? price : Math.max(Number(p.highest_price), price),
    shipping_cost: o.shippingCost ?? null, delivery_min_days: o.deliveryMinDays ?? null, delivery_max_days: o.deliveryMaxDays ?? null,
    delivery_text: o.deliveryText ?? null, condition: o.condition ?? p.condition, in_stock: o.inStock ?? true,
    deeplink: o.deeplink ?? p.deeplink, merchant: o.merchant ?? p.merchant,
    list_price: listPrice, promo_until: listPrice ? o.promoUntil ?? null : null,
  }).eq("id", p.id);

  const old = p.last_price !== null ? Number(p.last_price) : null;
  if (old === null || price >= old || o.inStock === false) return res;
  res.drop = true;

  const { data: watches } = await supa.rpc("watches_for_product", { p_id: p.id });
  const updated: ProductRow = {
    ...p, last_price: price, shipping_cost: o.shippingCost ?? null, delivery_min_days: o.deliveryMinDays ?? null,
    delivery_max_days: o.deliveryMaxDays ?? null, merchant: o.merchant ?? p.merchant, condition: o.condition ?? p.condition,
  };
  for (const w of (watches ?? []) as WatchRow[]) {
    const wants = w.mode === "below"
      ? w.target_price !== null && price + Number(o.shippingCost ?? 0) <= Number(w.target_price)
      : (old - price) / old >= MIN_DROP_PCT;
    const alreadyTold = w.last_notified_price !== null && price >= Number(w.last_notified_price);
    if (!wants || alreadyTold) continue;
    try {
      await sendPriceDropEmail(w, updated, `${p.retailer}-${p.country}-${p.external_id}`, old, price);
      await supa.from("watches").update({ last_notified_price: price, last_notified_at: now }).eq("id", w.id);
      res.emails++;
    } catch (err) { res.errors++; console.error("mail", w.id, err); }
  }
  return res;
}

import { db, type ProductRow } from "./supabase";
import type { ResolvedProduct } from "./providers/types";
import { cleanListPrice, notifyNewOffer } from "./pricing";
import { matchKey } from "./match";

/** Slaat een opgelost product op (upsert) incl. eerste prijspunt; geeft id + min/max terug. */
export async function upsertProduct(r: ResolvedProduct, source = "server") {
  const supa = db();
  const now = new Date().toISOString();
  const { data: existing } = await supa.from("products").select("id").match({ retailer: r.retailer, country: r.country, external_id: r.externalId }).maybeSingle();
  const { data: prod, error } = await supa
    .from("products")
    .upsert(
      {
        retailer: r.retailer, country: r.country, external_id: r.externalId, ean: r.ean ?? null,
        title: r.title, url: r.url, image_url: r.imageUrl ?? null, currency: r.currency, match_key: matchKey(r.title),
        merchant: r.merchant ?? null, shipping_cost: r.shippingCost ?? null,
        delivery_min_days: r.deliveryMinDays ?? null, delivery_max_days: r.deliveryMaxDays ?? null,
        delivery_text: r.deliveryText ?? null, condition: r.condition ?? null, in_stock: r.inStock ?? true,
        deeplink: r.deeplink ?? null, last_price: r.price, last_checked_at: now,
        list_price: cleanListPrice(r.price, r.listPrice), promo_until: cleanListPrice(r.price, r.listPrice) ? r.promoUntil ?? null : null,
      },
      { onConflict: "retailer,country,external_id" },
    )
    .select("id,lowest_price,highest_price")
    .single();
  if (error) throw error;
  await supa.from("price_history").insert({ product_id: prod.id, price: r.price, source });
  await supa.from("products").update({
    lowest_price: prod.lowest_price === null ? r.price : Math.min(Number(prod.lowest_price), r.price),
    highest_price: prod.highest_price === null ? r.price : Math.max(Number(prod.highest_price), r.price),
  }).eq("id", prod.id);
  if (!existing) {
    // Nieuwe aanbieder: wie hetzelfde product elders volgt, hoort het als het hier goedkoper is
    const { data: full } = await supa.from("products").select("*").eq("id", prod.id).single();
    if (full) await notifyNewOffer(full as ProductRow).catch((e) => console.error("notifyNewOffer", e));
  }
  return prod.id as string;
}


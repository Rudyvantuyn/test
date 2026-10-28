import { db } from "./supabase";
import { isLocale } from "./i18n";
import type { PendingSourceError } from "./providers/types";

export type WatchOpts = {
  email: string; locale?: string; targetPrice: number | null; maxDeliveryDays: number | null;
  anyRetailer: boolean; conditionFilter: string | null;
};

export async function createWatch(productId: string, ean: string | null | undefined, o: WatchOpts) {
  const { data, error } = await db()
    .from("watches")
    .upsert(
      {
        email: o.email.toLowerCase(), product_id: productId, locale: o.locale && isLocale(o.locale) ? o.locale : "en",
        ean: ean ?? null, any_retailer: o.anyRetailer && !!ean, max_delivery_days: o.maxDeliveryDays,
        condition_filter: o.conditionFilter, target_price: o.targetPrice, mode: o.targetPrice ? "below" : "any_drop", active: true,
      },
      { onConflict: "email,product_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function savePending(e: PendingSourceError, o: WatchOpts) {
  const { error } = await db().from("pending_watches").upsert(
    {
      email: o.email.toLowerCase(), url: e.url, retailer: e.retailer, country: e.country, external_id: e.externalId,
      locale: o.locale && isLocale(o.locale) ? o.locale : "en", target_price: o.targetPrice, max_delivery_days: o.maxDeliveryDays,
      condition_filter: o.conditionFilter, processed_at: null, last_error: null,
    },
    { onConflict: "email,url" },
  );
  if (error) throw error;
}

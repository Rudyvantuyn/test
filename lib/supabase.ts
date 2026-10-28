import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Retailer } from "./providers/types";

let client: SupabaseClient | null = null;

/** Server-side Supabase client met service role (nooit naar de browser sturen). */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreken");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type ProductRow = {
  id: string;
  retailer: Retailer;
  country: string;
  external_id: string;
  ean: string | null;
  title: string;
  url: string;
  image_url: string | null;
  currency: string;
  last_price: number | null;
  lowest_price: number | null;
  highest_price: number | null;
  last_checked_at: string | null;
  created_at: string;
  merchant: string | null;
  shipping_cost: number | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  delivery_text: string | null;
  condition: "new" | "used" | "refurbished" | null;
  in_stock: boolean;
  deeplink: string | null;
  list_price: number | null;
  promo_until: string | null;
};

export type WatchRow = {
  id: string;
  email: string;
  product_id: string;
  locale: string;
  target_price: number | null;
  mode: "below" | "any_drop";
  unsubscribe_token: string;
  active: boolean;
  last_notified_price: number | null;
  last_notified_at: string | null;
  created_at: string;
  ean: string | null;
  any_retailer: boolean;
  max_delivery_days: number | null;
  condition_filter: "new" | "used" | "refurbished" | null;
};

export type PriceRow = { price: number; checked_at: string };

export type DropRow = {
  product_id: string;
  retailer: Retailer;
  country: string;
  external_id: string;
  title: string;
  url: string;
  image_url: string | null;
  currency: string;
  ean: string | null;
  merchant: string | null;
  shipping_cost: number | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  condition: "new" | "used" | "refurbished" | null;
  in_stock: boolean;
  old_price: number;
  new_price: number;
  total_price: number;
  drop_pct: number;
  list_price: number | null;
};

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-side Supabase client met service role (nooit naar de browser sturen). */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreken");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type ProductRow = {
  ean: string;
  bol_product_id: string | null;
  title: string;
  url: string;
  image_url: string | null;
  last_price: number | null;
  lowest_price: number | null;
  highest_price: number | null;
  last_checked_at: string | null;
  created_at: string;
};

export type WatchRow = {
  id: string;
  email: string;
  ean: string;
  target_price: number | null;
  mode: "below" | "any_drop";
  unsubscribe_token: string;
  active: boolean;
  last_notified_price: number | null;
  last_notified_at: string | null;
  created_at: string;
};

export type PriceRow = { ean: string; price: number; checked_at: string };

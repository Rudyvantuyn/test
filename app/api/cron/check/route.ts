import { NextResponse } from "next/server";
import { db, type ProductRow, type WatchRow } from "@/lib/supabase";
import { providers, type Retailer } from "@/lib/providers";
import { sendPriceDropEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300;

const MIN_DROP_PCT = 0.03; // bij "elke daling": alleen mailen vanaf 3%

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const retailer = new URL(req.url).searchParams.get("retailer") as Retailer | null;
  const list: Retailer[] = retailer && providers[retailer] ? [retailer] : (Object.keys(providers) as Retailer[]);
  const supa = db();
  const stats: Record<string, { due: number; checked: number; drops: number; emails: number; errors: number }> = {};

  for (const rid of list) {
    const provider = providers[rid];
    const s = (stats[rid] = { due: 0, checked: 0, drops: 0, emails: 0, errors: 0 });
    const { data, error } = await supa.rpc("products_due", { p_retailer: rid, p_limit: provider.batchLimit });
    if (error) { s.errors++; console.error("products_due", rid, error); continue; }
    const products = (data ?? []) as ProductRow[];
    s.due = products.length;
    if (!products.length) continue;

    const prices = await provider.fetchPrices(products.map((p) => ({ retailer: rid, country: p.country, externalId: p.external_id, url: p.url })));
    const now = new Date().toISOString();

    for (const p of products) {
      if (!prices.has(p.external_id)) continue; // fout: later opnieuw
      const price = prices.get(p.external_id)!;
      s.checked++;
      try {
        if (price === null) { await supa.from("products").update({ last_checked_at: now }).eq("id", p.id); continue; }
        await supa.from("price_history").insert({ product_id: p.id, price });
        await supa.from("products").update({
          last_price: price, last_checked_at: now,
          lowest_price: p.lowest_price === null ? price : Math.min(Number(p.lowest_price), price),
          highest_price: p.highest_price === null ? price : Math.max(Number(p.highest_price), price),
        }).eq("id", p.id);

        const old = p.last_price !== null ? Number(p.last_price) : null;
        if (old === null || price >= old) continue;
        s.drops++;

        const { data: watches } = await supa.from("watches").select("*").eq("product_id", p.id).eq("active", true);
        for (const w of (watches ?? []) as WatchRow[]) {
          const wants = w.mode === "below"
            ? w.target_price !== null && price <= Number(w.target_price)
            : (old - price) / old >= MIN_DROP_PCT;
          const alreadyTold = w.last_notified_price !== null && price >= Number(w.last_notified_price);
          if (!wants || alreadyTold) continue;
          try {
            await sendPriceDropEmail(w, p, `${rid}-${p.country}-${p.external_id}`, old, price);
            await supa.from("watches").update({ last_notified_price: price, last_notified_at: now }).eq("id", w.id);
            s.emails++;
          } catch (err) { s.errors++; console.error("mail", w.id, err); }
        }
      } catch (err) { s.errors++; console.error("check", p.id, err); }
    }
  }
  return NextResponse.json(stats);
}

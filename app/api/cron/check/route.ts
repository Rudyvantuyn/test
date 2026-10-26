import { NextResponse } from "next/server";
import { db, type ProductRow, type WatchRow } from "@/lib/supabase";
import { BolApiError, getBestOffer } from "@/lib/bol";
import { sendPriceDropEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Max. producten per run; bol limiet is 1200 calls/uur. */
const BATCH = 400;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supa = db();

  // Producten met actieve watchers, oudste check eerst
  const { data: eans, error: e1 } = await supa.from("watches").select("ean").eq("active", true);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const uniqueEans = [...new Set((eans ?? []).map((r) => r.ean))];
  if (uniqueEans.length === 0) return NextResponse.json({ checked: 0 });

  const { data: products, error: e2 } = await supa
    .from("products")
    .select("*")
    .in("ean", uniqueEans)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  let checked = 0, drops = 0, emails = 0, errors = 0;
  const now = new Date().toISOString();

  for (const p of (products ?? []) as ProductRow[]) {
    try {
      let price: number | null;
      try {
        price = (await getBestOffer(p.ean)).price;
      } catch (err) {
        if (err instanceof BolApiError && err.status === 404) price = null; // niet leverbaar
        else if (err instanceof BolApiError && err.status === 429) break; // stop deze run
        else throw err;
      }
      checked++;
      if (price === null) {
        await supa.from("products").update({ last_checked_at: now }).eq("ean", p.ean);
        continue;
      }
      await supa.from("price_history").insert({ ean: p.ean, price });
      const old = p.last_price !== null ? Number(p.last_price) : null;
      await supa
        .from("products")
        .update({
          last_price: price,
          last_checked_at: now,
          lowest_price: p.lowest_price === null ? price : Math.min(Number(p.lowest_price), price),
          highest_price: p.highest_price === null ? price : Math.max(Number(p.highest_price), price),
        })
        .eq("ean", p.ean);

      if (old === null || price >= old) continue;
      drops++;

      const { data: watches } = await supa.from("watches").select("*").eq("ean", p.ean).eq("active", true);
      for (const w of (watches ?? []) as WatchRow[]) {
        const wantsIt =
          w.mode === "below"
            ? w.target_price !== null && price <= Number(w.target_price)
            : (old - price) / old >= 0.03; // alleen dalingen >= 3% mailen bij "elke daling"
        // niet opnieuw mailen voor dezelfde of hogere prijs dan de laatste melding
        const alreadyTold = w.last_notified_price !== null && price >= Number(w.last_notified_price);
        if (!wantsIt || alreadyTold) continue;
        try {
          await sendPriceDropEmail({
            to: w.email,
            title: p.title,
            ean: p.ean,
            oldPrice: old,
            newPrice: price,
            watchId: w.id,
            unsubscribeToken: w.unsubscribe_token,
            imageUrl: p.image_url,
          });
          emails++;
          await supa
            .from("watches")
            .update({ last_notified_price: price, last_notified_at: now })
            .eq("id", w.id);
        } catch (mailErr) {
          errors++;
          console.error("mail error", w.id, mailErr);
        }
      }
    } catch (err) {
      errors++;
      console.error("check error", p.ean, err);
    }
  }

  return NextResponse.json({ checked, drops, emails, errors, total: uniqueEans.length });
}

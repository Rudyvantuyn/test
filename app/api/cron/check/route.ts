import { NextResponse } from "next/server";
import { db, type ProductRow } from "@/lib/supabase";
import { providers, type Retailer } from "@/lib/providers";
import { applySnapshot } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const offers = await provider.fetchOffers(products.map((p) => ({ retailer: rid, country: p.country, externalId: p.external_id, url: p.url })));

    for (const p of products) {
      if (!offers.has(p.external_id)) continue; // fout: later opnieuw
      s.checked++;
      try {
        const r = await applySnapshot(p, offers.get(p.external_id)!);
        if (r.drop) s.drops++;
        s.emails += r.emails; s.errors += r.errors;
      } catch (err) { s.errors++; console.error("check", p.id, err); }
    }
  }
  return NextResponse.json(stats);
}

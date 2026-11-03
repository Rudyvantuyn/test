import { db, type ProductRow } from "@/lib/supabase";
import { parseKey } from "@/lib/providers";
import { expandOffers, sameProductOffers } from "@/lib/compare";

export const runtime = "nodejs";
export const maxDuration = 45;

/** Op verzoek andere aanbieders zoeken voor een product (max. 1x per 12 uur per product). */
export async function POST(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const k = parseKey(key);
  if (!k) return Response.json({ error: "not found" }, { status: 404 });
  const { data } = await db().from("products").select("*").match({ retailer: k.retailer, country: k.country, external_id: k.externalId }).maybeSingle();
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  const p = data as ProductRow;
  const recent = p.last_compared_at && Date.now() - +new Date(p.last_compared_at) < 12 * 3600_000;
  let added = 0;
  if (!recent) added = await Promise.race([expandOffers(p), new Promise<number>((res) => setTimeout(() => res(0), 35_000))]);
  const offers = await sameProductOffers(p);
  return Response.json({ searched: !recent, added, offers: offers.length });
}

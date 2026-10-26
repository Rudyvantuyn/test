import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { parseKey, providers } from "@/lib/providers";

export const runtime = "nodejs";

/** Redirect via affiliate-link van de juiste winkel/land en registreer de klik. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const k = parseKey(key);
  if (!k) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const watchId = url.searchParams.get("w");
  const source = url.searchParams.get("src") ?? (watchId ? "email" : "web");
  const supa = db();
  const { data: p } = await supa.from("products").select("id,url,deeplink").match({ retailer: k.retailer, country: k.country, external_id: k.externalId }).single();
  if (!p) return new NextResponse("Not found", { status: 404 });
  supa.from("clicks").insert({ product_id: p.id, watch_id: watchId, source }).then(() => undefined, () => undefined);
  const target = p.deeplink || providers[k.retailer].affiliateLink({ ...k, url: p.url }, source);
  return NextResponse.redirect(target, 302);
}

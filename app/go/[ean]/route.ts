import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { affiliateLink } from "@/lib/bol";

export const runtime = "nodejs";

/** Redirect via affiliate-link en registreer de klik. */
export async function GET(req: Request, ctx: { params: Promise<{ ean: string }> }) {
  const { ean } = await ctx.params;
  if (!/^\d{13}$/.test(ean)) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const watchId = url.searchParams.get("w");
  const source = url.searchParams.get("src") ?? (watchId ? "email" : "web");
  const supa = db();
  const { data: p } = await supa.from("products").select("url").eq("ean", ean).single();
  if (!p) return new NextResponse("Not found", { status: 404 });
  supa.from("clicks").insert({ ean, watch_id: watchId, source }).then(() => undefined, () => undefined);
  return NextResponse.redirect(affiliateLink(p.url, source), 302);
}

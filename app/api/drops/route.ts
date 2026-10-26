import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON-feed van de grootste dalers; handig voor social-automatisering (Metricool, Zapier, n8n). */
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { data, error } = await db().from("top_drops_24h").select("*").limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((d) => ({ ...d, link: `${base}/go/${d.ean}?src=social`, page: `${base}/p/${d.ean}` })),
  );
}

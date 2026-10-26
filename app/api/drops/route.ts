import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON-feed van de grootste dalers (optioneel ?country=DE), voor social-automatisering. */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const country = new URL(req.url).searchParams.get("country");
  let q = db().from("top_drops_24h").select("*").limit(20);
  if (country && /^[A-Z]{2}$/.test(country)) q = q.eq("country", country);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((d) => {
      const key = `${d.retailer}-${d.country}-${d.external_id}`;
      return { ...d, key, link: `${base}/go/${key}?src=social`, page: `${base}/en/p/${key}` };
    }),
  );
}

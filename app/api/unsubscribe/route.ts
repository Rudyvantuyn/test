import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) return new NextResponse("Ongeldige link", { status: 400 });
  const { data, error } = await db()
    .from("watches")
    .update({ active: false })
    .eq("unsubscribe_token", t)
    .select("id");
  if (error || !data?.length) return new NextResponse("Afmelding niet gevonden", { status: 404 });
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px"><h2>Je bent afgemeld</h2><p>Je ontvangt geen prijsalerts meer voor dit product.</p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

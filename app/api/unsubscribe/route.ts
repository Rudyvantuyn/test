import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return new NextResponse("Invalid link", { status: 400 });
  const { data, error } = await db().from("watches").update({ active: false }).eq("unsubscribe_token", token).select("id");
  if (error || !data?.length) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px"><h2>Unsubscribed / Afgemeld / Abgemeldet</h2><p>You will no longer receive alerts for this product.</p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

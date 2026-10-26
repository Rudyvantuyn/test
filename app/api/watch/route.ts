import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { BolApiError, getProduct, mainImageUrl, resolveEan } from "@/lib/bol";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  product: z.string().min(5, "Voer een bol.com link of EAN in"),
  targetPrice: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});

export async function POST(req: Request) {
  const raw = req.headers.get("content-type")?.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" }, { status: 400 });
  }
  const { email, product, targetPrice } = parsed.data;

  try {
    const ean = await resolveEan(product);
    const p = await getProduct(ean);
    const price = p.offer?.price ?? null;
    const supa = db();

    // upsert product + eerste prijspunt
    const { error: pe } = await supa.from("products").upsert(
      {
        ean,
        bol_product_id: p.bolProductId,
        title: p.title,
        url: p.url,
        image_url: mainImageUrl(p),
        ...(price !== null
          ? { last_price: price, last_checked_at: new Date().toISOString() }
          : {}),
      },
      { onConflict: "ean" },
    );
    if (pe) throw pe;
    if (price !== null) {
      await supa.from("price_history").insert({ ean, price });
      await supa
        .from("products")
        .update({
          lowest_price: price, // wordt door cron bijgewerkt met min()
        })
        .eq("ean", ean)
        .is("lowest_price", null);
      await supa.from("products").update({ highest_price: price }).eq("ean", ean).is("highest_price", null);
    }

    const { data: watch, error: we } = await supa
      .from("watches")
      .upsert(
        {
          email: email.toLowerCase(),
          ean,
          target_price: targetPrice ?? null,
          mode: targetPrice ? "below" : "any_drop",
          active: true,
        },
        { onConflict: "email,ean" },
      )
      .select("id")
      .single();
    if (we) throw we;

    return NextResponse.json({ ok: true, ean, title: p.title, price, watchId: watch.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    const status = e instanceof BolApiError ? (e.status === 404 ? 404 : 502) : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

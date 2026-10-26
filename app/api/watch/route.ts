import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { ProviderError, key as productKey, resolveInput } from "@/lib/providers";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  email: z.string().email(),
  product: z.string().min(5),
  locale: z.string().optional(),
  targetPrice: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
});

export async function POST(req: Request) {
  const raw = req.headers.get("content-type")?.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, product, locale } = parsed.data;
  const targetPrice = typeof parsed.data.targetPrice === "number" ? parsed.data.targetPrice : null;

  try {
    const r = await resolveInput(product);
    const supa = db();
    const { data: prod, error: pe } = await supa
      .from("products")
      .upsert(
        {
          retailer: r.retailer, country: r.country, external_id: r.externalId, ean: r.ean ?? null,
          title: r.title, url: r.url, image_url: r.imageUrl ?? null, currency: r.currency,
          ...(r.price !== null ? { last_price: r.price, last_checked_at: new Date().toISOString() } : {}),
        },
        { onConflict: "retailer,country,external_id" },
      )
      .select("id,lowest_price,highest_price")
      .single();
    if (pe) throw pe;

    if (r.price !== null) {
      await supa.from("price_history").insert({ product_id: prod.id, price: r.price });
      await supa.from("products").update({
        lowest_price: prod.lowest_price === null ? r.price : Math.min(Number(prod.lowest_price), r.price),
        highest_price: prod.highest_price === null ? r.price : Math.max(Number(prod.highest_price), r.price),
      }).eq("id", prod.id);
    }

    const { data: watch, error: we } = await supa
      .from("watches")
      .upsert(
        {
          email: email.toLowerCase(), product_id: prod.id, locale: locale && isLocale(locale) ? locale : "en",
          target_price: targetPrice, mode: targetPrice ? "below" : "any_drop", active: true,
        },
        { onConflict: "email,product_id" },
      )
      .select("id")
      .single();
    if (we) throw we;

    return NextResponse.json({ ok: true, key: productKey(r), title: r.title, price: r.price, currency: r.currency, watchId: watch.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = e instanceof ProviderError ? (e.status >= 400 && e.status < 500 ? e.status : 502) : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

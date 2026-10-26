import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { upsertProduct } from "@/lib/products";
import { COMPARE_COUNTRIES, ProviderError, findOffersByEan, key as productKey, resolveInput, type ResolvedProduct } from "@/lib/providers";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  email: z.string().email(),
  product: z.string().min(5),
  locale: z.string().optional(),
  targetPrice: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
  maxDeliveryDays: z.union([z.coerce.number().int().min(0).max(60), z.literal("")]).optional(),
  anyRetailer: z.union([z.boolean(), z.enum(["on", "true", "false", ""])]).optional(),
  conditionFilter: z.enum(["new", "used", "refurbished", ""]).optional(),
});

export async function POST(req: Request) {
  const raw = req.headers.get("content-type")?.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, product, locale } = parsed.data;
  const targetPrice = typeof parsed.data.targetPrice === "number" ? parsed.data.targetPrice : null;
  const maxDeliveryDays = typeof parsed.data.maxDeliveryDays === "number" ? parsed.data.maxDeliveryDays : null;
  const anyRetailer = parsed.data.anyRetailer === undefined || parsed.data.anyRetailer === "" ? true : parsed.data.anyRetailer === true || parsed.data.anyRetailer === "on" || parsed.data.anyRetailer === "true";
  const conditionFilter = parsed.data.conditionFilter || null;

  try {
    const r = await resolveInput(product);
    const productId = await upsertProduct(r);

    // Zelfde product bij andere winkels/landen ophalen voor de vergelijking (best effort, max ~10s)
    let others = 0;
    if (r.ean) {
      const countries = COMPARE_COUNTRIES[r.country] ?? [r.country];
      const found = await Promise.race([
        findOffersByEan(r.ean, countries, { retailer: r.retailer, externalId: r.externalId }),
        new Promise<ResolvedProduct[]>((res) => setTimeout(() => res([]), 10_000)),
      ]);
      for (const o of found.slice(0, 25)) { try { await upsertProduct(o); others++; } catch (e) { console.error("upsert other", e); } }
    }

    const { data: watch, error: we } = await db()
      .from("watches")
      .upsert(
        {
          email: email.toLowerCase(), product_id: productId, locale: locale && isLocale(locale) ? locale : "en",
          ean: r.ean ?? null, any_retailer: anyRetailer && !!r.ean, max_delivery_days: maxDeliveryDays,
          condition_filter: conditionFilter, target_price: targetPrice, mode: targetPrice ? "below" : "any_drop", active: true,
        },
        { onConflict: "email,product_id" },
      )
      .select("id")
      .single();
    if (we) throw we;

    return NextResponse.json({ ok: true, key: productKey(r), title: r.title, price: r.price, currency: r.currency, watchId: watch.id, others });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = e instanceof ProviderError ? (e.status >= 400 && e.status < 500 ? e.status : 502) : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { upsertProduct } from "@/lib/products";
import { createWatch, savePending } from "@/lib/watches";
import { COMPARE_COUNTRIES, PendingSourceError, ProviderError, findOffersByEan, key as productKey, resolveInput, retailerLabel, type ResolvedProduct } from "@/lib/providers";
import { isLocale, t } from "@/lib/i18n";

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

    const watchId = await createWatch(productId, r.ean, { email, locale, targetPrice, maxDeliveryDays, anyRetailer, conditionFilter });

    return NextResponse.json({ ok: true, key: productKey(r), title: r.title, price: r.price, currency: r.currency, watchId, others });
  } catch (e) {
    if (e instanceof PendingSourceError) {
      const loc = locale && isLocale(locale) ? locale : "en";
      try { await savePending(e, { email, locale: loc, targetPrice, maxDeliveryDays, anyRetailer, conditionFilter }); }
      catch (pe) { return NextResponse.json({ error: pe instanceof Error ? pe.message : "error" }, { status: 500 }); }
      return NextResponse.json({ ok: true, pending: true, message: t(loc).pending(retailerLabel[e.retailer] || e.retailer) }, { status: 202 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = e instanceof ProviderError ? (e.status >= 400 && e.status < 500 ? e.status : 502) : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

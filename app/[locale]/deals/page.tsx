import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Filters, { type FilterState } from "@/app/components/Filters";
import { db, type DropRow } from "@/lib/supabase";
import { isLocale, money, t } from "@/lib/i18n";
import { retailerLabel } from "@/lib/providers";
import { deliveryLabel } from "@/lib/delivery";
import { ALL_COUNTRIES } from "@/lib/retailers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: t(locale).dealsTitle, description: t(locale).dealsLead };
}

export default async function Deals({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<FilterState> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const f = await searchParams;
  const d = t(locale);
  let drops: DropRow[] = [];
  try {
    let q = db().from("top_drops_24h").select("*").limit(100);
    if (f.country && /^[A-Z]{2}$/.test(f.country)) q = q.eq("country", f.country);
    if (f.retailer && /^[a-z]+$/.test(f.retailer)) q = q.eq("retailer", f.retailer);
    if (f.delivery && /^\d+$/.test(f.delivery)) q = q.lte("delivery_max_days", Number(f.delivery));
    if (f.condition && /^(new|used|refurbished)$/.test(f.condition)) q = q.eq("condition", f.condition);
    if (f.maxPrice && /^\d+(\.\d+)?$/.test(f.maxPrice)) q = q.lte("total_price", Number(f.maxPrice));
    if (f.minDrop && /^\d+$/.test(f.minDrop)) q = q.gte("drop_pct", Number(f.minDrop));
    const sort = f.sort ?? "drop";
    q = sort === "price" ? q.order("new_price", { ascending: true })
      : sort === "total" ? q.order("total_price", { ascending: true })
      : sort === "fast" ? q.order("delivery_max_days", { ascending: true, nullsFirst: false }).order("drop_pct", { ascending: false })
      : q.order("drop_pct", { ascending: false });
    drops = ((await q).data ?? []) as DropRow[];
  } catch (e) {
    console.error("deals: database unavailable", e);
  }
  return (
    <>
      <h1>{d.dealsTitle}</h1>
      <p className="lead">{d.dealsLead}</p>
      <Filters d={d} countries={ALL_COUNTRIES} f={f} action={`/${locale}/deals`} />
      {drops.length === 0 && <p className="muted">{d.noDeals}</p>}
      {drops.map((x) => {
        const key = `${x.retailer}-${x.country}-${x.external_id}`;
        const shop = x.merchant || retailerLabel[x.retailer] || new URL(x.url).hostname.replace(/^www\./, "");
        const del = deliveryLabel(x.delivery_min_days, x.delivery_max_days, locale);
        return (
          <div className="card" key={x.product_id}>
            {x.image_url && <img src={x.image_url} alt="" />}
            <div style={{ flex: 1 }}>
              <span className="tag">{shop} · {x.country}</span>
              {del && <span className="tag">{del}</span>}
              {x.condition && x.condition !== "new" && <span className="tag">{x.condition}</span>}
              <Link href={`/${locale}/p/${key}`}>{x.title}</Link>
              <div>
                <span className="price">{money(Number(x.new_price), x.currency, locale)}</span>
                <span className="old">{money(Number(x.old_price), x.currency, locale)}</span>{" "}
                <span className="badge">-{Number(x.drop_pct).toFixed(0)}%</span>
                {x.shipping_cost !== null && Number(x.shipping_cost) > 0 && <small> + {money(Number(x.shipping_cost), x.currency, locale)}</small>}
              </div>
            </div>
            <a className="btn" href={`/go/${key}?src=deals`} rel="nofollow sponsored">{d.view}</a>
          </div>
        );
      })}
    </>
  );
}

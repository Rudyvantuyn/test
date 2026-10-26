import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type DropRow } from "@/lib/supabase";
import { isLocale, money, t } from "@/lib/i18n";
import { retailerLabel } from "@/lib/providers";

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: t(locale).dealsTitle, description: t(locale).dealsLead };
}

const COUNTRIES = ["NL", "BE", "DE", "GB", "US", "FR", "ES", "IT"];

export default async function Deals({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ country?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { country } = await searchParams;
  const d = t(locale);
  let drops: DropRow[] = [];
  try {
    let q = db().from("top_drops_24h").select("*").limit(50);
    if (country && /^[A-Z]{2}$/.test(country)) q = q.eq("country", country);
    drops = ((await q).data ?? []) as DropRow[];
  } catch (e) {
    console.error("deals: database unavailable", e);
  }
  return (
    <>
      <h1>{d.dealsTitle}</h1>
      <p className="lead">{d.dealsLead}</p>
      <div className="filters">
        <Link href={`/${locale}/deals`} className={!country ? "on" : ""}>All</Link>
        {COUNTRIES.map((c) => (
          <Link key={c} href={`/${locale}/deals?country=${c}`} className={country === c ? "on" : ""}>{c}</Link>
        ))}
      </div>
      {drops.length === 0 && <p className="muted">{d.noDeals}</p>}
      {drops.map((x) => {
        const key = `${x.retailer}-${x.country}-${x.external_id}`;
        const shop = retailerLabel[x.retailer] || new URL(x.url).hostname.replace(/^www\./, "");
        return (
          <div className="card" key={x.product_id}>
            {x.image_url && <img src={x.image_url} alt="" />}
            <div style={{ flex: 1 }}>
              <span className="tag">{shop} · {x.country}</span>
              <Link href={`/${locale}/p/${key}`}>{x.title}</Link>
              <div>
                <span className="price">{money(Number(x.new_price), x.currency, locale)}</span>
                <span className="old">{money(Number(x.old_price), x.currency, locale)}</span>{" "}
                <span className="badge">-{Number(x.drop_pct).toFixed(0)}%</span>
              </div>
            </div>
            <a className="btn" href={`/go/${key}?src=deals`} rel="nofollow sponsored">{d.view}</a>
          </div>
        );
      })}
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchForm from "@/app/components/WatchForm";
import { formLabels } from "@/lib/formLabels";
import { isLocale, money, t, type Locale } from "@/lib/i18n";
import { parseKey, providers, retailerLabel } from "@/lib/providers";
import { db, type PriceRow, type ProductRow } from "@/lib/supabase";

export const revalidate = 1800;

async function load(key: string) {
  const k = parseKey(key);
  if (!k) return null;
  const supa = db();
  const { data: p } = await supa.from("products").select("*").match({ retailer: k.retailer, country: k.country, external_id: k.externalId }).single();
  if (!p) return null;
  const product = p as ProductRow;
  const showHistory = providers[product.retailer].showHistory;
  const h = showHistory
    ? ((await supa.from("price_history").select("price,checked_at").eq("product_id", product.id).order("checked_at", { ascending: true }).limit(500)).data ?? [])
    : [];
  return { p: product, h: h as PriceRow[], showHistory };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; key: string }> }): Promise<Metadata> {
  const { locale, key } = await params;
  if (!isLocale(locale)) return {};
  const d = await load(key).catch(() => null);
  if (!d) return { title: "404" };
  const dict = t(locale);
  return {
    title: dict.productMeta(d.p.title),
    description: `${dict.current}: ${d.p.last_price !== null ? money(Number(d.p.last_price), d.p.currency, locale) : "–"}. ${dict.lowest}: ${d.p.lowest_price !== null ? money(Number(d.p.lowest_price), d.p.currency, locale) : "–"}. ${dict.metaDesc}`,
  };
}

function Chart({ h, currency, locale }: { h: PriceRow[]; currency: string; locale: Locale }) {
  const W = 720, H = 220, pad = 36;
  const prices = h.map((r) => Number(r.price));
  const min = Math.min(...prices), max = Math.max(...prices), span = max - min || 1;
  const t0 = +new Date(h[0].checked_at), t1 = +new Date(h[h.length - 1].checked_at);
  const pts = h.map((r) => {
    const x = pad + ((+new Date(r.checked_at) - t0) / (t1 - t0 || 1)) * (W - pad * 2);
    const y = H - pad - ((Number(r.price) - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <text x={4} y={pad} fontSize="12" fill="currentColor">{money(max, currency, locale)}</text>
      <text x={4} y={H - pad + 4} fontSize="12" fill="currentColor">{money(min, currency, locale)}</text>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  if (!isLocale(locale)) notFound();
  const data = await load(key).catch(() => null);
  if (!data) notFound();
  const { p, h, showHistory } = data;
  const d = t(locale);
  const fmt = (n: number | null) => (n !== null ? money(Number(n), p.currency, locale) : "–");
  const cur = p.last_price !== null ? Number(p.last_price) : null;
  const low = p.lowest_price !== null ? Number(p.lowest_price) : null;
  const shop = retailerLabel[p.retailer] || new URL(p.url).hostname.replace(/^www\./, "");
  return (
    <>
      <span className="tag">{shop} · {p.country}</span>
      <h1>{p.title}</h1>
      <div className="card">
        {p.image_url && <img src={p.image_url} alt="" />}
        <div>
          <div>
            {d.current}: <span className="price">{fmt(cur)}</span>{" "}
            {cur !== null && low !== null && cur <= low && h.length > 1 && <span className="badge">{d.lowestEver}</span>}
          </div>
          {showHistory && (
            <div className="muted">{d.lowest}: {fmt(low)} · {d.highest}: {fmt(p.highest_price)} · {h.length} {d.measurements}</div>
          )}
          <p style={{ margin: "10px 0 0" }}>
            <a className="btn" href={`/go/${key}?src=page`} rel="nofollow sponsored">{d.viewAt(shop)}</a>
          </p>
        </div>
      </div>
      <h2>{d.historyTitle}</h2>
      {!showHistory ? <p className="muted">{d.noHistoryAllowed}</p> : h.length < 2 ? <p className="muted">{d.noHistory}</p> : <Chart h={h} currency={p.currency} locale={locale} />}
      <h2>{d.setAlert}</h2>
      <WatchForm locale={locale} labels={formLabels(locale)} product={p.url} currency={p.currency} />
      <small>{d.lastChecked}: {p.last_checked_at ? new Date(p.last_checked_at).toLocaleString(locale) : "–"}</small>
    </>
  );
}

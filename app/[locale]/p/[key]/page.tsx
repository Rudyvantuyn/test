import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import WatchForm from "@/app/components/WatchForm";
import ProductJsonLd from "@/app/components/ProductJsonLd";
import { formLabels } from "@/lib/formLabels";
import { isLocale, money, t, type Locale } from "@/lib/i18n";
import { parseKey, providers, retailerLabel } from "@/lib/providers";
import { deliveryLabel } from "@/lib/delivery";
import { db, type PriceRow, type ProductRow } from "@/lib/supabase";

export const revalidate = 900;

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
  const others = product.ean
    ? (((await supa.from("products").select("*").eq("ean", product.ean).neq("id", product.id).eq("in_stock", true).limit(40)).data ?? []) as ProductRow[])
    : [];
  return { p: product, h: h as PriceRow[], showHistory, others };
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
  const pts = h.map((r) => `${(pad + ((+new Date(r.checked_at) - t0) / (t1 - t0 || 1)) * (W - pad * 2)).toFixed(1)},${(H - pad - ((Number(r.price) - min) / span) * (H - pad * 2)).toFixed(1)}`);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <text x={4} y={pad} fontSize="12" fill="currentColor">{money(max, currency, locale)}</text>
      <text x={4} y={H - pad + 4} fontSize="12" fill="currentColor">{money(min, currency, locale)}</text>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
}

const shopName = (p: ProductRow) => p.merchant || retailerLabel[p.retailer] || new URL(p.url).hostname.replace(/^www\./, "");
const total = (p: ProductRow) => Number(p.last_price ?? 0) + Number(p.shipping_cost ?? 0);
const pkey = (p: ProductRow) => `${p.retailer}-${p.country}-${p.external_id}`;

export default async function ProductPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  if (!isLocale(locale)) notFound();
  const data = await load(key).catch(() => null);
  if (!data) notFound();
  const { p, h, showHistory, others } = data;
  const d = t(locale);
  const fmt = (n: number | null, cur = p.currency) => (n !== null ? money(Number(n), cur, locale) : "–");
  const cur = p.last_price !== null ? Number(p.last_price) : null;
  const low = p.lowest_price !== null ? Number(p.lowest_price) : null;
  const del = deliveryLabel(p.delivery_min_days, p.delivery_max_days, locale);

  // Vergelijking: alle aanbieders met dezelfde EAN (zelfde valuta voor eerlijke vergelijking)
  const all = [p, ...others].filter((x) => x.last_price !== null && x.currency === p.currency).sort((a, b) => total(a) - total(b));
  const cheapest = all[0];
  const fast = all.filter((x) => x.delivery_max_days !== null && x.delivery_max_days <= 1).sort((a, b) => total(a) - total(b))[0];
  const saveByWaiting = cheapest && fast && cheapest.id !== fast.id && total(fast) > total(cheapest) ? total(fast) - total(cheapest) : 0;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return (
    <>
      <ProductJsonLd p={p} offers={all} url={`${base}/${locale}/p/${key}`} />
      <span className="tag">{shopName(p)} · {p.country}</span>
      {del && <span className="tag">{del}</span>}
      {p.condition && p.condition !== "new" && <span className="tag">{p.condition}</span>}
      <h1>{p.title}</h1>
      <div className="card">
        {p.image_url && <img src={p.image_url} alt="" />}
        <div>
          <div>
            {d.current}: <span className="price">{fmt(cur)}</span>{" "}
            {p.shipping_cost !== null && Number(p.shipping_cost) > 0 && <small>+ {fmt(Number(p.shipping_cost))} {d.compare.shipping.toLowerCase()}</small>}{" "}
            {cur !== null && low !== null && cur <= low && h.length > 1 && <span className="badge">{d.lowestEver}</span>}
          </div>
          {showHistory && <div className="muted">{d.lowest}: {fmt(low)} · {d.highest}: {fmt(p.highest_price)} · {h.length} {d.measurements}</div>}
          <p style={{ margin: "10px 0 0" }}>
            <a className="btn" href={`/go/${key}?src=page`} rel="nofollow sponsored">{d.viewAt(shopName(p))}</a>
          </p>
        </div>
      </div>

      <h2>{d.compare.title}</h2>
      {saveByWaiting > 0 && fast && cheapest && (
        <p className="msg ok">
          <strong>{d.compare.waitSave(fmt(saveByWaiting), Math.max(1, cheapest.delivery_max_days ?? 7))}</strong> — {d.compare.cheapestFast}: {fmt(total(fast))} ({shopName(fast)}),{" "}
          {d.compare.cheapest.toLowerCase()}: {fmt(total(cheapest))} ({shopName(cheapest)}, {deliveryLabel(cheapest.delivery_min_days, cheapest.delivery_max_days, locale) || d.compare.unknown})
        </p>
      )}
      {all.length <= 1 ? <p className="muted">{d.compare.noOthers}</p> : (
        <table>
          <thead><tr><th>{d.compare.shop}</th><th>{d.compare.price}</th><th>{d.compare.shipping}</th><th>{d.compare.total}</th><th>{d.compare.delivery}</th><th>{d.compare.condition}</th><th></th></tr></thead>
          <tbody>
            {all.map((x) => (
              <tr key={x.id}>
                <td>{x.id === p.id ? <strong>{shopName(x)}</strong> : <Link href={`/${locale}/p/${pkey(x)}`}>{shopName(x)}</Link>} <small>{x.country}</small>
                  {cheapest?.id === x.id && <span className="badge" style={{ marginLeft: 6 }}>{d.compare.cheapest}</span>}
                  {fast?.id === x.id && fast.id !== cheapest?.id && <span className="badge" style={{ marginLeft: 6, background: "#1a1a9c" }}>{d.compare.fastest}</span>}
                </td>
                <td>{fmt(x.last_price, x.currency)}</td>
                <td>{x.shipping_cost === null ? d.compare.unknown : Number(x.shipping_cost) === 0 ? d.compare.free : fmt(Number(x.shipping_cost), x.currency)}</td>
                <td><strong>{fmt(total(x), x.currency)}</strong></td>
                <td>{deliveryLabel(x.delivery_min_days, x.delivery_max_days, locale) || d.compare.unknown}</td>
                <td>{x.condition ?? "–"}</td>
                <td><a className="btn" href={`/go/${pkey(x)}?src=compare`} rel="nofollow sponsored">{d.view}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{d.historyTitle}</h2>
      {!showHistory ? <p className="muted">{d.noHistoryAllowed}</p> : h.length < 2 ? <p className="muted">{d.noHistory}</p> : <Chart h={h} currency={p.currency} locale={locale} />}
      <h2>{d.setAlert}</h2>
      <WatchForm locale={locale} labels={formLabels(locale)} product={p.url} currency={p.currency} hasEan={!!p.ean} />
      <small>{d.lastChecked}: {p.last_checked_at ? new Date(p.last_checked_at).toLocaleString(locale) : "–"}</small>
    </>
  );
}

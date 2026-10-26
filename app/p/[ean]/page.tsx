import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchForm from "@/app/components/WatchForm";
import { db, type PriceRow, type ProductRow } from "@/lib/supabase";

export const revalidate = 1800;

const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

async function load(ean: string) {
  if (!/^\d{13}$/.test(ean)) return null;
  const supa = db();
  const { data: p } = await supa.from("products").select("*").eq("ean", ean).single();
  if (!p) return null;
  const { data: h } = await supa
    .from("price_history")
    .select("ean,price,checked_at")
    .eq("ean", ean)
    .order("checked_at", { ascending: true })
    .limit(500);
  return { p: p as ProductRow, h: (h ?? []) as PriceRow[] };
}

export async function generateMetadata({ params }: { params: Promise<{ ean: string }> }): Promise<Metadata> {
  const { ean } = await params;
  const d = await load(ean);
  if (!d) return { title: "Product niet gevonden" };
  const t = `${d.p.title} prijsgeschiedenis & prijsalert`;
  return {
    title: t,
    description: `Huidige prijs ${d.p.last_price ? eur(Number(d.p.last_price)) : "onbekend"}, laagste prijs ooit ${d.p.lowest_price ? eur(Number(d.p.lowest_price)) : "onbekend"}. Ontvang een mail bij prijsdaling.`,
  };
}

function Chart({ h }: { h: PriceRow[] }) {
  if (h.length < 2) return <p className="muted">Nog te weinig metingen voor een grafiek.</p>;
  const W = 720, H = 220, pad = 36;
  const prices = h.map((r) => Number(r.price));
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const t0 = +new Date(h[0].checked_at), t1 = +new Date(h[h.length - 1].checked_at) || t0 + 1;
  const pts = h.map((r) => {
    const x = pad + ((+new Date(r.checked_at) - t0) / (t1 - t0 || 1)) * (W - pad * 2);
    const y = H - pad - ((Number(r.price) - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Prijsverloop">
      <text x={4} y={pad} fontSize="12" fill="currentColor">{eur(max)}</text>
      <text x={4} y={H - pad + 4} fontSize="12" fill="currentColor">{eur(min)}</text>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ ean: string }> }) {
  const { ean } = await params;
  const d = await load(ean);
  if (!d) notFound();
  const { p, h } = d;
  const cur = p.last_price !== null ? Number(p.last_price) : null;
  const low = p.lowest_price !== null ? Number(p.lowest_price) : null;
  const atLowest = cur !== null && low !== null && cur <= low;
  return (
    <>
      <h1>{p.title}</h1>
      <div className="card">
        {p.image_url && <img src={p.image_url} alt="" />}
        <div>
          <div>
            Huidige prijs: <span className="price">{cur !== null ? eur(cur) : "onbekend"}</span>{" "}
            {atLowest && <span className="badge">Laagste prijs ooit</span>}
          </div>
          <div className="muted">
            Laagste: {low !== null ? eur(low) : "–"} · Hoogste: {p.highest_price !== null ? eur(Number(p.highest_price)) : "–"} ·{" "}
            {h.length} metingen
          </div>
          <p style={{ margin: "10px 0 0" }}>
            <a className="btn" href={`/go/${ean}?src=page`} rel="nofollow sponsored">Bekijk bij bol.com</a>
          </p>
        </div>
      </div>
      <Chart h={h} />
      <h2>Prijsalert instellen</h2>
      <WatchForm product={ean} />
      <small>Laatst gecontroleerd: {p.last_checked_at ? new Date(p.last_checked_at).toLocaleString("nl-NL") : "nog niet"}</small>
    </>
  );
}

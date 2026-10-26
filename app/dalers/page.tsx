import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase";

export const revalidate = 1800;
export const metadata: Metadata = {
  title: "Grootste prijsdalingen bij bol.com vandaag",
  description: "De producten die de afgelopen 24 uur het hardst in prijs daalden bij bol.com.",
};

const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

type Drop = { ean: string; title: string; image_url: string | null; old_price: number; new_price: number; drop_pct: number };

export default async function Dalers() {
  let drops: Drop[] = [];
  try {
    const { data } = await db().from("top_drops_24h").select("*").limit(50);
    drops = (data ?? []) as Drop[];
  } catch (e) {
    console.error("dalers: database niet bereikbaar", e);
  }
  return (
    <>
      <h1>Grootste prijsdalingen vandaag</h1>
      <p className="lead">Automatisch bijgewerkt op basis van de producten die onze gebruikers volgen.</p>
      {drops.length === 0 && <p className="muted">Nog geen dalingen gemeten in de afgelopen 24 uur.</p>}
      {drops.map((d) => (
        <div className="card" key={d.ean}>
          {d.image_url && <img src={d.image_url} alt="" />}
          <div style={{ flex: 1 }}>
            <Link href={`/p/${d.ean}`}>{d.title}</Link>
            <div>
              <span className="price">{eur(Number(d.new_price))}</span>
              <span className="old">{eur(Number(d.old_price))}</span>{" "}
              <span className="badge">-{Number(d.drop_pct).toFixed(0)}%</span>
            </div>
          </div>
          <a className="btn" href={`/go/${d.ean}?src=dalers`} rel="nofollow sponsored">Bekijk</a>
        </div>
      ))}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";
import { ALL_COUNTRIES, NETWORK_LABEL, retailersForCountry, RETAILERS } from "@/lib/retailers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: t(locale).stores.title, description: t(locale).stores.lead };
}

export default async function Stores({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ country?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { country } = await searchParams;
  const d = t(locale);
  const list = country && /^[A-Z]{2}$/.test(country) ? retailersForCountry(country) : RETAILERS;
  return (
    <>
      <h1>{d.stores.title}</h1>
      <p className="lead">{d.stores.lead}</p>
      <div className="chips">
        <Link href={`/${locale}/stores`} className={!country ? "on" : ""}>{d.filters.all}</Link>
        {ALL_COUNTRIES.map((c) => <Link key={c} href={`/${locale}/stores?country=${c}`} className={country === c ? "on" : ""}>{c}</Link>)}
      </div>
      <p className="muted">{d.stores.count(list.length)}</p>
      <div className="table-wrap">
      <table className="cards">
        <thead><tr><th>{d.compare.shop}</th><th>{d.filters.country}</th><th>{d.stores.network}</th><th>{d.stores.commission}</th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.domain}>
              <td className="full"><strong>{r.name}</strong> <small className="muted">{r.domain}</small></td>
              <td data-label={d.filters.country}><small>{r.countries.includes("*") ? "🌍" : r.countries.join(", ")}</small></td>
              <td data-label={d.stores.network}>{NETWORK_LABEL[r.network]}{r.note ? <small className="muted"> · {r.note}</small> : null}</td>
              <td data-label={d.stores.commission}>{r.commission}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: t(locale).ext.title, description: t(locale).ext.lead };
}

export default async function ExtensionPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { welcome } = await searchParams;
  const d = t(locale).ext;
  const store = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL;
  return (
    <>
      {welcome && <p className="msg ok">{d.welcome}</p>}
      <h1>{d.title}</h1>
      <p className="lead">{d.lead}</p>
      <ul>{d.points.map((x) => <li key={x}>{x}</li>)}</ul>
      {store ? (
        <p><a className="btn" href={store} target="_blank" rel="noopener">{d.install}</a></p>
      ) : (
        <>
          <h2>{d.manualTitle}</h2>
          <p><a className="btn" href="/pricedrop-extension.zip" download>{d.download}</a></p>
          <ol>{d.manual.map((x) => <li key={x}>{x}</li>)}</ol>
        </>
      )}
      <p><Link href={`/${locale}/privacy`}>{d.privacy}</Link></p>
    </>
  );
}

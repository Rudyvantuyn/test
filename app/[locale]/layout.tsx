import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, t } from "@/lib/i18n";

export const dynamicParams = false;
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = t(locale);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    metadataBase: new URL(base),
    title: { default: `${d.siteName} – ${d.metaTitle}`, template: `%s | ${d.siteName}` },
    description: d.metaDesc,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = t(locale);
  return (
    <html lang={locale}>
      <body>
        <header>
          <nav>
            <Link href={`/${locale}`}>{d.siteName}</Link>
            <Link href={`/${locale}/deals`}>{d.navDeals}</Link>
            <Link href={`/${locale}/stores`}>{d.navStores}</Link>
            <span className="lang">
              {locales.map((l) => (
                <Link key={l} href={`/${l}`} hrefLang={l}>{l}</Link>
              ))}
            </span>
          </nav>
        </header>
        <main>{children}</main>
        <footer style={{ textAlign: "center", padding: 24 }}>
          <small>{d.footer}</small>
        </footer>
      </body>
    </html>
  );
}

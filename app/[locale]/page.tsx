import Link from "next/link";
import WatchForm from "@/app/components/WatchForm";
import { formLabels } from "@/lib/formLabels";
import { isLocale, t } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { telegramFor } from "@/lib/social";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = t(locale);
  return (
    <>
      <h1>{d.tagline}</h1>
      <p className="lead">{d.lead}</p>
      <WatchForm locale={locale} labels={formLabels(locale)} />
      {telegramFor(locale) && (
        <p><a className="tg" href={telegramFor(locale)!} target="_blank" rel="noopener">✈️ {d.telegram.cta}</a></p>
      )}
      <h2>{d.howTitle}</h2>
      <ol>{d.how.map((s) => <li key={s}>{s}</li>)}</ol>
      <h2>{d.supportedTitle}</h2>
      <p>{d.supported}</p>
      <p><Link href={`/${locale}/deals`}>{d.dealsTitle} →</Link></p>
    </>
  );
}

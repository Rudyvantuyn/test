import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: t(locale).privacy.title };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = t(locale).privacy;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <>
      <h1>{d.title}</h1>
      {d.sections.map(([h, body]) => (
        <section key={h}><h2>{h}</h2><p>{body}</p></section>
      ))}
      {contact && <><h2>{d.contact}</h2><p><a href={`mailto:${contact}`}>{contact}</a></p></>}
    </>
  );
}

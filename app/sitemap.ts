import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";
import { locales } from "@/lib/i18n";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [];
  for (const l of locales) {
    entries.push({ url: `${base}/${l}`, changeFrequency: "daily", priority: 1 });
    entries.push({ url: `${base}/${l}/deals`, changeFrequency: "hourly", priority: 0.9 });
  }
  try {
    const { data } = await db().from("products").select("retailer,country,external_id,last_checked_at").limit(40000);
    for (const p of data ?? []) {
      const key = `${p.retailer}-${p.country}-${p.external_id}`;
      // één taal per product (SEO-duplicaten vermijden): nl voor NL/BE, de voor DE/AT/CH, anders en
      const l = ["NL", "BE"].includes(p.country) ? "nl" : ["DE", "AT", "CH"].includes(p.country) ? "de" : "en";
      entries.push({ url: `${base}/${l}/p/${key}`, lastModified: p.last_checked_at ?? undefined, changeFrequency: "daily", priority: 0.7 });
    }
  } catch (e) {
    console.error("sitemap: database unavailable", e);
  }
  return entries;
}

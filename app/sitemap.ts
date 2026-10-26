import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/dalers`, changeFrequency: "hourly", priority: 0.9 },
  ];
  try {
    const { data } = await db().from("products").select("ean,last_checked_at").limit(50000);
    for (const p of data ?? []) {
      entries.push({
        url: `${base}/p/${p.ean}`,
        lastModified: p.last_checked_at ?? undefined,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch (e) {
    console.error("sitemap: database niet bereikbaar", e);
  }
  return entries;
}

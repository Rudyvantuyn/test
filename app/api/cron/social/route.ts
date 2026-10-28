import { NextResponse } from "next/server";
import { db, type DropRow } from "@/lib/supabase";
import { money, type Locale } from "@/lib/i18n";
import { retailerLabel } from "@/lib/providers";
import { deliveryLabel } from "@/lib/delivery";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Dagelijkse social-automatisering: grootste dalers per land naar
 *  - Telegram-kanalen (TELEGRAM_BOT_TOKEN + TELEGRAM_CHATS = {"NL":"@kanaal_nl","DE":"@kanaal_de"})
 *  - Metricool (METRICOOL_TOKEN, METRICOOL_USER_ID, METRICOOL_BLOG_ID, METRICOOL_NETWORKS=pinterest,instagram,tiktok,
 *    METRICOOL_PINTEREST_BOARD_ID, METRICOOL_COUNTRIES=NL,DE)
 * Elke daler wordt per kanaal maar één keer gepost (tabel social_posts).
 */
const MIN_DROP = 10; // alleen dalingen >= 10%
const PER_COUNTRY = 3;
const localeFor = (c: string): Locale => (["NL", "BE"].includes(c) ? "nl" : ["DE", "AT", "CH"].includes(c) ? "de" : "en");

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type Drop = DropRow & { key: string; link: string; page: string; image: string; locale: Locale };

async function topDrops(country: string, base: string): Promise<Drop[]> {
  const { data } = await db().from("top_drops_24h").select("*").eq("country", country).gte("drop_pct", MIN_DROP).order("drop_pct", { ascending: false }).limit(PER_COUNTRY * 3);
  return ((data ?? []) as DropRow[]).map((d) => {
    const key = `${d.retailer}-${d.country}-${d.external_id}`;
    const locale = localeFor(d.country);
    return { ...d, key, locale, link: `${base}/go/${key}?src=social`, page: `${base}/${locale}/p/${key}`, image: `${base}/api/og/${key}?old=${d.old_price}` };
  });
}

function caption(d: Drop, withLink: boolean) {
  const shop = d.merchant || retailerLabel[d.retailer] || new URL(d.url).hostname.replace(/^www\./, "");
  const del = deliveryLabel(d.delivery_min_days, d.delivery_max_days, d.locale);
  const fmt = (n: number) => money(n, d.currency, d.locale);
  const t = {
    nl: `🔻 -${Number(d.drop_pct).toFixed(0)}% ${d.title}\n${fmt(Number(d.new_price))} (was ${fmt(Number(d.old_price))}) bij ${shop}${del ? ` · ${del}` : ""}`,
    de: `🔻 -${Number(d.drop_pct).toFixed(0)}% ${d.title}\n${fmt(Number(d.new_price))} (vorher ${fmt(Number(d.old_price))}) bei ${shop}${del ? ` · ${del}` : ""}`,
    en: `🔻 -${Number(d.drop_pct).toFixed(0)}% ${d.title}\n${fmt(Number(d.new_price))} (was ${fmt(Number(d.old_price))}) at ${shop}${del ? ` · ${del}` : ""}`,
  }[d.locale];
  return withLink ? `${t}\n👉 ${d.link}\n#deal #${d.country.toLowerCase()}` : `${t}\n#deal #${d.country.toLowerCase()} #pricedrop`;
}

async function alreadyPosted(productId: string, channel: string) {
  const { data } = await db().from("social_posts").select("id").eq("product_id", productId).eq("channel", channel).maybeSingle();
  return !!data;
}
const markPosted = (productId: string, channel: string) => db().from("social_posts").insert({ product_id: productId, channel });

async function postTelegram(drops: Drop[], chat: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return 0;
  let n = 0;
  for (const d of drops) {
    const channel = `telegram:${chat}`;
    if (n >= PER_COUNTRY || (await alreadyPosted(d.product_id, channel))) continue;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, photo: d.image, caption: caption(d, true) }),
    });
    if (res.ok) { await markPosted(d.product_id, channel); n++; } else console.error("telegram", chat, await res.text());
  }
  return n;
}

async function postMetricool(drops: Drop[], country: string) {
  const token = process.env.METRICOOL_TOKEN, userId = process.env.METRICOOL_USER_ID, blogId = process.env.METRICOOL_BLOG_ID;
  if (!token || !userId || !blogId) return 0;
  const networks = (process.env.METRICOOL_NETWORKS ?? "pinterest").split(",").map((s) => s.trim()).filter(Boolean);
  const tz = process.env.METRICOOL_TIMEZONE ?? "Europe/Amsterdam";
  let n = 0, slot = 0;
  for (const d of drops) {
    const channel = `metricool:${country}`;
    if (n >= PER_COUNTRY || (await alreadyPosted(d.product_id, channel))) continue;
    // spreid over de dag: 09:00, 12:30, 18:00 lokale tijd
    const when = new Date(); when.setUTCHours([8, 11, 17][slot % 3] ?? 8, [0, 30, 0][slot % 3] ?? 0, 0, 0);
    if (when.getTime() < Date.now() + 10 * 60_000) when.setUTCDate(when.getUTCDate() + 1);
    const dateTime = when.toISOString().slice(0, 19);
    const info: Record<string, unknown> = {
      autoPublish: true, draft: false, shortener: false, descendants: [], firstCommentText: "", hasNotReadNotes: false,
      media: [d.image], mediaAltText: [d.title], smartLinkData: { ids: [] },
      providers: networks.map((network) => ({ network })),
      publicationDate: { dateTime, timezone: tz },
      text: caption(d, !networks.includes("instagram")),
    };
    if (networks.includes("pinterest")) info.pinterestData = { boardId: process.env.METRICOOL_PINTEREST_BOARD_ID ?? "", pinTitle: `-${Number(d.drop_pct).toFixed(0)}% ${d.title}`.slice(0, 100), pinLink: d.page, pinNewFormat: true };
    if (networks.includes("instagram")) info.instagramData = { type: "POST" };
    if (networks.includes("tiktok")) info.tiktokData = { title: `-${Number(d.drop_pct).toFixed(0)}% ${d.title}`.slice(0, 90), privacyOption: "PUBLIC_TO_EVERYONE" };
    if (networks.includes("facebook")) info.facebookData = { type: "POST" };
    const res = await fetch(`https://app.metricool.com/api/v2/scheduler/posts?blogId=${blogId}&userId=${userId}`, {
      method: "POST", headers: { "content-type": "application/json", "X-Mc-Auth": token }, body: JSON.stringify(info),
    });
    if (res.ok) { await markPosted(d.product_id, channel); n++; slot++; } else console.error("metricool", country, res.status, await res.text());
  }
  return n;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  let chats: Record<string, string> = {};
  try { chats = JSON.parse(process.env.TELEGRAM_CHATS ?? "{}"); } catch { /* ignore */ }
  const mcCountries = (process.env.METRICOOL_COUNTRIES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const countries = [...new Set([...Object.keys(chats), ...mcCountries])];
  const out: Record<string, { candidates: number; telegram: number; metricool: number }> = {};
  for (const c of countries) {
    const drops = await topDrops(c, base);
    out[c] = { candidates: drops.length, telegram: 0, metricool: 0 };
    if (chats[c]) out[c].telegram = await postTelegram(drops, chats[c]);
    if (mcCountries.includes(c)) out[c].metricool = await postMetricool(drops, c);
  }
  return NextResponse.json(out);
}

import { Resend } from "resend";
import { t, money, isLocale, type Locale } from "./i18n";
import { retailerLabel } from "./providers";
import { deliveryLabel } from "./delivery";
import type { ProductRow, WatchRow } from "./supabase";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendPriceDropEmail(w: WatchRow, p: ProductRow, key: string, oldPrice: number, newPrice: number, cross = false) {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM ontbreken");
  const locale: Locale = isLocale(w.locale) ? w.locale : "en";
  const d = t(locale), e = d.email;
  const base = siteUrl();
  const shop = p.merchant || retailerLabel[p.retailer] || new URL(p.url).hostname.replace(/^www\./, "");
  const delivery = deliveryLabel(p.delivery_min_days, p.delivery_max_days, locale);
  const shipping = p.shipping_cost === null ? "" : Number(p.shipping_cost) === 0 ? ` · ${locale === "nl" ? "gratis verzending" : locale === "de" ? "kostenloser Versand" : "free shipping"}` : ` · + ${money(Number(p.shipping_cost), p.currency, locale)}`;
  const pct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  const fmt = (n: number) => money(n, p.currency, locale);
  const buyUrl = `${base}/go/${key}?w=${w.id}`;
  const pageUrl = `${base}/${locale}/p/${key}`;
  const unsubUrl = `${base}/api/unsubscribe?t=${w.unsubscribe_token}`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 8px">${cross ? e.cheaperHeading : e.heading}: ${escapeHtml(p.title)}</h2>
    <p style="margin:0 0 16px;color:#555">${e.now} <strong style="color:#0a7d32;font-size:20px">${fmt(newPrice)}</strong>
      <span style="text-decoration:line-through;color:#999">${fmt(oldPrice)}</span> (-${pct}%)</p>
    <p style="margin:0 0 16px;color:#555">${escapeHtml(shop)}${delivery ? ` · ${escapeHtml(delivery)}` : ""}${shipping}</p>
    ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" style="max-width:240px;border-radius:8px;margin-bottom:16px">` : ""}
    <p><a href="${buyUrl}" style="display:inline-block;background:#1a1a9c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(e.cta(shop))}</a></p>
    <p style="font-size:13px;color:#777">${e.hint} <a href="${pageUrl}">${e.history}</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999">${e.footer} <a href="${unsubUrl}">${e.unsubscribe}</a></p>
  </div>`;

  await new Resend(apiKey).emails.send({
    from,
    to: w.email,
    subject: cross ? e.cheaperSubject(p.title.slice(0, 60), fmt(newPrice), shop) : e.subject(pct, p.title.slice(0, 70), fmt(newPrice)),
    html,
    headers: { "List-Unsubscribe": `<${unsubUrl}>` },
  });
}

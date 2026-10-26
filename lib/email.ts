import { Resend } from "resend";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function eur(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export async function sendPriceDropEmail(opts: {
  to: string;
  title: string;
  ean: string;
  oldPrice: number;
  newPrice: number;
  watchId: string;
  unsubscribeToken: string;
  imageUrl?: string | null;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM ontbreken");
  const resend = new Resend(key);
  const base = siteUrl();
  const buyUrl = `${base}/go/${opts.ean}?w=${opts.watchId}`;
  const historyUrl = `${base}/p/${opts.ean}`;
  const unsubUrl = `${base}/api/unsubscribe?t=${opts.unsubscribeToken}`;
  const pct = Math.round(((opts.oldPrice - opts.newPrice) / opts.oldPrice) * 100);

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 8px">Prijsdaling: ${escapeHtml(opts.title)}</h2>
    <p style="margin:0 0 16px;color:#555">Nu <strong style="color:#0a7d32;font-size:20px">${eur(opts.newPrice)}</strong>
      <span style="text-decoration:line-through;color:#999">${eur(opts.oldPrice)}</span> (-${pct}%)</p>
    ${opts.imageUrl ? `<img src="${opts.imageUrl}" alt="" style="max-width:240px;border-radius:8px;margin-bottom:16px">` : ""}
    <p><a href="${buyUrl}" style="display:inline-block;background:#0000a4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Bekijk bij bol.com</a></p>
    <p style="font-size:13px;color:#777">Prijzen kunnen snel weer stijgen. <a href="${historyUrl}">Prijsgeschiedenis bekijken</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999">Je ontvangt dit omdat je dit product volgt op Prijsdaler. Links zijn affiliate-links: bij aankoop ontvangen wij een kleine commissie, jij betaalt niets extra.
      <a href="${unsubUrl}">Afmelden</a></p>
  </div>`;

  await resend.emails.send({
    from,
    to: opts.to,
    subject: `Prijsdaling (-${pct}%): ${opts.title.slice(0, 70)} nu ${eur(opts.newPrice)}`,
    html,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

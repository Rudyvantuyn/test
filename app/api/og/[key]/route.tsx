import { ImageResponse } from "next/og";
import { db, type ProductRow } from "@/lib/supabase";
import { parseKey, retailerLabel } from "@/lib/providers";

export const runtime = "nodejs";
export const revalidate = 1800;

const eur = (n: number, c: string) => new Intl.NumberFormat("en", { style: "currency", currency: c }).format(n);

/** Productafbeelding server-side ophalen als data-URI; Satori kan externe CDN's (webp, UA-checks) niet altijd lezen. */
async function loadImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0", accept: "image/jpeg,image/png;q=0.9,*/*;q=0.5" }, cache: "no-store" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!/^image\/(jpeg|png)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

/** Deal-afbeelding (1200x630) voor Pinterest, Telegram, Instagram en Open Graph. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const k = parseKey(key);
  if (!k) return new Response("Not found", { status: 404 });
  const { data } = await db().from("products").select("*").match({ retailer: k.retailer, country: k.country, external_id: k.externalId }).single();
  if (!data) return new Response("Not found", { status: 404 });
  const p = data as ProductRow;
  const old = Number(new URL(req.url).searchParams.get("old") ?? p.highest_price ?? 0);
  const cur = Number(p.last_price ?? 0);
  const pct = old > cur && old > 0 ? Math.round(((old - cur) / old) * 100) : 0;
  const shop = p.merchant || retailerLabel[p.retailer] || new URL(p.url).hostname.replace(/^www\./, "");
  const img = await loadImage(p.image_url);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#101014", color: "#fff", fontFamily: "sans-serif", padding: 48 }}>
        <div style={{ display: "flex", width: 420, height: 534, background: "#fff", borderRadius: 24, alignItems: "center", justifyContent: "center" }}>
          {img ? <img src={img} width={360} height={360} style={{ objectFit: "contain" }} /> : <div style={{ fontSize: 120 }}>🏷️</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 48, flex: 1 }}>
          <div style={{ fontSize: 28, color: "#9a9aa8" }}>{`${shop} · ${p.country}`}</div>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.15, marginTop: 12, maxHeight: 210, overflow: "hidden" }}>{p.title.slice(0, 90)}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 28 }}>
            <div style={{ fontSize: 88, fontWeight: 800, color: "#4fd27a" }}>{eur(cur, p.currency)}</div>
            {pct > 0 && <div style={{ fontSize: 40, color: "#9a9aa8", textDecoration: "line-through", marginLeft: 24 }}>{eur(old, p.currency)}</div>}
          </div>
          {pct > 0 && <div style={{ display: "flex", fontSize: 36, fontWeight: 700, background: "#4fd27a", color: "#101014", borderRadius: 999, padding: "8px 28px", marginTop: 16, alignSelf: "flex-start" }}>{`-${pct}%`}</div>}
          <div style={{ fontSize: 26, color: "#9a9aa8", marginTop: 36 }}>pricedropalert.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

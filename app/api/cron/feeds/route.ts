import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { db } from "@/lib/supabase";
import { normalizeUrl, urlHash } from "@/lib/providers/feed";

export const runtime = "nodejs";
export const maxDuration = 300;

type Source = {
  id: number; network: string; merchant: string; country: string; currency: string;
  feed_url: string; gzip: boolean; delimiter: string; columns: Record<string, string> | null; enabled: boolean;
};

/** Standaard kolomnamen per netwerk; overschrijfbaar via feed_sources.columns. */
const DEFAULT_COLUMNS: Record<string, Record<string, string>> = {
  awin: { id: "aw_product_id", mpid: "merchant_product_id", ean: "ean", title: "product_name", url: "merchant_deep_link", deeplink: "aw_deep_link", price: "search_price", currency: "currency", image: "merchant_image_url" },
  tradedoubler: { id: "TDProductId", mpid: "sku", ean: "ean", title: "name", url: "productUrl", deeplink: "productUrl", price: "price", currency: "currency", image: "imageUrl" },
  daisycon: { id: "id", mpid: "sku", ean: "ean", title: "title", url: "link", deeplink: "link", price: "price", currency: "currency", image: "image_default" },
  partnerize: { id: "product_id", mpid: "product_id", ean: "gtin", title: "product_name", url: "product_url", deeplink: "tracking_url", price: "price", currency: "currency", image: "image_url" },
  cj: { id: "ID", mpid: "SKU", ean: "GTIN", title: "TITLE", url: "LINK", deeplink: "LINK", price: "PRICE", currency: "CURRENCY", image: "IMAGE_LINK" },
};

const toNumber = (v: unknown) => {
  const s = String(v ?? "").replace(/[^\d.,]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf(".")) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function ingest(src: Source) {
  const supa = db();
  const cols = { ...DEFAULT_COLUMNS[src.network], ...(src.columns ?? {}) };
  const res = await fetch(src.feed_url, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`feed ${src.merchant}: HTTP ${res.status}`);
  let stream: NodeJS.ReadableStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  if (src.gzip || /\.gz(\?|$)/.test(src.feed_url)) stream = stream.pipe(createGunzip());
  const parser = stream.pipe(parse({ columns: true, delimiter: src.delimiter || ",", relax_quotes: true, relax_column_count: true, bom: true, skip_empty_lines: true }));

  let rows = 0, upserted = 0, skipped = 0;
  let batch: Record<string, unknown>[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supa.from("feed_offers").upsert(batch, { onConflict: "source_id,merchant_product_id" });
    if (error) throw error;
    upserted += batch.length;
    batch = [];
  };

  for await (const rec of parser as AsyncIterable<Record<string, string>>) {
    rows++;
    const rawUrl = rec[cols.url], price = toNumber(rec[cols.price]), mpid = rec[cols.mpid] || rec[cols.id];
    if (!rawUrl || price === null || !mpid || !rec[cols.title]) { skipped++; continue; }
    let url: string;
    try { url = normalizeUrl(rawUrl); } catch { skipped++; continue; }
    batch.push({
      source_id: src.id, merchant_product_id: String(mpid).slice(0, 120), url_hash: urlHash(url),
      ean: /^\d{8,14}$/.test(rec[cols.ean] ?? "") ? rec[cols.ean] : null,
      title: rec[cols.title].slice(0, 300), url: `https://${url}`, deeplink: rec[cols.deeplink] || `https://${url}`,
      price, currency: (rec[cols.currency] || src.currency).toUpperCase().slice(0, 3),
      image_url: rec[cols.image] || null, updated_at: new Date().toISOString(),
    });
    if (batch.length >= 500) await flush();
  }
  await flush();
  await supa.from("feed_sources").update({ last_run_at: new Date().toISOString(), last_row_count: upserted, last_error: null }).eq("id", src.id);
  return { rows, upserted, skipped };
}

/** Laadt alle ingeschakelde feeds (of één via ?source=ID). */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const only = new URL(req.url).searchParams.get("source");
  let q = db().from("feed_sources").select("*").eq("enabled", true).order("last_run_at", { ascending: true, nullsFirst: true });
  if (only) q = q.eq("id", Number(only));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result: Record<string, unknown> = {};
  for (const src of (data ?? []) as Source[]) {
    try {
      result[src.merchant] = await ingest(src);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result[src.merchant] = { error: msg };
      await db().from("feed_sources").update({ last_error: msg, last_run_at: new Date().toISOString() }).eq("id", src.id);
    }
  }
  return NextResponse.json(result);
}

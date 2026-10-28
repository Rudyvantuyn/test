import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { upsertProduct } from "@/lib/products";
import { PendingSourceError, providers, resolveInput } from "@/lib/providers";
import { bolConfigured } from "@/lib/providers/bol";
import { findFeedOffersByEan, offerToProduct } from "@/lib/providers/feed";
import { matchKey } from "@/lib/match";
import { expandOffers } from "@/lib/compare";
import type { ProductRow } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vooraf vullen van productpagina's (SEO), zonder dat een gebruiker iets hoeft te plakken.
 * Bronnen, in volgorde:
 *  1. seed_urls: categoriepagina's van winkels (generic) -> productlinks -> max PER_RUN per run
 *  2. feed_offers met EAN die nog geen productpagina hebben
 *  3. bol "populair"-lijsten per categorie (zodra de bol API is geconfigureerd)
 */
const PER_RUN = 15;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function fromCategoryPages(limit: number) {
  const supa = db();
  const { data: seeds } = await supa.from("seed_urls").select("*").eq("enabled", true).order("last_run_at", { ascending: true, nullsFirst: true }).limit(3);
  let created = 0;
  for (const s of seeds ?? []) {
    if (created >= limit) break;
    try {
      const html = await (await fetch(s.url, { headers: { "user-agent": UA, accept: "text/html" }, cache: "no-store" })).text();
      const re = new RegExp(s.link_pattern, "g");
      const links = [...new Set([...html.matchAll(re)].map((m) => m[0]))].slice(0, 60);
      const { data: known } = await supa.from("products").select("url").in("url", links);
      const knownSet = new Set((known ?? []).map((k) => k.url));
      for (const link of links) {
        if (created >= limit) break;
        if (knownSet.has(link)) continue;
        try { await upsertProduct(await resolveInput(link)); created++; } catch (e) { console.error("seed resolve", link, e instanceof Error ? e.message : e); }
        await new Promise((r) => setTimeout(r, 700));
      }
      await supa.from("seed_urls").update({ last_run_at: new Date().toISOString(), last_count: created }).eq("id", s.id);
    } catch (e) { console.error("seed page", s.url, e); }
  }
  return created;
}

async function fromFeeds(limit: number) {
  const supa = db();
  const { data } = await supa.from("feed_offers").select("ean").not("ean", "is", null).eq("in_stock", true).order("updated_at", { ascending: false }).limit(500);
  const eans = [...new Set((data ?? []).map((r) => r.ean as string))];
  if (!eans.length) return 0;
  const { data: have } = await supa.from("products").select("ean").in("ean", eans);
  const haveSet = new Set((have ?? []).map((h) => h.ean));
  let created = 0;
  for (const ean of eans.filter((e) => !haveSet.has(e)).slice(0, limit)) {
    for (const o of await findFeedOffersByEan(ean, [])) { try { await upsertProduct(offerToProduct(o)); created++; } catch { /* skip */ } }
  }
  return created;
}

async function fromBolPopular(limit: number) {
  if (!bolConfigured()) return 0;
  const bol = providers.bol;
  const supa = db();
  const { data: cats } = await supa.from("seed_urls").select("*").eq("enabled", true).eq("kind", "bol_category").order("last_run_at", { ascending: true, nullsFirst: true }).limit(2);
  let created = 0;
  for (const c of cats ?? []) {
    try {
      // url bevat hier het bol category-id; de lijst "populair" via de Marketing Catalog API
      const res = await fetch(`https://api.bol.com/marketing/catalog/v1/products/lists/popular?country-code=NL&category-id=${encodeURIComponent(c.url)}&page-size=24&include-offer=true&include-image=true`, {
        headers: { Authorization: `Bearer ${await bolToken()}`, Accept: "application/json", "Accept-Language": "nl" }, cache: "no-store",
      });
      if (!res.ok) throw new Error(`bol popular ${res.status}`);
      const json = (await res.json()) as { products?: { ean: string }[] };
      for (const p of (json.products ?? []).slice(0, limit)) {
        try { await upsertProduct(await bol.resolve(p.ean, null)); created++; } catch { /* skip */ }
      }
      await supa.from("seed_urls").update({ last_run_at: new Date().toISOString(), last_count: created }).eq("id", c.id);
    } catch (e) { console.error("bol popular", e); }
  }
  return created;
}

async function bolToken(): Promise<string> {
  const id = process.env.BOL_CLIENT_ID!, secret = process.env.BOL_CLIENT_SECRET!;
  const res = await fetch("https://login.bol.com/token?grant_type=client_credentials", {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, Accept: "application/json" }, cache: "no-store",
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Bewaarde aanvragen (bron was nog niet actief) omzetten in echte watches. */
async function processPending(limit: number) {
  const supa = db();
  const { data } = await supa.from("pending_watches").select("*").is("processed_at", null).order("created_at", { ascending: true }).limit(limit);
  let done = 0;
  for (const w of data ?? []) {
    try {
      const r = await resolveInput(w.url);
      const productId = await upsertProduct(r);
      await supa.from("watches").upsert({
        email: w.email, product_id: productId, locale: w.locale, ean: r.ean ?? null, any_retailer: !!r.ean,
        max_delivery_days: w.max_delivery_days, condition_filter: w.condition_filter,
        target_price: w.target_price, mode: w.target_price ? "below" : "any_drop", active: true,
      }, { onConflict: "email,product_id" });
      await supa.from("pending_watches").update({ processed_at: new Date().toISOString(), last_error: null }).eq("id", w.id);
      done++;
    } catch (e) {
      if (e instanceof PendingSourceError) continue; // bron nog steeds niet actief: later opnieuw
      await supa.from("pending_watches").update({ last_error: e instanceof Error ? e.message.slice(0, 300) : "error" }).eq("id", w.id);
    }
  }
  return done;
}

/** Productsleutel invullen voor oudere producten. */
async function backfillMatchKeys(limit: number) {
  const supa = db();
  const { data } = await supa.from("products").select("id,title").is("match_key", null).limit(limit);
  let n = 0;
  for (const r of data ?? []) {
    const k = matchKey(r.title);
    // "-" = geen sleutel mogelijk, zodat we het product niet elke run opnieuw proberen
    await supa.from("products").update({ match_key: k ?? "-" }).eq("id", r.id);
    if (k) n++;
  }
  return n;
}

/** Gevolgde producten zonder andere aanbieders: elders zoeken. */
async function expandWatched(limit: number) {
  const supa = db();
  const { data } = await supa.from("watches").select("product_id").eq("active", true).limit(500);
  const ids = [...new Set((data ?? []).map((w) => w.product_id as string))];
  if (!ids.length) return 0;
  const { data: prods } = await supa.from("products").select("*").in("id", ids).limit(200);
  let added = 0, done = 0;
  for (const p of (prods ?? []) as ProductRow[]) {
    if (done >= limit) break;
    const { count } = await supa.from("products").select("id", { count: "exact", head: true })
      .or([p.ean ? `ean.eq.${p.ean}` : "", p.match_key && p.match_key !== "-" ? `match_key.eq.${p.match_key}` : ""].filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000")
      .neq("id", p.id);
    if ((count ?? 0) > 0) continue;
    added += await expandOffers(p);
    done++;
  }
  return added;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out = { pending: 0, matchKeys: 0, compared: 0, categoryPages: 0, feeds: 0, bolPopular: 0 };
  out.pending = await processPending(50);
  out.matchKeys = await backfillMatchKeys(500);
  out.compared = await expandWatched(5);
  out.categoryPages = await fromCategoryPages(PER_RUN);
  out.feeds = await fromFeeds(PER_RUN * 2);
  out.bolPopular = await fromBolPopular(PER_RUN);
  return NextResponse.json(out);
}

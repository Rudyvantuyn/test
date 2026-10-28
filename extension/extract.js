/* Leest productgegevens uit de huidige pagina. Draait in de browser van de gebruiker. */
(() => {
  const AMAZON_CURRENCY = {
    "amazon.com": "USD", "amazon.ca": "CAD", "amazon.com.mx": "MXN", "amazon.com.br": "BRL", "amazon.co.uk": "GBP",
    "amazon.de": "EUR", "amazon.fr": "EUR", "amazon.it": "EUR", "amazon.es": "EUR", "amazon.nl": "EUR", "amazon.com.be": "EUR",
    "amazon.se": "SEK", "amazon.pl": "PLN", "amazon.com.tr": "TRY", "amazon.ae": "AED", "amazon.sa": "SAR", "amazon.eg": "EGP",
    "amazon.in": "INR", "amazon.co.jp": "JPY", "amazon.com.au": "AUD", "amazon.sg": "SGD",
  };

  function toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string") return null;
    const s = v.replace(/[^\d.,]/g, "");
    if (!s) return null;
    const norm = s.includes(",") && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf("."))
      ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    const n = Number(norm);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const text = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; };
  const firstPrice = (sels) => { for (const s of sels) { const n = toNumber(text(s)); if (n) return n; } return null; };
  const metaContent = (attr, key) => document.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") ?? null;
  const str = (v) => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : null);

  function walk(node, visit) {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === "object") { visit(node); Object.values(node).forEach((v) => walk(v, visit)); }
  }

  function fromJsonLd() {
    let out = null;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data; try { data = JSON.parse(s.textContent); } catch { continue; }
      walk(data, (o) => {
        if (out) return;
        const types = Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]];
        if (!types.some((x) => typeof x === "string" && /product/i.test(x))) return;
        let of = Array.isArray(o.offers) ? o.offers[0] : o.offers;
        if (!of || typeof of !== "object") return;
        if (Array.isArray(of.offers) && of.offers[0]) of = { ...of, ...of.offers[0] };
        const specs = Array.isArray(of.priceSpecification) ? of.priceSpecification : of.priceSpecification ? [of.priceSpecification] : [];
        const sale = specs.find((x) => !/ListPrice|Strikethrough|MSRP|SRP/i.test(String(x.priceType ?? "")));
        const list = specs.find((x) => /ListPrice|Strikethrough|MSRP|SRP/i.test(String(x.priceType ?? "")));
        const price = toNumber(of.price ?? of.lowPrice ?? sale?.price);
        if (!price) return;
        const img = o.image;
        out = {
          title: str(o.name), price, currency: str(of.priceCurrency) ?? str(sale?.priceCurrency),
          listPrice: toNumber(list?.price),
          image: str(img) ?? (Array.isArray(img) ? img[0]?.url ?? null : img?.url ?? null),
          ean: [o.gtin13, o.gtin, o.ean, o.gtin14].map(str).find((x) => x && /^\d{13}$/.test(x)) ?? null,
          inStock: of.availability ? /InStock|LimitedAvailability|OnlineOnly|PreSale/i.test(String(of.availability)) : null,
          condition: str(of.itemCondition)?.replace(/^.*\//, "") ?? null,
        };
      });
      if (out) break;
    }
    return out;
  }

  function amazon(host) {
    const title = text("#productTitle");
    if (!title) return null;
    let price = firstPrice([
      "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen", "#corePrice_feature_div .a-price .a-offscreen",
      "#corePrice_desktop .a-price .a-offscreen", "#apex_desktop .a-price .a-offscreen", "#price_inside_buybox",
      "#priceblock_dealprice", "#priceblock_ourprice", "#kindle-price", "#tp_price_block_total_price_ww .a-offscreen",
    ]);
    if (!price) {
      const whole = text("#corePriceDisplay_desktop_feature_div .a-price-whole, #corePrice_feature_div .a-price-whole");
      const frac = text("#corePriceDisplay_desktop_feature_div .a-price-fraction, #corePrice_feature_div .a-price-fraction");
      price = toNumber(`${whole.replace(/[.,]$/, "")}.${frac || "00"}`);
    }
    if (!price) return null;
    const listPrice = firstPrice([
      "#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen", "#corePrice_desktop .a-text-price .a-offscreen",
      '.a-price[data-a-strike="true"] .a-offscreen', "#listPrice", "#priceblock_listprice",
    ]);
    const imgEl = document.querySelector("#landingImage, #imgBlkFront, #main-image");
    const availability = text("#availability").toLowerCase();
    return {
      title, price, listPrice, currency: AMAZON_CURRENCY[host.replace(/^www\./, "")] ?? null,
      image: imgEl?.getAttribute("data-old-hires") || imgEl?.getAttribute("src") || null,
      deliveryText: text("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE") || text("#deliveryBlockMessage") || null,
      inStock: !/niet beschikbaar|currently unavailable|nicht verfügbar|non disponible|no disponible|non disponibile/.test(availability),
      condition: "new", ean: null,
    };
  }

  function findEanInText() {
    const t = document.body?.innerText?.slice(0, 200000) ?? "";
    return t.match(/\b(?:EAN|GTIN|EAN-13|EAN-code)\s*[:\s]\s*(\d{13})\b/i)?.[1] ?? null;
  }

  function deliveryFromText() {
    const t = (document.body?.innerText ?? "").slice(0, 60000);
    return t.match(/(morgen in huis|vandaag (?:nog )?besteld,? morgen (?:in huis|bezorgd)|lieferung (?:in|innerhalb) [^.\n]{1,30}(?:werktag|tag)\w*|(?:bezorgd|geleverd) (?:binnen|in) \d+(?:\s*[-–]\s*\d+)? (?:werk)?dag\w*|(?:delivery|delivered) (?:in|within) \d+(?:\s*[-–]\s*\d+)? (?:business |working )?days?|next[- ]day delivery|livraison (?:sous|en) \d+(?:\s*[-–]\s*\d+)? jours?|free delivery [a-z]+day)/i)?.[1] ?? null;
  }

  /** Geeft productgegevens terug, of null als dit geen productpagina is. */
  globalThis.PD_extract = function () {
    const host = location.hostname.toLowerCase();
    let d = null;
    if (/(^|\.)amazon\.[a-z.]+$/.test(host)) d = amazon(host);
    const ld = fromJsonLd();
    if (!d) d = ld;
    else if (ld) d = { ...ld, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null)) };
    if (!d) {
      const price = toNumber(metaContent("property", "product:price:amount") ?? metaContent("property", "og:price:amount") ?? metaContent("itemprop", "price"));
      const title = metaContent("property", "og:title");
      if (!price || !title || !/product/i.test(metaContent("property", "og:type") ?? "product")) return null;
      d = {
        title, price, currency: metaContent("property", "product:price:currency") ?? metaContent("property", "og:price:currency"),
        listPrice: toNumber(metaContent("property", "product:original_price:amount")), image: metaContent("property", "og:image"),
      };
    }
    if (!d.title || !d.price) return null;
    const canonical = document.querySelector('link[rel="canonical"]')?.href ?? metaContent("property", "og:url");
    const currency = d.currency && /^[A-Za-z]{3}$/.test(d.currency) ? d.currency.toUpperCase() : null;
    return {
      url: location.href,
      canonical: canonical && /^https?:\/\//.test(canonical) ? canonical : null,
      title: d.title.slice(0, 400), price: d.price, currency,
      listPrice: d.listPrice && d.listPrice > d.price ? d.listPrice : null,
      image: d.image && /^https?:\/\//.test(d.image) ? d.image : null,
      ean: d.ean ?? findEanInText(),
      deliveryText: (d.deliveryText ?? deliveryFromText())?.slice(0, 200) ?? null,
      inStock: d.inStock ?? null, condition: d.condition ?? null,
    };
  };
})();

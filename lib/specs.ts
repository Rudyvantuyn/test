/**
 * Productsoort en kernkenmerken uit de titel halen, voor "goedkopere alternatieven":
 * zelfde soort en zelfde kernkenmerk (tv: schermformaat, laptop: schermgrootte, telefoon: opslag, ...).
 * Werkt met NL/EN/DE-titels zoals ze bij Coolblue, BCC, Amazon e.d. staan.
 */
export type Category = "tv" | "laptop" | "smartphone" | "tablet" | "headphones" | "console" | "vacuum" | "coffee" | "smartwatch";
export type Specs = {
  size?: number;           // inch (tv, laptop, tablet)
  panel?: "oled" | "miniled" | "qled" | "led";
  res?: "8k" | "4k" | "fhd" | "hd";
  storage?: number;        // GB (telefoon, tablet, laptop)
  ram?: number;            // GB (laptop)
  form?: "over-ear" | "in-ear" | "on-ear";
  anc?: boolean;
  family?: string;         // console
  kind?: string;           // stofzuiger / koffiemachine: soort
};
export type Classified = { category: Category | null; specs: Specs };

const TV_SIZES = new Set([19, 22, 24, 27, 28, 32, 39, 40, 42, 43, 48, 50, 55, 58, 60, 65, 70, 75, 77, 83, 85, 86, 97, 98, 100, 115]);
const norm = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[“”″]/g, '"').replace(/''/g, '"');

function explicitInch(t: string): number | null {
  const m = t.match(/\b(\d{1,3}(?:[.,]\d)?)\s?(?:"|inch\b|in\b|zoll\b|pouces?\b)/) ?? t.match(/\((\d{2,3})\s?"\)/);
  if (m) return Number(m[1].replace(",", "."));
  const cm = t.match(/\b(\d{2,3}(?:[.,]\d)?)\s?cm\b/);
  if (cm) { const inch = Math.round(Number(cm[1].replace(",", ".")) / 2.54); if (TV_SIZES.has(inch)) return inch; }
  return null;
}

/** Schermformaat uit een tv-typenummer (QE55QN70FA, OLED55C46LA, 55G56LS, 40PQS6901, KD-55X85L, 55p8k). */
function tvSizeFromModel(t: string): number | null {
  for (const w of t.split(/[\s(),/|]+/)) {
    const m = w.match(/^(?:oled|qe|ue|gq|gu|tq|kd-?|xr-?|k-?|tx-?|tq)?(\d{2,3})(?=[a-z])/i);
    if (m && /[a-z]/i.test(w.slice(m[0].length)) && TV_SIZES.has(Number(m[1]))) return Number(m[1]);
  }
  return null;
}

const gb = (t: string, re: RegExp) => { const m = t.match(re); return m ? Number(m[1]) * (/tb/i.test(m[2] ?? "") ? 1024 : 1) : null; };

export function classify(title: string, hint?: string | null): Classified {
  const t = norm(title);
  const specs: Specs = {};
  const has = (re: RegExp) => re.test(t);
  let category: Category | null = null;

  if (hint && ["tv", "laptop", "smartphone", "tablet", "headphones", "console", "vacuum", "coffee", "smartwatch"].includes(hint)) category = hint as Category;
  else if (has(/\b(nintendo switch|playstation|ps5|ps4|xbox series|xbox one|steam deck)\b/)) category = "console";
  else if (has(/\b(smartwatch|apple watch|galaxy watch|pixel watch|garmin (forerunner|venu|fenix)|fitbit)\b/)) category = "smartwatch";
  else if (has(/\b(ipad|galaxy tab|tablet|idea tab|surface go|fire hd)\b/)) category = "tablet";
  else if (has(/\b(laptop|notebook|macbook|chromebook|thinkpad|ideapad|vivobook|zenbook|surface laptop)\b/) || has(/\bgalaxy book\d*\b/) || has(/copilot\+? ?pc\b/)) category = "laptop";
  else if (has(/\b(iphone|smartphone|galaxy (s|a|z)\d{1,2}|pixel \d|redmi|oneplus|xiaomi \d|motorola (moto|edge)|nokia [gx]\d|oppo (find|reno|a\d)|vivo [xvy]\d|honor \d|nothing phone|fairphone)/)
    || (has(/\b5g\b/) && has(/\b(64|128|256|512)\s?gb\b/) && !has(/\b(tablet|ipad|router|laptop)\b/))) category = "smartphone";
  else if (has(/\b(koptelefoon|hoofdtelefoon|kopfhorer|headphones?|headset|earbuds|oordopjes|in-ear|over-ear|on-ear|airpods|ult wear|quietcomfort|buds)\b/)
    || has(/\b(wh-1000|wf-1000|wh-ch|wh-ult|mdr-|ath-m|accentum|jbuds|jr\d{3}|momentum \d|tune \d{3}|live \d{3}|soundcore (life|space|liberty)|marshall (major|milton|monitor|motif)|beats (solo|studio|flex)|bose (qc|quietcomfort|nc)|hd ?\d{3})/)
    || (has(/\banc\b/) && !has(/\b(tv|laptop|tablet|smartphone)\b/))) category = "headphones";
  else if ((has(/\b(tv|televisie|fernseher|television|ambilight|bravia|smart tv|google tv|mini-?led|uhd|nanocell|qned|micro rgb)\b/) || has(/\b(qled|oled)(?=\b|\d)/)
      || (has(/\bled\b/) && explicitInch(t) !== null)) && !has(/\b(monitor|beamer|projector|switch)\b/)) category = "tv";
  else if (has(/\b(stofzuiger|staubsauger|vacuum|robotstofzuiger|steelstofzuiger|saugroboter)\b/)) category = "vacuum";
  else if (has(/\b(koffiemachine|espressomachine|koffiezetapparaat|kaffeemaschine|kaffeevollautomat|nespresso|senseo|dolce gusto|espresso machine)\b/)) category = "coffee";

  switch (category) {
    case "tv": {
      const s = explicitInch(t) ?? tvSizeFromModel(t);
      if (s && TV_SIZES.has(Math.round(s))) specs.size = Math.round(s);
      specs.panel = has(/\b(qd-?)?oled/) ? "oled" : has(/\b(mini-?led|neo qled|sqd|micro rgb)\b/) ? "miniled" : has(/\b(qled|qd|qned|nanocell)\b/) ? "qled" : "led";
      specs.res = has(/\b8k\b/) ? "8k" : has(/\b(4k|uhd|ultra hd)\b/) ? "4k" : has(/\b(full hd|fhd|1080p)\b/) ? "fhd" : has(/\bhd\b/) ? "hd" : undefined;
      if (!specs.res) delete specs.res;
      break;
    }
    case "laptop": case "tablet": {
      const s = explicitInch(t);
      if (s && s >= 7 && s <= 18.5) specs.size = s;
      const st = gb(t, /\b(\d{3,4}|[12])\s?(gb|tb)\b(?!\s*(ram|geheugen|ddr))/);
      if (st && st >= 32) specs.storage = st;
      if (category === "laptop") { const r = t.match(/\b(8|12|16|18|24|32|36|48|64)\s?gb\b(?=[^\d]*(ram|geheugen|ddr|-\s*\d{3,4}\s?gb|\s*-\s*\d\s?tb))/) ?? t.match(/\b(8|16|32)\s?gb\s*(ram|geheugen)/); if (r) specs.ram = Number(r[1]); }
      break;
    }
    case "smartphone": {
      const st = gb(t, /\b(64|128|256|512|1)\s?(gb|tb)\b/);
      if (st) specs.storage = st;
      break;
    }
    case "headphones": {
      specs.form = has(/\b(in-ear|oordopjes|earbuds|buds|true wireless|wf-1000|airpods(?! max))/) ? "in-ear"
        : has(/\b(on-ear)\b/) ? "on-ear" : "over-ear";
      specs.anc = has(/\b(nc|anc|noise cancel+ing|noise-cancel+ing|quietcomfort|qc\d*|airpods (pro|max)|momentum \d|accentum)\b/) || has(/\d{3}nc\b|wh-1000|wf-1000|wh-ch\d{3}n\b|ch7\d{2}n\b/);
      break;
    }
    case "console": {
      specs.family = has(/switch 2/) ? "switch2" : has(/switch lite/) ? "switchlite" : has(/switch oled|switch \(oled|oled model/) ? "switcholed" : has(/switch/) ? "switch"
        : has(/ps5 pro|playstation 5 pro/) ? "ps5pro" : has(/ps5|playstation 5/) ? "ps5" : has(/series x/) ? "xboxx" : has(/series s/) ? "xboxs" : undefined;
      if (!specs.family) delete specs.family;
      break;
    }
    case "vacuum": specs.kind = has(/robot|saugroboter/) ? "robot" : has(/steel|stick|akku|draadloos|cordless/) ? "stick" : "other"; break;
    case "coffee": specs.kind = has(/volautomat|vollautomat|bean to cup|espressomachine|espresso machine/) ? "espresso" : has(/nespresso|dolce gusto|senseo|cup|capsule|pad/) ? "capsule" : has(/filter/) ? "filter" : "other"; break;
  }
  return { category, specs };
}

/** Mag product b een alternatief zijn voor product a? (zelfde soort, zelfde kernkenmerk) */
export function comparable(cat: Category, a: Specs, b: Specs): boolean {
  switch (cat) {
    case "tv": return !!a.size && a.size === b.size;
    case "laptop": return !!a.size && !!b.size && Math.abs(a.size - b.size) <= 1 && (!a.ram || !b.ram || b.ram >= a.ram);
    case "tablet": return !!a.size && !!b.size && Math.abs(a.size - b.size) <= 1;
    case "smartphone": return !!a.storage && b.storage === a.storage;
    case "headphones": return a.form === b.form && (!a.anc || !!b.anc);
    case "console": return !!a.family && a.family === b.family;
    case "vacuum": case "coffee": return !!a.kind && a.kind !== "other" && a.kind === b.kind;
    default: return false;
  }
}

/** Korte omschrijving van het kernkenmerk, bv. "55 inch", "256 GB", "noise cancelling". */
export function specLabel(cat: Category, s: Specs, lang = "nl"): string {
  const nc = lang === "de" ? "Noise Cancelling" : "noise cancelling";
  switch (cat) {
    case "tv": return [s.size ? `${s.size} inch` : null, s.panel ? s.panel.replace("miniled", "Mini-LED").toUpperCase().replace("MINI-LED", "Mini-LED") : null].filter(Boolean).join(" · ");
    case "laptop": case "tablet": return [s.size ? `${s.size} inch` : null, s.storage ? `${s.storage >= 1024 ? `${s.storage / 1024} TB` : `${s.storage} GB`}` : null].filter(Boolean).join(" · ");
    case "smartphone": return s.storage ? (s.storage >= 1024 ? `${s.storage / 1024} TB` : `${s.storage} GB`) : "";
    case "headphones": return [s.form, s.anc ? nc : null].filter(Boolean).join(" · ");
    default: return "";
  }
}

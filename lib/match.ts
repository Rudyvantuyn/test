/**
 * Productsleutel om hetzelfde product bij verschillende winkels te herkennen, ook zonder EAN.
 * Sleutel = merk | typenummer(s) | variant (opslag, maat, kleur), taalonafhankelijk.
 * "Sony WH-1000XM5 Zwart" en "Sony WH-1000XM5 draadloze koptelefoon, zwart" -> "sony|wh1000xm5|black"
 */
const COLORS: Record<string, string> = {
  zwart: "black", schwarz: "black", black: "black", noir: "black", nero: "black", negro: "black", midnight: "black", middernacht: "black",
  wit: "white", weiss: "white", weis: "white", white: "white", blanc: "white", bianco: "white", blanco: "white",
  zilver: "silver", silber: "silver", silver: "silver", argent: "silver", argento: "silver", plata: "silver",
  grijs: "grey", grau: "grey", grey: "grey", gray: "grey", gris: "grey", grigio: "grey", antraciet: "grey", anthrazit: "grey",
  blauw: "blue", blau: "blue", blue: "blue", bleu: "blue", blu: "blue", azul: "blue", navy: "blue",
  rood: "red", rot: "red", red: "red", rouge: "red", rosso: "red", rojo: "red",
  groen: "green", grun: "green", green: "green", vert: "green", verde: "green",
  roze: "pink", rosa: "pink", pink: "pink", rose: "pink",
  goud: "gold", gold: "gold", or: "gold", oro: "gold",
  beige: "beige", creme: "beige", cream: "beige", paars: "purple", lila: "purple", purple: "purple", violet: "purple",
  geel: "yellow", gelb: "yellow", yellow: "yellow", jaune: "yellow", oranje: "orange", orange: "orange",
};
const UNIT = /^(\d+(?:[.,]\d+)?)(gb|tb|mb|inch|inch|in|cm|mm|m|w|kw|mah|wh|hz|l|ml|kg|g|v|mp)$/;
const NOISE_MODEL = /^(\d+g|[0-9]+(?:st|nd|rd|th)|gen\d*|v\d)$/;

const COLOR_MOD = new Set(["neon", "licht", "donker", "light", "dark", "hell", "dunkel", "mat", "matt", "glans", "metallic", "pastel"]);
const strip = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const GENERIC = new Set([
  "koptelefoon", "hoofdtelefoon", "kopfhorer", "headphones", "headphone", "earbuds", "oordopjes", "draadloze", "draadloos", "wireless",
  "bluetooth", "smartphone", "telefoon", "laptop", "notebook", "tablet", "televisie", "tv", "fernseher", "stofzuiger", "staubsauger",
  "nieuw", "new", "neu", "de", "het", "the", "der", "die", "das", "met", "with", "mit", "voor", "for", "fur", "en", "and", "und",
  "console", "konsole", "spelcomputer", "spielkonsole",
]);
// Alleen expliciete bundels ("+ hoesje", "incl. lader"); "met noise cancelling" is een omschrijving, geen bundel
const BUNDLE = /\s(?:\+|incl\.?|inclusief|inkl\.?|including)\s/i;

export function matchKey(title: string): string | null {
  let raw = strip(title);
  let bundle = false;
  const b = raw.search(BUNDLE);
  if (b > 0) { raw = raw.slice(0, b); bundle = true; }
  const t = raw.replace(/["'’`()[\],;:&/|–—]/g, " ").replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter((w) => w.replace(/[^a-z0-9]/g, ""));
  if (words.length < 2) return null;
  const brand = words[0].replace(/[^a-z0-9]/g, "");
  if (!brand || !/[a-z]/.test(brand)) return null;

  const models: string[] = [], variants = new Set<string>();
  let family: string | null = null;
  const plain: string[] = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i], next = words[i + 1] ?? "";
    if (/^\d+(?:[.,]\d+)?$/.test(w) && /^(gb|tb|inch|in|cm|mm|w|mah|hz|l|ml|kg|mp)$/.test(next)) { variants.add(`${w.replace(",", ".")}${next === "in" ? "inch" : next}`); i++; continue; }
    const c = COLORS[w.replace(/[^a-z]/g, "")];
    if (c) { variants.add(c); continue; }
    const parts = w.split("-").map((x) => x.replace(/[^a-z]/g, ""));
    if (parts.length > 1 && parts.some((x) => COLORS[x]) && parts.every((x) => COLORS[x] || COLOR_MOD.has(x))) {
      for (const x of parts) if (COLORS[x]) variants.add(COLORS[x]);
      continue;
    }
    const clean = w.replace(/[^a-z0-9.-]/g, "");
    const u = clean.match(UNIT);
    if (u) { variants.add(`${u[1].replace(",", ".")}${u[2] === "in" ? "inch" : u[2]}`); continue; }
    const compact = clean.replace(/[.-]/g, "");
    if (compact.length >= 3 && /\d/.test(compact) && /[a-z]/.test(compact) && !NOISE_MODEL.test(compact)) {
      if (!models.length && i > 1) {
        const prev = words[i - 1].replace(/[^a-z]/g, "");
        if (prev && prev !== brand && !GENERIC.has(prev) && !COLORS[prev]) family = prev;
      }
      models.push(compact);
      continue;
    }
    plain.push(compact);
  }
  let model = [...new Set(models)].sort().join("+");
  if (family) model = `${family}:${model}`;
  if (!model) {
    // Geen letter-cijfercode (bv. "AirPods Max 2", "Momentum 4"): woorden na het merk t/m het eerste getal
    const seq: string[] = [];
    for (const w of plain) {
      if (!w || GENERIC.has(w) || NOISE_MODEL.test(w)) continue;
      seq.push(w);
      if (/^\d+$/.test(w) || seq.length >= 3) break;
    }
    const hasNum = seq.some((w) => /^\d+$/.test(w));
    // Korte namen zonder nummer ("Nintendo Switch Rood/Blauw", "Switch OLED") mogen, lange vage titels niet
    const meaningful = plain.filter((w) => w && !GENERIC.has(w) && !NOISE_MODEL.test(w));
    if (!seq.length || (hasNum ? seq.length < 2 : meaningful.length > 2)) return null;
    model = seq.join("");
  }
  if (bundle) variants.add("bundle");
  return [brand, model, [...variants].sort().join("+")].join("|");
}

/** Hoofdtypenummer, bruikbaar als zoekterm (langste model-token). */
export function primaryModel(key: string | null): string | null {
  if (!key) return null;
  const models = (key.split("|")[1] ?? "").replace(/^[a-z]+:/, "").split("+");
  return models.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Levertijd-tekst (NL/EN/DE/FR) omzetten naar min/max dagen. */
export function parseDeliveryText(text: string | null | undefined): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const s = text.toLowerCase().replace(/\s+/g, " ").trim();
  const none = { min: null, max: null };
  if (/(vandaag|today|heute|aujourd)/.test(s) && !/morgen|tomorrow|morgen/.test(s)) return { min: 0, max: 0 };
  if (/(^|\W)(morgen|tomorrow|next day|next-day|nächsten tag|demain|overnight)/.test(s)) return { min: 1, max: 1 };
  if (/(same day|zelfde dag|gleicher tag)/.test(s)) return { min: 0, max: 0 };
  let h = s.match(/(\d+)\s*(?:h|u|uur|std|stunden|hours?|heures?)\b/);
  if (h) { const dd = Math.max(1, Math.ceil(Number(h[1]) / 24)); return { min: dd, max: dd }; }
  let m = s.match(/(\d+)\s*(?:-|–|tot|to|bis|à|a)\s*(\d+)\s*(werkdag|workday|business day|werktag|arbeitstag|jour ouvr|dag|day|tag|jour)/);
  if (m) {
    const bd = /werk|work|business|arbeits|ouvr/.test(m[3]);
    return { min: Number(m[1]) * (bd ? 1 : 1), max: Math.round(Number(m[2]) * (bd ? 1.4 : 1)) };
  }
  m = s.match(/(\d+)\s*(?:-|–|tot|to|bis|à|a)\s*(\d+)\s*(week|weken|weeks|wochen|woche|semaine)/);
  if (m) return { min: Number(m[1]) * 7, max: Number(m[2]) * 7 };
  m = s.match(/(\d+)\s*(werkdag|workday|business day|werktag|arbeitstag|jour ouvr|dag|day|tag|jour)/);
  if (m) {
    const n = Number(m[1]);
    const bd = /werk|work|business|arbeits|ouvr/.test(m[2]);
    return { min: n, max: bd ? Math.round(n * 1.4) : n };
  }
  m = s.match(/(\d+)\s*(week|weken|weeks|wochen|woche|semaine)/);
  if (m) return { min: Number(m[1]) * 7, max: Number(m[1]) * 7 };
  if (/(week|woche|semaine)/.test(s)) return { min: 5, max: 7 };
  if (/(op voorraad|in stock|auf lager|sofort lieferbar|en stock|available now)/.test(s)) return { min: 1, max: 3 };
  return none;
}

/** Dagen tot een datum (YYYY-MM-DD), minimaal 0. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t - today.getTime()) / 86_400_000));
}

export function normalizeCondition(v: string | null | undefined): "new" | "used" | "refurbished" | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (/refurb|renewed|generalüberholt|reconditionn|opgeknapt/.test(s)) return "refurbished";
  if (/used|gebruikt|gebraucht|occasion|second|tweedehands|pre-owned|open box/.test(s)) return "used";
  if (/new|nieuw|neu|neuf/.test(s)) return "new";
  return null;
}

export function deliveryLabel(min: number | null, max: number | null, locale: string): string {
  if (max === null && min === null) return "";
  const d = max ?? min ?? 0;
  const L = locale.startsWith("nl") ? ["Vandaag", "Morgen in huis", (n: number) => `Binnen ${n} dagen`]
    : locale.startsWith("de") ? ["Heute", "Morgen geliefert", (n: number) => `In ${n} Tagen`]
    : ["Today", "Tomorrow", (n: number) => `Within ${n} days`];
  if (d === 0) return L[0] as string;
  if (d === 1) return L[1] as string;
  return (L[2] as (n: number) => string)(d);
}

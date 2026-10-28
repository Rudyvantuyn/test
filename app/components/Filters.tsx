import type { Dict } from "@/lib/i18n";

export type FilterState = { country?: string; retailer?: string; delivery?: string; condition?: string; maxPrice?: string; minDrop?: string; sort?: string; view?: string };

const RETAILERS = ["amazon", "bol", "ebay", "feed", "generic"] as const;
const RETAILER_LABEL: Record<string, string> = { amazon: "Amazon", bol: "bol.com", ebay: "eBay", feed: "Partner shops", generic: "Other shops" };

export default function Filters({ d, countries, f, action, showDrop = true }: { d: Dict; countries: string[]; f: FilterState; action: string; showDrop?: boolean }) {
  const L = d.filters;
  return (
    <form className="filters" method="get" action={action}>
      {f.view && <input type="hidden" name="view" value={f.view} />}
      <label>{L.country}
        <select name="country" defaultValue={f.country ?? ""}>
          <option value="">{L.all}</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>{L.retailer}
        <select name="retailer" defaultValue={f.retailer ?? ""}>
          <option value="">{L.all}</option>
          {RETAILERS.map((r) => <option key={r} value={r}>{RETAILER_LABEL[r]}</option>)}
        </select>
      </label>
      <label>{L.delivery}
        <select name="delivery" defaultValue={f.delivery ?? ""}>
          <option value="">{L.deliveryAny}</option>
          <option value="0">{L.deliveryToday}</option>
          <option value="1">{L.deliveryTomorrow}</option>
          <option value="3">{L.delivery3}</option>
          <option value="7">{L.delivery7}</option>
        </select>
      </label>
      <label>{L.condition}
        <select name="condition" defaultValue={f.condition ?? ""}>
          <option value="">{L.all}</option>
          <option value="new">{L.condNew}</option>
          <option value="used">{L.condUsed}</option>
          <option value="refurbished">{L.condRefurb}</option>
        </select>
      </label>
      <label>{L.maxPrice}<input name="maxPrice" type="number" min="0" step="1" defaultValue={f.maxPrice ?? ""} style={{ width: 90 }} /></label>
      {showDrop && <label>{L.minDrop} %<input name="minDrop" type="number" min="0" max="99" step="1" defaultValue={f.minDrop ?? ""} style={{ width: 70 }} /></label>}
      <label>{L.sort}
        <select name="sort" defaultValue={f.sort ?? (showDrop ? "drop" : "total")}>
          {showDrop && <option value="drop">{L.sortDrop}</option>}
          <option value="price">{L.sortPrice}</option>
          <option value="total">{L.sortTotal}</option>
          <option value="fast">{L.sortFast}</option>
        </select>
      </label>
      <button type="submit">{L.apply}</button>
      <a href={action}>{L.reset}</a>
    </form>
  );
}

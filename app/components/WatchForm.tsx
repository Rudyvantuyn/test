"use client";
import { useState } from "react";

export type Labels = {
  product: string; email: string; target: string; submit: string; busy: string; free: string; success: string;
  delivery: string; anyShop: string; condition: string; any: string; d1: string; d3: string; d7: string; d0: string;
};

export default function WatchForm({ locale, labels, product = "", currency = "EUR", hasEan = false }:
  { locale: string; labels: Labels; product?: string; currency?: string; hasEan?: boolean }) {
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = { ...Object.fromEntries(fd.entries()), anyRetailer: fd.get("anyRetailer") === "on", locale };
    setState({ busy: true });
    const res = await fetch("/api/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) return setState({ busy: false, err: json.error ?? "Error" });
    if (json.pending) { setState({ busy: false, ok: json.message }); if (!product) form.reset(); return; }
    const price = json.price != null ? new Intl.NumberFormat(undefined, { style: "currency", currency: json.currency ?? "EUR" }).format(json.price) : "";
    setState({ busy: false, ok: labels.success.replace("{title}", json.title).replace("{price}", price ? ` (${price})` : "") });
    if (!product) form.reset();
    if (json.key && typeof window !== "undefined" && !product) window.location.href = `/${locale}/p/${json.key}`;
  }

  return (
    <form className="watch" onSubmit={onSubmit}>
      <input name="product" required placeholder={labels.product} defaultValue={product} readOnly={!!product} />
      <input name="email" type="email" required placeholder={labels.email} />
      <input name="targetPrice" type="number" step="0.01" min="0" placeholder={`${labels.target} ${currency}`} />
      <div className="opts">
        <label className="sel"><span>{labels.delivery}</span>
          <select name="maxDeliveryDays" defaultValue="">
            <option value="">{labels.any}</option>
            <option value="0">{labels.d0}</option>
            <option value="1">{labels.d1}</option>
            <option value="3">{labels.d3}</option>
            <option value="7">{labels.d7}</option>
          </select>
        </label>
        <label className="chk"><input type="checkbox" name="anyRetailer" defaultChecked={!product || hasEan} /><span>{labels.anyShop}</span></label>
        <label className="chk"><input type="checkbox" name="conditionFilter" value="new" /><span>{labels.condition}</span></label>
      </div>
      <button disabled={state.busy}>{state.busy ? labels.busy : labels.submit}</button>
      {state.ok && <div className="msg ok">{state.ok}</div>}
      {state.err && <div className="msg err">{state.err}</div>}
      <small>{labels.free}</small>
    </form>
  );
}

"use client";
import { useState } from "react";

type Labels = { product: string; email: string; target: string; submit: string; busy: string; free: string; success: string };

export default function WatchForm({ locale, labels, product = "", currency = "EUR" }: { locale: string; labels: Labels; product?: string; currency?: string }) {
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = { ...Object.fromEntries(new FormData(form).entries()), locale };
    setState({ busy: true });
    const res = await fetch("/api/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) return setState({ busy: false, err: json.error ?? "Error" });
    const price = json.price != null ? new Intl.NumberFormat(undefined, { style: "currency", currency: json.currency ?? "EUR" }).format(json.price) : "";
    setState({ busy: false, ok: labels.success.replace("{title}", json.title).replace("{price}", price ? ` (${price})` : "") });
    if (!product) form.reset();
  }

  return (
    <form className="watch" onSubmit={onSubmit}>
      <input name="product" required placeholder={labels.product} defaultValue={product} readOnly={!!product} />
      <input name="email" type="email" required placeholder={labels.email} />
      <input name="targetPrice" type="number" step="0.01" min="0" placeholder={`${labels.target} ${currency}`} />
      <button disabled={state.busy}>{state.busy ? labels.busy : labels.submit}</button>
      {state.ok && <div className="msg ok">{state.ok}</div>}
      {state.err && <div className="msg err">{state.err}</div>}
      <small>{labels.free}</small>
    </form>
  );
}

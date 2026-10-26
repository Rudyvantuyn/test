"use client";
import { useState } from "react";

export default function WatchForm({ product = "" }: { product?: string }) {
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setState({ busy: true });
    const res = await fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return setState({ busy: false, err: json.error ?? "Er ging iets mis" });
    setState({
      busy: false,
      ok: `Je volgt nu "${json.title}"${json.price ? ` (huidige prijs €${Number(json.price).toFixed(2)})` : ""}. We mailen je bij een prijsdaling.`,
    });
    form.reset();
  }

  return (
    <form className="watch" onSubmit={onSubmit}>
      <input name="product" required placeholder="Plak een bol.com productlink of EAN" defaultValue={product} readOnly={!!product} />
      <input name="email" type="email" required placeholder="Jouw e-mailadres" />
      <input name="targetPrice" type="number" step="0.01" min="0" placeholder="Optioneel: mail me onder € …" />
      <button disabled={state.busy}>{state.busy ? "Bezig…" : "Volg deze prijs"}</button>
      {state.ok && <div className="msg ok">{state.ok}</div>}
      {state.err && <div className="msg err">{state.err}</div>}
      <small>Gratis. Geen account nodig. Afmelden kan met één klik in elke mail.</small>
    </form>
  );
}

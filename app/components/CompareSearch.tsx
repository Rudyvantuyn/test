"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Zoekt bij andere winkels als er nog geen aanbieders bekend zijn, en ververst de pagina bij resultaat. */
export default function CompareSearch({ productKey, labels }: { productKey: string; labels: { searching: string; none: string } }) {
  const router = useRouter();
  const [state, setState] = useState<"searching" | "none">("searching");
  useEffect(() => {
    let alive = true;
    fetch(`/api/compare/${productKey}`, { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.offers > 0) router.refresh(); else setState("none"); })
      .catch(() => alive && setState("none"));
    return () => { alive = false; };
  }, [productKey, router]);
  return <p className="muted">{state === "searching" ? <><span className="spinner" aria-hidden /> {labels.searching}</> : labels.none}</p>;
}

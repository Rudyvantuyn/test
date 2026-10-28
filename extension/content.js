/* Toont een kleine PriceDrop-knop op productpagina's. Alle paginatekst via textContent (nooit innerHTML). */
(() => {
  if (window.top !== window) return; // niet in iframes
  let T = globalThis.PD_T, LANG = globalThis.PD_LANG;
  let host = null, lastUrl = null, current = null;

  const send = (msg) => new Promise((r) => { try { chrome.runtime.sendMessage(msg, r); } catch { r(null); } });
  const money = (n, c) => { try { return new Intl.NumberFormat(LANG, { style: "currency", currency: c || "EUR" }).format(n); } catch { return n.toFixed(2); } };
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const k of kids) if (k) e.append(k);
    return e;
  };

  const CSS = `
  :host { all: initial }
  .wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111 }
  .pill { display: flex; align-items: center; gap: 8px; background: #1a1a9c; color: #fff; border: 0; border-radius: 999px; padding: 10px 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,.25); cursor: pointer; font: inherit; font-weight: 600 }
  .pill .hint { background: #4fd27a; color: #0b2a14; border-radius: 999px; padding: 2px 8px; font-size: 12px }
  .card { width: 320px; max-width: calc(100vw - 32px); background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.28); padding: 14px; box-sizing: border-box }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px }
  .brand { font-weight: 800; color: #1a1a9c } .x { background: none; border: 0; font-size: 20px; cursor: pointer; color: #666; line-height: 1 }
  .title { font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 6px }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0 } .muted { color: #666; font-size: 12px }
  .price { color: #0a7d32; font-weight: 800 } .offers { margin: 8px 0; padding: 8px; background: #f2fbf5; border-radius: 10px }
  .offers a { color: #0a5d26; font-weight: 600; text-decoration: none } .offers a:hover { text-decoration: underline }
  .offers { background: #f4f4f8 } .offers .save { color: #0a7d32 }
  input, select { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ddd; border-radius: 8px; font: inherit; margin: 4px 0 }
  label.chk { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 4px 0 } label.chk input { width: auto; margin: 0 }
  .go { width: 100%; background: #1a1a9c; color: #fff; border: 0; border-radius: 8px; padding: 10px; font: inherit; font-weight: 700; cursor: pointer; margin-top: 6px }
  .go[disabled] { opacity: .6 } .msg { margin-top: 8px; font-size: 13px } .ok { color: #0a7d32 } .err { color: #c22 }
  .link { color: #1a1a9c; font-size: 12px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; font: inherit }
  .foot { display: flex; justify-content: space-between; margin-top: 8px }
  @media (prefers-color-scheme: dark) {
    .card { background: #1b1b21; color: #eee } .muted { color: #aaa } input, select { background: #111; color: #eee; border-color: #333 }
    .offers { background: #23232b } .offers a { color: #7be3a0 } .offers .save { color: #4fd27a } .price { color: #4fd27a } .link, .brand { color: #9a9aff }
  }`;

  function mount() {
    if (host) return host.shadowRoot;
    host = document.createElement("pricedrop-widget");
    const root = host.attachShadow({ mode: "open" });
    root.append(el("style", { text: CSS }));
    document.documentElement.append(host);
    return root;
  }
  function unmount() { host?.remove(); host = null; }

  function render(page, info, open) {
    const root = mount();
    root.querySelector(".wrap")?.remove();
    const wrap = el("div", { class: "wrap" });
    root.append(wrap);
    const cheaper = (info?.offers ?? []).find((o) => o.total < page.price - 0.01);

    if (!open) {
      const pill = el("button", { class: "pill", onclick: () => render(page, info, true) }, el("span", { text: `🔻 ${T.follow}` }));
      if (cheaper) pill.append(el("span", { class: "hint", text: `${money(page.price - cheaper.total, cheaper.currency)} ${T.cheaper}` }));
      wrap.append(pill);
      return;
    }

    const card = el("div", { class: "card" });
    card.append(el("div", { class: "top" }, el("span", { class: "brand", text: "PriceDrop" }),
      el("button", { class: "x", text: "×", title: "Sluiten", onclick: () => render(page, info, false) })));
    card.append(el("div", { class: "title", text: page.title }));
    card.append(el("div", { class: "row" }, el("span", { text: T.current }), el("span", { class: "price", text: money(page.price, page.currency || info?.currency) })));
    if (info?.lowest) card.append(el("div", { class: "row muted" }, el("span", { text: T.lowest }), el("span", { text: money(info.lowest, info.currency) })));

    if (info?.offers?.length) {
      const box = el("div", { class: "offers" }, el("div", { class: "muted", text: T.others }));
      for (const o of info.offers) {
        const diff = page.price - o.total;
        const right = el("span", { text: `${money(o.total, o.currency)}${o.delivery ? ` · ${o.delivery}` : ""}` });
        if (diff > 0.01) right.append(el("strong", { class: "save", text: ` (${money(diff, o.currency)} ${T.cheaper})` }));
        box.append(el("div", { class: "row" }, el("a", { href: o.link, target: "_blank", rel: "noopener", text: `${o.shop} ${o.country}` }), right));
      }
      card.append(box);
    }

    const email = el("input", { type: "email", placeholder: T.email, autocomplete: "email" });
    const target = el("input", { type: "number", min: "0", step: "0.01", placeholder: T.target });
    const delivery = el("select", {},
      el("option", { value: "", text: `${T.delivery}: ${T.any}` }), el("option", { value: "1", text: `${T.delivery} ${T.d1}` }),
      el("option", { value: "3", text: `${T.delivery} ${T.d3}` }), el("option", { value: "7", text: `${T.delivery} ${T.d7}` }));
    const anyShop = el("input", { type: "checkbox" }); anyShop.checked = true;
    const msg = el("div", { class: "msg" });
    const go = el("button", { class: "go", text: T.followThis });
    send({ type: "settings" }).then((s) => { if (s?.email) email.value = s.email; });

    go.addEventListener("click", async () => {
      if (!email.value || !email.checkValidity()) { email.focus(); return; }
      go.disabled = true; msg.textContent = "";
      const res = await send({
        type: "watch", page, email: email.value.trim(), locale: LANG,
        targetPrice: target.value ? Number(target.value) : null, maxDeliveryDays: delivery.value ? Number(delivery.value) : null,
        anyRetailer: anyShop.checked,
      });
      go.disabled = false;
      if (res?.ok && res.json?.ok) {
        msg.className = "msg ok"; msg.textContent = res.json.pending ? res.json.message : T.tracked;
        if (res.json.pageUrl) msg.append(el("br"), el("a", { href: res.json.pageUrl, target: "_blank", rel: "noopener", class: "link", text: T.openPage }));
      } else { msg.className = "msg err"; msg.textContent = res?.json?.error || T.error; }
    });

    card.append(email, target, delivery, el("label", { class: "chk" }, anyShop, el("span", { text: T.anyShop })), go, msg);
    const foot = el("div", { class: "foot" });
    if (info?.pageUrl) foot.append(el("a", { href: info.pageUrl, target: "_blank", rel: "noopener", class: "link", text: T.openPage }));
    foot.append(el("button", { class: "link", text: T.hideSite, onclick: async () => { await send({ type: "hideHost", host: location.hostname }); unmount(); } }));
    card.append(foot);
    wrap.append(card);
  }

  async function check() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const page = globalThis.PD_extract?.();
    if (!page) { unmount(); current = null; return; }
    const s = await send({ type: "settings" });
    if (!s || !s.showButton || (s.hiddenHosts ?? []).includes(location.hostname)) return;
    if (s.lang && globalThis.PD_ALL?.[s.lang]) { LANG = s.lang; T = globalThis.PD_ALL[s.lang]; }
    current = page;
    render(page, null, false);
    const res = await send({ type: "page", page, locale: LANG });
    if (current === page && res?.ok) render(page, res.json, false);
  }

  check();
  // Single-page shops (varianten, filters): URL-wijzigingen opvangen
  setInterval(check, 1500);
})();

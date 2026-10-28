/* Service worker: praat met pricedropalert.app namens content script en popup. */
const DEFAULT_API = "https://pricedropalert.app";

async function settings() {
  const s = await chrome.storage.local.get(["installId", "email", "contribute", "showButton", "hiddenHosts", "apiBase", "lang"]);
  if (!s.installId) {
    s.installId = crypto.randomUUID();
    await chrome.storage.local.set({ installId: s.installId });
  }
  return {
    installId: s.installId, email: s.email ?? "", contribute: s.contribute ?? true, showButton: s.showButton ?? true,
    hiddenHosts: s.hiddenHosts ?? [], apiBase: s.apiBase || DEFAULT_API, lang: s.lang || "",
  };
}

async function api(path, body) {
  const s = await settings();
  const res = await fetch(`${s.apiBase}${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, installId: s.installId }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await settings();
  if (details.reason === "install") {
    const lang = (chrome.i18n.getUILanguage() || "en").slice(0, 2);
    const loc = ["nl", "de"].includes(lang) ? lang : "en";
    chrome.tabs.create({ url: `${DEFAULT_API}/${loc}/extension?welcome=1` });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    const s = await settings();
    if (msg.type === "settings") return reply(s);
    if (msg.type === "page") return reply(await api("/api/ext/page", { page: msg.page, contribute: s.contribute, locale: msg.locale }));
    if (msg.type === "watch") {
      if (msg.email) await chrome.storage.local.set({ email: msg.email });
      return reply(await api("/api/ext/watch", {
        page: msg.page, email: msg.email, locale: msg.locale, targetPrice: msg.targetPrice ?? null,
        maxDeliveryDays: msg.maxDeliveryDays ?? null, anyRetailer: msg.anyRetailer ?? true,
      }));
    }
    if (msg.type === "hideHost") {
      const hidden = new Set(s.hiddenHosts); hidden.add(msg.host);
      await chrome.storage.local.set({ hiddenHosts: [...hidden] });
      return reply({ ok: true });
    }
    reply({ ok: false });
  })().catch((e) => reply({ ok: false, error: String(e) }));
  return true; // async antwoord
});

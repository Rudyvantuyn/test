let T = globalThis.PD_T, LANG = globalThis.PD_LANG;
const $ = (id) => document.getElementById(id);
function labels() {
$("intro").textContent = T.noProduct;
$("l-email").textContent = T.email;
$("l-show").textContent = T.showButton;
$("l-contrib").textContent = T.contribute;
$("h-contrib").textContent = T.contributeHelp;
$("site").textContent = T.openSite;
$("site").href = `https://pricedropalert.app/${LANG}`;
$("privacy").textContent = T.privacy;
$("privacy").href = `https://pricedropalert.app/${LANG}/privacy`;
$("l-lang").textContent = T.language;
$("o-auto").textContent = T.auto;
}
labels();

chrome.runtime.sendMessage({ type: "settings" }, (s) => {
  $("email").value = s.email || "";
  $("showButton").checked = s.showButton;
  $("contribute").checked = s.contribute;
  $("lang").value = s.lang || "";
  if (s.lang && globalThis.PD_ALL[s.lang]) { LANG = s.lang; T = globalThis.PD_ALL[s.lang]; labels(); }
});
let timer;
const save = () => {
  const lang = $("lang").value;
  T = globalThis.PD_ALL[lang] || globalThis.PD_T; LANG = globalThis.PD_ALL[lang] ? lang : globalThis.PD_LANG; labels();
  chrome.storage.local.set({ email: $("email").value.trim(), showButton: $("showButton").checked, contribute: $("contribute").checked, lang }, () => {
    $("saved").textContent = T.saved; clearTimeout(timer); timer = setTimeout(() => ($("saved").textContent = ""), 1500);
  });
};
$("email").addEventListener("change", save);
$("showButton").addEventListener("change", save);
$("contribute").addEventListener("change", save);
$("lang").addEventListener("change", save);

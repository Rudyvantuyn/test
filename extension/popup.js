const T = globalThis.PD_T, LANG = globalThis.PD_LANG;
const $ = (id) => document.getElementById(id);
$("intro").textContent = T.noProduct;
$("l-email").textContent = T.email;
$("l-show").textContent = T.showButton;
$("l-contrib").textContent = T.contribute;
$("h-contrib").textContent = T.contributeHelp;
$("site").textContent = T.openSite;
$("site").href = `https://pricedropalert.app/${LANG}`;
$("privacy").textContent = T.privacy;
$("privacy").href = `https://pricedropalert.app/${LANG}/privacy`;

chrome.runtime.sendMessage({ type: "settings" }, (s) => {
  $("email").value = s.email || "";
  $("showButton").checked = s.showButton;
  $("contribute").checked = s.contribute;
});
let timer;
const save = () => {
  chrome.storage.local.set({ email: $("email").value.trim(), showButton: $("showButton").checked, contribute: $("contribute").checked }, () => {
    $("saved").textContent = T.saved; clearTimeout(timer); timer = setTimeout(() => ($("saved").textContent = ""), 1500);
  });
};
$("email").addEventListener("change", save);
$("showButton").addEventListener("change", save);
$("contribute").addEventListener("change", save);

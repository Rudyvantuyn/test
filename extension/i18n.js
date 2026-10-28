/* Teksten voor content script en popup (nl/en/de). */
(() => {
  const T = {
    nl: {
      follow: "Volg prijs", followThis: "Volg deze prijs", email: "Jouw e-mailadres", target: "Mail me onder (optioneel)",
      delivery: "Alleen als levering binnen", any: "maakt niet uit", d1: "morgen", d3: "3 dagen", d7: "een week",
      anyShop: "Ook bij andere winkels (zelfde product)", lowest: "Laagste ooit", current: "Nu", cheaper: "goedkoper", others: "Andere winkels",
      tracked: "Je volgt dit product. We mailen bij een daling.", openPage: "Prijsgeschiedenis bekijken",
      hideSite: "Niet tonen op deze site", error: "Er ging iets mis. Probeer het later opnieuw.",
      settings: "Instellingen", contribute: "Help prijzen actueel houden",
      contributeHelp: "Op productpagina's vraagt de extensie aan PriceDrop wat we van het product weten. Staat dit aan, dan bewaren we de prijs als het product al bij ons bekend is. We bewaren geen browsegeschiedenis en geen persoonsgegevens.",
      showButton: "Knop tonen op productpagina's", saved: "Opgeslagen", openSite: "Naar pricedropalert.app",
      noProduct: "Open een productpagina in een webshop om de prijs te volgen.", privacy: "Privacy",
      language: "Taal van knop en e-mails", auto: "Automatisch (browser)",
    },
    en: {
      follow: "Track price", followThis: "Track this price", email: "Your email address", target: "Email me below (optional)",
      delivery: "Only if delivered within", any: "any", d1: "tomorrow", d3: "3 days", d7: "a week",
      anyShop: "Also at other stores (same product)", lowest: "Lowest ever", current: "Now", cheaper: "cheaper", others: "Other stores",
      tracked: "You're tracking this product. We'll email you when it drops.", openPage: "View price history",
      hideSite: "Don't show on this site", error: "Something went wrong. Please try again later.",
      settings: "Settings", contribute: "Help keep prices up to date",
      contributeHelp: "On product pages the extension asks PriceDrop what we know about the product. With this on, we store the price if we already know the product. We store no browsing history and no personal data.",
      showButton: "Show button on product pages", saved: "Saved", openSite: "Go to pricedropalert.app",
      noProduct: "Open a product page in any web shop to track its price.", privacy: "Privacy",
      language: "Language of button and emails", auto: "Automatic (browser)",
    },
    de: {
      follow: "Preis verfolgen", followThis: "Diesen Preis verfolgen", email: "Deine E-Mail-Adresse", target: "Mail mir unter (optional)",
      delivery: "Nur bei Lieferung innerhalb", any: "egal", d1: "morgen", d3: "3 Tagen", d7: "einer Woche",
      anyShop: "Auch bei anderen Shops (gleiches Produkt)", lowest: "Tiefster Preis", current: "Jetzt", cheaper: "günstiger", others: "Andere Shops",
      tracked: "Du verfolgst dieses Produkt. Wir mailen dir bei einem Preisfall.", openPage: "Preisverlauf ansehen",
      hideSite: "Auf dieser Seite nicht zeigen", error: "Etwas ist schiefgelaufen. Bitte später erneut versuchen.",
      settings: "Einstellungen", contribute: "Preise aktuell halten helfen",
      contributeHelp: "Auf Produktseiten fragt die Erweiterung PriceDrop, was wir über das Produkt wissen. Ist dies an, speichern wir den Preis, wenn wir das Produkt schon kennen. Wir speichern keinen Browserverlauf und keine persönlichen Daten.",
      showButton: "Knopf auf Produktseiten zeigen", saved: "Gespeichert", openSite: "Zu pricedropalert.app",
      noProduct: "Öffne eine Produktseite in einem Shop, um den Preis zu verfolgen.", privacy: "Datenschutz",
      language: "Sprache von Knopf und E-Mails", auto: "Automatisch (Browser)",
    },
  };
  const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
  globalThis.PD_LANG = T[lang] ? lang : "en";
  globalThis.PD_T = T[globalThis.PD_LANG];
  globalThis.PD_ALL = T;
})();

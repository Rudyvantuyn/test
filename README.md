# Prijsdaler – geautomatiseerde bol.com prijsalerts (affiliate)

Een kleine, vrijwel volledig geautomatiseerde geldmachine: bezoekers plakken een bol.com-link,
krijgen gratis een mail zodra de prijs daalt, en kopen via jouw affiliate-link (6–8% commissie
op de **hele bestelling** van die bezoeker). Jij hoeft niets handmatig te doen; een cron-job
controleert prijzen en verstuurt mails.

## Waarom dit model

- **Koopintentie op het hoogste punt.** Iemand die een prijsalert instelt wil het product al.
  Een "prijs gedaald"-mail converteert veel beter dan een blogpost of social post.
- **Geen content-tredmolen.** De gebruikers vullen zelf de catalogus (elke watch = een product
  met prijsgeschiedenis = een SEO-pagina `/p/<ean>` voor "<product> prijsgeschiedenis" /
  "laagste prijs").
- **Officiële data, geen scraping.** De bol Marketing Catalog API is gratis voor affiliates,
  1200 calls/uur (≈ 28.000 prijschecks per dag).
- **Gratis infra.** Vercel Hobby (cron inbegrepen), Supabase Free, Resend Free (3.000 mails/maand).

## Wat er in zit

| Pad | Functie |
| --- | --- |
| `/` | Landing + formulier (link/EAN + e-mail + optionele doelprijs) |
| `/p/[ean]` | Prijsgeschiedenis-pagina met grafiek, "laagste prijs ooit"-badge, affiliate-knop, alert-formulier (SEO) |
| `/dalers` | Grootste prijsdalingen van de afgelopen 24 uur (SEO + social-fodder) |
| `/go/[ean]` | Affiliate-redirect met klikregistratie |
| `/api/watch` | Maakt een watch aan, lost bol-URL/productId op naar EAN via de API |
| `/api/cron/check` | Vercel Cron (elke 2 uur): prijzen ophalen, geschiedenis loggen, mails sturen |
| `/api/unsubscribe` | Afmelden met één klik (token) |
| `/api/drops` | JSON-feed van de dalers, voor social-automatisering (Metricool/n8n/Zapier) |
| `supabase/migrations/0001_init.sql` | Tabellen `products`, `price_history`, `watches`, `clicks` + view `top_drops_24h` |

## Installatie (≈ 30 minuten)

1. **bol affiliate-account** aanmaken op https://affiliate.bol.com (gratis, goedkeuring duurt
   doorgaans enkele dagen; een werkende site helpt, dus deploy eerst). Vraag daarna in het
   dashboard **API-toegang** aan → je krijgt `Client ID` + `Client Secret`. Noteer ook je **site-id**.
2. **Supabase**: maak een project, voer `supabase/migrations/0001_init.sql` uit in de SQL Editor.
   Kopieer `Project URL` en `service_role` key.
3. **Resend**: maak een account, verifieer je domein, maak een API key.
4. **Vercel**: importeer deze repo, zet de variabelen uit `.env.example` als Environment Variables
   (inclusief `CRON_SECRET`, een willekeurige lange string). Vercel roept `/api/cron/check` aan
   volgens `vercel.json`.
5. Lokaal draaien: `cp .env.example .env.local`, invullen, `npm install && npm run dev`.

Controleer in je bol affiliate dashboard (Links → Deeplink generator) of het link-formaat in
`lib/bol.ts` (`affiliateLink`) overeenkomt met wat bol voor jouw account genereert.

## Verkeer krijgen (het enige niet-automatische stuk, eenmalig op te zetten)

1. **SEO**: elke gevolgde EAN wordt een pagina. Submit een sitemap, zet interne links vanaf `/dalers`.
   Zoekwoorden als "<product> prijsgeschiedenis", "<product> laagste prijs", "<product> aanbieding".
2. **Social op autopilot**: `/api/drops` geeft de dalers als JSON. Koppel dit via Metricool/n8n aan
   een Pinterest-bord en een TikTok/Instagram "deals"-account: dagelijks "Top 5 prijsdalingen bij bol".
   Pinterest is onderschat voor NL product-deals en heeft lange houdbaarheid.
3. **Reddit/forums**: r/nederland, Tweakers, Bokt, Bol-deals Facebook-groepen; alleen nuttige tips,
   geen spam.
4. **Browserextensie** (later): "Volg deze prijs"-knop op bol-productpagina's; de concurrentie
   (Prijzenvolger, Pricio) heeft slechte reviews of is offline.

## Verdienmodel en realistische cijfers

- Commissie bol: 6–8% afhankelijk van categorie; geldt voor de hele bestelling binnen de cookie.
- Stel 1.000 actieve watches, gemiddeld 1 daling per product per maand, 40% open-rate,
  30% click-rate, 10% conversie, €60 orderwaarde, 7% commissie → ≈ 12 orders → **≈ €50/maand**.
  Bij 20.000 watches ≈ **€1.000/maand**, zonder extra werk. Groei komt vrijwel volledig uit SEO-pagina's
  en de dagelijkse social-feed.
- Extra inkomsten later: premium (€1,99/mnd voor onbeperkt watches + push), Amazon.nl/Coolblue erbij,
  "laagste prijs ooit"-alerts als aparte nieuwsbrief met sponsorregels.

## Grijs gebied: wat wel en niet

- Toegestaan: affiliate-links in alerts, mits je het meldt (staat in mail en footer).
- E-mail: de gebruiker vraagt de alert zelf aan (toestemming), elke mail heeft een afmeldlink. Dat is
  voldoende volgens de Telecommunicatiewet. Stuur geen andere marketing zonder aparte opt-in.
- Niet doen: bol.com scrapen (blokkeert en is tegen de voorwaarden; de API is gratis), nep-reviews,
  kunstmatig opgedreven "was"-prijzen (ACM handhaaft hierop).
- Fiscaal: affiliate-inkomsten zijn belast (resultaat uit overige werkzaamheden of winst uit onderneming).

## Volgende stappen in de code

- `app/sitemap.ts` genereren uit `products`.
- Dagelijkse "nieuw laagste prijs ooit"-nieuwsbrief voor alle gebruikers (hogere mailfrequentie = meer kliks).
- Dubbele opt-in toevoegen als je de mail-reputatie strak wilt houden.

# PriceDrop / Prijsdaler / Preisfall — internationale prijsalerts op autopilot

Gebruikers plakken een productlink van **Amazon (21 landen), bol.com (NL/BE) of vrijwel elke
andere webshop**, krijgen gratis een mail zodra de prijs daalt, en kopen via jouw affiliate-link.
De site is beschikbaar in **NL, EN en DE** (`/nl`, `/en`, `/de`; automatische keuze op basis van
browsertaal). Alles draait op cron-jobs; er is geen handmatig werk.

## Architectuur

```
gebruiker ─▶ /api/watch ─▶ resolveInput()
                              ├─ bol.com      → Marketing Catalog API (officieel, NL/BE)
                              ├─ Amazon       → Product Advertising API 5.0 (officieel, 21 marketplaces)
                              ├─ feed         → feed_offers (productfeeds van Awin/Tradedoubler/Daisycon/Partnerize/CJ)
                              └─ generic      → schema.org/OpenGraph-prijsdata van de productpagina zelf
Vercel Cron ─▶ /api/cron/check?retailer=… (elke 2 uur per provider) → price_history + e-mails (Resend)
Vercel Cron ─▶ /api/cron/feeds (2x per dag) → feeds downloaden en upserten in feed_offers
/go/<key> ─▶ affiliate-redirect per winkel/land + klikregistratie
```

| Provider | Landen | Data | Prijsgeschiedenis publiek | Status |
| --- | --- | --- | --- | --- |
| `bol` | NL, BE | Officiële affiliate-API, 1200 calls/uur | ja | klaar, wacht op API-keys |
| `amazon` | US, CA, MX, BR, GB, DE, FR, IT, ES, NL, BE, SE, PL, TR, AE, SA, EG, IN, JP, AU, SG | PA-API 5.0, GetItems 10 ASINs/call, SigV4 | **nee** (licentie verbiedt dit) | klaar, wacht op Associates-keys |
| `feed` | elk land | Productfeeds met prijs + deeplink | ja | klaar, feeds toevoegen in `feed_sources` |
| `generic` | elk land | HTML van de productpagina | ja | werkt bij o.a. Coolblue; grote ketens blokkeren bots |

Getest op 26-10-2026 vanaf een datacenter-IP: Coolblue geeft nette schema.org-data (werkt),
MediaMarkt, Currys en Fnac geven 403/captcha (Cloudflare). Voor die winkels is de feed-route de
juiste: elk affiliate-netwerk levert dagelijkse CSV-feeds met prijzen en kant-en-klare
tracking-links. Dat is toegestaan, stabiel en schaalt naar honderden winkels.

## Routes

| Pad | Functie |
| --- | --- |
| `/{nl,en,de}` | Landing + formulier |
| `/{locale}/p/{retailer}-{LAND}-{id}` | Productpagina: prijs, grafiek (behalve Amazon), badge "laagste ooit", alert-formulier |
| `/{locale}/deals?country=DE` | Grootste dalers van 24 uur, filterbaar per land |
| `/go/{key}?src=…` | Affiliate-redirect met klikregistratie |
| `/api/watch` | Watch aanmaken (JSON: `product`, `email`, `locale`, `targetPrice`) |
| `/api/cron/check?retailer=bol\|amazon\|feed\|generic` | Prijscheck + mails |
| `/api/cron/feeds[?source=ID]` | Feeds inladen |
| `/api/drops?country=NL` | JSON-feed van dalers voor social-automatisering |
| `/api/unsubscribe?t=…` | Afmelden (ook als `List-Unsubscribe`-header) |
| `/sitemap.xml`, `/robots.txt` | SEO; één taal per product om duplicaten te vermijden |

## Database (Supabase)

Migraties in `supabase/migrations/`:
- `0001_init.sql` — eerste versie (alleen bol). **Staat al op project `vraagtest`.**
- `0002_multi_retailer.sql` — vervangt het schema door het multi-retailer model (`products` met
  `retailer`/`country`/`external_id`, `watches.locale`, functie `products_due`, view `top_drops_24h`).
  Bevat `drop table`-statements en moet daarom door jou bevestigd worden in de SQL Editor.
- `0003_feeds.sql` — `feed_sources` + `feed_offers`, retailer `feed`.

Voer 0002 en 0003 in die volgorde uit in de Supabase SQL Editor (er staat nog geen data in).

### Een feed toevoegen

```sql
insert into feed_sources (network, merchant, merchant_domain, country, currency, feed_url, gzip)
values ('awin', 'MediaMarkt DE', 'mediamarkt.de', 'DE', 'EUR',
        'https://productdata.awin.com/datafeed/download/apikey/XXXX/language/de/fid/12345/columns/aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,search_price,currency,merchant_deep_link,ean/format/csv/delimiter/%2C/compression/gzip/', true);
```
Kolomnamen per netwerk staan in `app/api/cron/feeds/route.ts` en zijn per feed te overschrijven
via de kolom `columns` (jsonb).

## Installatie

1. **Supabase**: migraties 0002 en 0003 uitvoeren. `SUPABASE_URL` + `service_role` key noteren.
2. **Resend**: domein verifiëren, API-key.
3. **Vercel**: repo importeren, variabelen uit `.env.example` invullen, `CRON_SECRET` zetten.
   De crons in `vercel.json` worden automatisch aangemaakt.
4. **bol.com**: affiliate-account op affiliate.bol.com → API-toegang → `BOL_CLIENT_ID`, `BOL_CLIENT_SECRET`, `BOL_SITE_ID`.
5. **Amazon Associates**: aanmelden per regio (EU is één account voor DE/FR/IT/ES/NL/BE/SE/PL/UK/…;
   US/CA/MX/BR één; JP, AU, SG apart). PA-API-keys krijg je pas **na 3 gekwalificeerde verkopen
   binnen 180 dagen** en de toegang vervalt bij 30 dagen zonder verkoop. Zet daarom eerst je
   `tag`-links op de site (werkt zonder API) en laat Amazon-tracking live gaan zodra de keys er zijn.
   Tot die tijd geeft `/api/watch` voor Amazon-links een nette foutmelding.
6. **Affiliate-netwerken** voor de rest: Awin (MediaMarkt, Currys, Otto, Zalando, Fnac, HP, …),
   Tradedoubler, Daisycon (NL), Partnerize, CJ. Per goedgekeurde adverteerder een feed-URL in
   `feed_sources` zetten. Voor winkels zonder feed: `AFFILIATE_LINK_TEMPLATES` koppelt een
   deeplink-template aan een domein voor de `generic`-provider.

## Groei-plan naar "de grootste"

1. **Land voor land, op volgorde van affiliate-opbrengst**: DE (grootste e-commerce in de EU,
   Amazon.de + MediaMarkt/Otto via Awin), UK (Amazon.co.uk + Currys/Argos), US (Amazon.com),
   daarna FR/IT/ES. NL/BE draait al via bol.
2. **SEO per land**: elke gevolgde product-URL wordt een pagina in de landstaal. Submit de sitemap
   bij Google Search Console per locale. Zoekintentie: "<product> price history", "<product>
   lowest price", "<product> Preisverlauf", "<product> prijsgeschiedenis".
3. **Social op autopilot per land**: `/api/drops?country=DE` → Metricool/n8n → Pinterest, TikTok,
   Instagram, X. Pinterest en Telegram-dealkanalen zijn de hoogste converteerders voor deals.
4. **Browserextensie** ("Track this price"-knop op elke productpagina) zodra er verkeer is.
5. **Premium** (€1,99/mnd: onbeperkt watches, push, prijsvoorspelling) en sponsorplekken in de
   dagelijkse deals-mail.

## Regels per bron (zodat je accounts niet verliest)

- **Amazon**: géén prijsgeschiedenis tonen, prijzen max. 24 uur cachen en met tijdstempel tonen,
  affiliate-links niet in e-mail zetten die als "Amazon-mail" overkomen. De code toont voor Amazon
  alleen de actuele prijs; de alert-mail linkt naar jouw pagina en via `/go` naar Amazon.
- **bol.com**: API-data niet misleidend presenteren, credentials server-side houden.
- **Feeds**: alleen feeds van adverteerders waarvoor je bent goedgekeurd.
- **E-mail**: gebruiker vraagt de alert zelf aan, elke mail heeft afmeldlink en `List-Unsubscribe`.
  Voor DE is dubbele opt-in gebruikelijk (nog niet ingebouwd; toe te voegen in `/api/watch`).
- **Scrapen** (`generic`): lage frequentie, één verzoek per product per 2 uur. Winkels die blokkeren
  via de feed-route doen, niet via proxies/captcha-omzeiling.

## Lokaal draaien

```
cp .env.example .env.local   # invullen
npm install && npm run dev
```
`npm run build` en `npm run typecheck` slagen zonder omgevingsvariabelen.

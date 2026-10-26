-- Productfeeds van affiliate-netwerken (Awin, Tradedoubler, Daisycon, Partnerize, CJ)
alter table products drop constraint if exists products_retailer_check;
alter table products add constraint products_retailer_check check (retailer in ('bol','amazon','generic','feed'));

create table feed_sources (
  id int generated always as identity primary key,
  network text not null check (network in ('awin','tradedoubler','daisycon','tradetracker','partnerize','impact','cj')),
  merchant text not null,            -- bv. 'MediaMarkt DE'
  merchant_domain text not null,     -- bv. 'mediamarkt.de'
  country char(2) not null,
  currency char(3) not null default 'EUR',
  feed_url text not null,            -- download-URL van het netwerk (met je eigen API-key erin)
  gzip boolean not null default false,
  delimiter text not null default ',',
  columns jsonb,                     -- optioneel: kolomnamen overschrijven
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_row_count int,
  last_error text,
  created_at timestamptz not null default now()
);

create table feed_offers (
  id bigint generated always as identity primary key,
  source_id int not null references feed_sources(id) on delete cascade,
  merchant_product_id text not null,
  url_hash text not null,
  ean text,
  title text not null,
  url text not null,
  deeplink text not null,
  price numeric(12,2) not null,
  currency char(3) not null,
  image_url text,
  updated_at timestamptz not null default now(),
  unique (source_id, merchant_product_id)
);
create index feed_offers_url_hash_idx on feed_offers (url_hash);
create index feed_offers_ean_idx on feed_offers (ean) where ean is not null;

alter table feed_sources enable row level security;
alter table feed_offers enable row level security;

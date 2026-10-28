-- Vooraf vullen en social-automatisering
create table if not exists seed_urls (
  id int generated always as identity primary key,
  kind text not null default 'category_page' check (kind in ('category_page','bol_category')),
  label text not null,
  url text not null,                -- categoriepagina (generic) of bol category-id (bol_category)
  link_pattern text not null default '',  -- regex die productlinks uit de pagina haalt
  country char(2) not null default 'NL',
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_count int,
  created_at timestamptz not null default now()
);
alter table seed_urls enable row level security;

-- Bijhouden wat al gepost is, zodat dezelfde daler niet twee keer gaat
create table if not exists social_posts (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id) on delete cascade,
  channel text not null,            -- telegram:<chat>, metricool:<network>
  posted_at timestamptz not null default now(),
  unique (product_id, channel)
);
alter table social_posts enable row level security;

-- Startset: Coolblue-categorieën (werkt zonder API-keys)
insert into seed_urls (label, url, link_pattern, country) values
 ('Coolblue koptelefoons', 'https://www.coolblue.nl/koptelefoons', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue laptops', 'https://www.coolblue.nl/laptops', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue smartphones', 'https://www.coolblue.nl/smartphones', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue televisies', 'https://www.coolblue.nl/televisies', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue stofzuigers', 'https://www.coolblue.nl/stofzuigers', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue tablets', 'https://www.coolblue.nl/tablets', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue smartwatches', 'https://www.coolblue.nl/smartwatches', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL'),
 ('Coolblue koffiemachines', 'https://www.coolblue.nl/koffiemachines', 'https://www\.coolblue\.nl/product/[0-9]+/[a-z0-9-]+\.html', 'NL');

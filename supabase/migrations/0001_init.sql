-- Prijsdaler: bol.com prijsalerts + prijsgeschiedenis
create table if not exists products (
  ean text primary key check (ean ~ '^\d{13}$'),
  bol_product_id text,
  title text not null,
  url text not null,
  image_url text,
  last_price numeric(10,2),
  lowest_price numeric(10,2),
  highest_price numeric(10,2),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigint generated always as identity primary key,
  ean text not null references products(ean) on delete cascade,
  price numeric(10,2) not null,
  checked_at timestamptz not null default now()
);
create index if not exists price_history_ean_checked_idx on price_history (ean, checked_at desc);

create table if not exists watches (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ean text not null references products(ean) on delete cascade,
  target_price numeric(10,2),
  mode text not null default 'any_drop' check (mode in ('below','any_drop')),
  unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  active boolean not null default true,
  last_notified_price numeric(10,2),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, ean)
);
create index if not exists watches_ean_active_idx on watches (ean) where active;

create table if not exists clicks (
  id bigint generated always as identity primary key,
  ean text not null,
  watch_id uuid,
  source text,
  created_at timestamptz not null default now()
);

-- Service role omzeilt RLS; zet RLS aan zodat de anon key niets kan lezen.
alter table products enable row level security;
alter table price_history enable row level security;
alter table watches enable row level security;
alter table clicks enable row level security;

-- Publiek leesbaar: producten en prijsgeschiedenis (voor de SEO-pagina's via anon key, optioneel)
create policy "public read products" on products for select using (true);
create policy "public read price_history" on price_history for select using (true);

-- Grootste dalers van de afgelopen 24 uur
create or replace view top_drops_24h as
with latest as (
  select distinct on (ean) ean, price as new_price, checked_at
  from price_history order by ean, checked_at desc
), before as (
  select distinct on (ph.ean) ph.ean, ph.price as old_price
  from price_history ph
  where ph.checked_at < now() - interval '24 hours'
  order by ph.ean, ph.checked_at desc
)
select p.ean, p.title, p.url, p.image_url, b.old_price, l.new_price,
       round((b.old_price - l.new_price) / b.old_price * 100, 1) as drop_pct
from latest l
join before b on b.ean = l.ean
join products p on p.ean = l.ean
where l.new_price < b.old_price
order by drop_pct desc;

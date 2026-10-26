-- Multi-retailer / multi-land. De oude (lege) tabellen uit 0001 worden hernoemd naar legacy_*
-- zodat deze migratie geen destructieve statements bevat; verwijder ze later met
--   drop view legacy_top_drops_24h; drop table legacy_clicks, legacy_watches, legacy_price_history, legacy_products;
alter view if exists top_drops_24h rename to legacy_top_drops_24h;
alter table if exists clicks rename to legacy_clicks;
alter table if exists watches rename to legacy_watches;
alter table if exists price_history rename to legacy_price_history;
alter table if exists products rename to legacy_products;

create table products (
  id uuid primary key default gen_random_uuid(),
  retailer text not null check (retailer in ('bol','amazon','generic')),
  country char(2) not null,
  external_id text not null,
  ean text,
  title text not null,
  url text not null,
  image_url text,
  currency char(3) not null default 'EUR',
  last_price numeric(12,2),
  lowest_price numeric(12,2),
  highest_price numeric(12,2),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (retailer, country, external_id)
);
create index products_check_idx on products (retailer, last_checked_at nulls first);

create table price_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id) on delete cascade,
  price numeric(12,2) not null,
  checked_at timestamptz not null default now()
);
create index price_history_product_idx on price_history (product_id, checked_at desc);

create table watches (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_id uuid not null references products(id) on delete cascade,
  locale text not null default 'en',
  target_price numeric(12,2),
  mode text not null default 'any_drop' check (mode in ('below','any_drop')),
  unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  active boolean not null default true,
  last_notified_price numeric(12,2),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, product_id)
);
create index watches_product_active_idx on watches (product_id) where active;

create table clicks (
  id bigint generated always as identity primary key,
  product_id uuid references products(id) on delete set null,
  watch_id uuid,
  source text,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
alter table price_history enable row level security;
alter table watches enable row level security;
alter table clicks enable row level security;
create policy "public read products" on products for select using (true);
create policy "public read price_history" on price_history for select using (true);

-- Grootste dalers afgelopen 24 uur, per land te filteren
create view top_drops_24h with (security_invoker = true) as
with latest as (
  select distinct on (product_id) product_id, price as new_price
  from price_history order by product_id, checked_at desc
), before as (
  select distinct on (product_id) product_id, price as old_price
  from price_history
  where checked_at < now() - interval '24 hours'
  order by product_id, checked_at desc
)
select p.id as product_id, p.retailer, p.country, p.external_id, p.title, p.url, p.image_url, p.currency,
       b.old_price, l.new_price,
       round((b.old_price - l.new_price) / b.old_price * 100, 1) as drop_pct
from latest l
join before b using (product_id)
join products p on p.id = l.product_id
where l.new_price < b.old_price
order by drop_pct desc;

-- Producten die aan de beurt zijn voor een check, per retailer
create or replace function products_due(p_retailer text, p_limit int)
returns setof products language sql stable as $$
  select p.* from products p
  where p.retailer = p_retailer
    and exists (select 1 from watches w where w.product_id = p.id and w.active)
  order by p.last_checked_at nulls first
  limit p_limit;
$$;

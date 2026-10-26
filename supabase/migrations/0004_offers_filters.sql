-- Levertijd, verzendkosten, conditie, eBay, cross-shop vergelijking en filters
alter table products drop constraint if exists products_retailer_check;
alter table products add constraint products_retailer_check check (retailer in ('bol','amazon','ebay','generic','feed'));
alter table products
  add column if not exists merchant text,
  add column if not exists shipping_cost numeric(12,2),
  add column if not exists delivery_min_days int,
  add column if not exists delivery_max_days int,
  add column if not exists delivery_text text,
  add column if not exists condition text check (condition in ('new','used','refurbished')),
  add column if not exists in_stock boolean not null default true,
  add column if not exists deeplink text;
create index if not exists products_ean_idx on products (ean) where ean is not null;

alter table watches
  add column if not exists ean text,
  add column if not exists any_retailer boolean not null default true,
  add column if not exists max_delivery_days int,
  add column if not exists condition_filter text check (condition_filter in ('new','used','refurbished'));
create index if not exists watches_ean_idx on watches (ean) where active and ean is not null;

alter table feed_offers
  add column if not exists shipping_cost numeric(12,2),
  add column if not exists delivery_text text,
  add column if not exists delivery_min_days int,
  add column if not exists delivery_max_days int,
  add column if not exists condition text,
  add column if not exists in_stock boolean not null default true,
  add column if not exists merchant text;

-- Netwerken uitbreiden
alter table feed_sources drop constraint if exists feed_sources_network_check;
alter table feed_sources add constraint feed_sources_network_check check (network in ('awin','tradedoubler','daisycon','tradetracker','partnerize','impact','cj'));

-- Dalers met alle filtervelden (oude view hernoemen i.p.v. droppen: geen destructieve statements)
alter view if exists top_drops_24h rename to legacy_top_drops_24h_v2;
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
select p.id as product_id, p.retailer, p.country, p.external_id, p.ean, p.title, p.url, p.image_url, p.currency,
       p.merchant, p.shipping_cost, p.delivery_min_days, p.delivery_max_days, p.condition, p.in_stock,
       b.old_price, l.new_price,
       l.new_price + coalesce(p.shipping_cost, 0) as total_price,
       round((b.old_price - l.new_price) / b.old_price * 100, 1) as drop_pct
from latest l
join before b using (product_id)
join products p on p.id = l.product_id
where l.new_price < b.old_price and p.in_stock;

-- Watches die bij een prijsdaling van product p in aanmerking komen (zelfde product, of zelfde EAN bij any_retailer)
create or replace function watches_for_product(p_id uuid)
returns setof watches language sql stable as $$
  select w.* from watches w, products p
  where p.id = p_id and w.active
    and (w.product_id = p.id or (w.any_retailer and w.ean is not null and w.ean = p.ean))
    and (w.max_delivery_days is null or (p.delivery_max_days is not null and p.delivery_max_days <= w.max_delivery_days))
    and (w.condition_filter is null or p.condition is null or p.condition = w.condition_filter);
$$;

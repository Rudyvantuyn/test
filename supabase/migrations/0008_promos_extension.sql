-- Acties (doorgestreepte prijs), herkomst van prijsmetingen, en limiet voor de browserextensie
alter table products
  add column if not exists list_price numeric(12,2),
  add column if not exists promo_until date;
alter table price_history add column if not exists source text not null default 'server';
alter table feed_offers
  add column if not exists list_price numeric(12,2),
  add column if not exists promo_until date;

-- Dalers: list_price achteraan toevoegen (create or replace mag kolommen aan het eind toevoegen)
create or replace view top_drops_24h with (security_invoker = true) as
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
       round((b.old_price - l.new_price) / b.old_price * 100, 1) as drop_pct,
       p.list_price
from latest l
join before b using (product_id)
join products p on p.id = l.product_id
where l.new_price < b.old_price and p.in_stock;

-- Lopende acties: zelfde kolommen als top_drops_24h, met de "van"-prijs als oude prijs
create or replace view current_promos with (security_invoker = true) as
select p.id as product_id, p.retailer, p.country, p.external_id, p.ean, p.title, p.url, p.image_url, p.currency,
       p.merchant, p.shipping_cost, p.delivery_min_days, p.delivery_max_days, p.condition, p.in_stock,
       p.list_price as old_price, p.last_price as new_price,
       p.last_price + coalesce(p.shipping_cost, 0) as total_price,
       round((p.list_price - p.last_price) / p.list_price * 100, 1) as drop_pct,
       p.list_price, p.promo_until
from products p
where p.in_stock and p.list_price is not null and p.last_price is not null and p.list_price > p.last_price
  and (p.promo_until is null or p.promo_until >= current_date)
  and p.last_checked_at > now() - interval '3 days';

-- Limiet per extensie-installatie per dag
create table if not exists ext_rate (
  install_id text not null,
  day date not null default current_date,
  n int not null default 0,
  primary key (install_id, day)
);
alter table ext_rate enable row level security;

create or replace function ext_hit(p_install text, p_limit int)
returns boolean language plpgsql as $$
declare c int;
begin
  insert into ext_rate (install_id, day, n) values (p_install, current_date, 1)
  on conflict (install_id, day) do update set n = ext_rate.n + 1
  returning n into c;
  return c <= p_limit;
end $$;

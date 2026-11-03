-- Productsoort en kernkenmerken voor goedkopere alternatieven
alter table products add column if not exists category text;
alter table products add column if not exists specs jsonb not null default '{}'::jsonb;
create index if not exists products_category_price_idx on products (category, last_price) where in_stock and category is not null;
alter table seed_urls add column if not exists category text;
update seed_urls set category = case
  when label ilike '%televisie%' then 'tv' when label ilike '%koptelefoon%' then 'headphones' when label ilike '%laptop%' then 'laptop'
  when label ilike '%smartphone%' then 'smartphone' when label ilike '%tablet%' then 'tablet' when label ilike '%switch%' then 'console'
  when label ilike '%stofzuiger%' then 'vacuum' when label ilike '%koffie%' then 'coffee' when label ilike '%smartwatch%' then 'smartwatch' end
where category is null;

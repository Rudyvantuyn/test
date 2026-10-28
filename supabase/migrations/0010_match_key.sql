-- Productsleutel (merk|typenummer|variant) om hetzelfde product bij andere winkels te herkennen zonder EAN
alter table products add column if not exists match_key text;
alter table watches add column if not exists match_key text;
create index if not exists products_match_key_idx on products (match_key) where match_key is not null;
create index if not exists watches_match_key_idx on watches (match_key) where active and match_key is not null;

create or replace function watches_for_product(p_id uuid)
returns setof watches language sql stable as $$
  select w.* from watches w, products p
  where p.id = p_id and w.active
    and (
      w.product_id = p.id
      or (w.any_retailer and w.ean is not null and w.ean = p.ean)
      or (w.any_retailer and w.match_key is not null and w.match_key = p.match_key)
    )
    and (w.max_delivery_days is null or (p.delivery_max_days is not null and p.delivery_max_days <= w.max_delivery_days))
    and (w.condition_filter is null or p.condition is null or p.condition = w.condition_filter);
$$;

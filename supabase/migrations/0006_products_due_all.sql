-- Ook producten zonder alert periodiek controleren (voor de dealspagina, social en SEO).
-- Producten met een actieve alert: elke run. Overige producten: ongeveer twee keer per dag.
create or replace function products_due(p_retailer text, p_limit int)
returns setof products language sql stable as $$
  select p.* from products p
  where p.retailer = p_retailer
    and (
      exists (select 1 from watches w where w.product_id = p.id and w.active)
      or p.last_checked_at is null
      or p.last_checked_at < now() - interval '11 hours'
    )
  order by
    (exists (select 1 from watches w where w.product_id = p.id and w.active)) desc,
    p.last_checked_at nulls first
  limit p_limit;
$$;

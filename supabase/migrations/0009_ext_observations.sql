-- Herkomst van extensie-metingen, voor bevestiging van grote dalingen door een tweede gebruiker
alter table price_history add column if not exists install_id text;
create index if not exists price_history_unconfirmed_idx on price_history (product_id, checked_at desc) where source = 'ext-unconfirmed';

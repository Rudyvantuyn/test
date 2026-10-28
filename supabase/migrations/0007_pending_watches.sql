-- Aanvragen voor bronnen die nog niet gekoppeld zijn (bv. Amazon zonder API-sleutels).
-- Worden automatisch omgezet in echte watches zodra de bron actief is (cron /api/cron/seed).
create table if not exists pending_watches (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  url text not null,
  retailer text not null,
  country char(2),
  external_id text,
  locale text not null default 'en',
  target_price numeric(12,2),
  max_delivery_days int,
  condition_filter text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (email, url)
);
alter table pending_watches enable row level security;

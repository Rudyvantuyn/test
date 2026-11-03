-- Moment van de laatste zoektocht naar andere aanbieders (max. 1x per 12 uur per product)
alter table products add column if not exists last_compared_at timestamptz;

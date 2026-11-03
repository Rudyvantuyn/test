-- Beoordelingen van de winkel (genormaliseerd naar 0-5) voor kwaliteit bij alternatieven
alter table products add column if not exists rating numeric(3,2);
alter table products add column if not exists review_count int;

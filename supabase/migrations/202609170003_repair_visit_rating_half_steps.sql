-- Repair projects that were initialized before half-point ratings were introduced.
-- This is intentionally idempotent so it can also be run directly in the SQL Editor.
alter table public.visits
  drop constraint if exists visits_rating_check;

alter table public.visits
  alter column rating type numeric(2,1) using rating::numeric(2,1);

alter table public.visits
  add constraint visits_rating_check
  check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

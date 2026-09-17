alter table public.visits
  drop constraint if exists visits_rating_check;

alter table public.visits
  add constraint visits_rating_check check (rating between 1 and 10);

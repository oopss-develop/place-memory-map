alter table public.visits
  add column if not exists is_planned boolean not null default false;

create index if not exists visits_group_planned_idx
  on public.visits(group_id, is_planned, visited_on desc)
  where deleted_at is null;

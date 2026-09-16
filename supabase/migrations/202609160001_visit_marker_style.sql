alter table public.visits
  add column if not exists marker_style text not null default 'black-1'
  check (marker_style ~ '^(color|black)-[0-9]+$');

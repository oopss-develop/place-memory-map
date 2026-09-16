alter table public.visits
  add column if not exists marker_style text not null default 'pin-1'
  check (marker_style ~ '^pin-[a-z0-9-]{1,40}$');

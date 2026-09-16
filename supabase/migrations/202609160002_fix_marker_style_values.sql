alter table public.visits
  add column if not exists marker_style text not null default 'black-1';

alter table public.visits
  alter column marker_style set default 'black-1';

update public.visits
set marker_style = 'black-1'
where marker_style is null
   or marker_style !~ '^(color|black)-[0-9]+$';

alter table public.visits
  drop constraint if exists visits_marker_style_check;

alter table public.visits
  add constraint visits_marker_style_check
  check (marker_style ~ '^(color|black)-[0-9]+$');

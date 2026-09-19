-- Keep the existing numbered pins and allow the named square/round pins.
alter table public.visits
  drop constraint if exists visits_marker_style_check;

alter table public.visits
  add constraint visits_marker_style_check
  check (
    marker_style ~ '^((color|black)-[0-9]+|(square|round)-(cat|plane|gamepad|camp|museum|night|car|forest|mountain|water|park)-(color|black))$'
  );

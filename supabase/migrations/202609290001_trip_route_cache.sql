begin;

-- The route is generated only after an explicit user action. Cache keys cover
-- the trip, date, map provider, and ordered location sequence.
create table if not exists public.trip_route_cache (
  trip_id uuid not null references public.trips(id) on delete cascade,
  route_date date not null,
  provider text not null check (provider in ('kakao', 'osm')),
  signature text not null check (signature ~ '^[0-9a-f]{64}$'),
  route_kind text not null check (route_kind in ('road', 'straight')),
  route_points jsonb not null check (case when jsonb_typeof(route_points) = 'array' then jsonb_array_length(route_points) between 2 and 4000 else false end),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (trip_id, route_date, provider, signature)
);

alter table public.trip_route_cache enable row level security;
drop policy if exists trip_route_cache_read on public.trip_route_cache;
create policy trip_route_cache_read on public.trip_route_cache for select to authenticated
  using (exists (
    select 1 from public.trips t
    where t.id = trip_id and t.deleted_at is null and private.is_group_member(t.group_id)
  ));
revoke all on public.trip_route_cache from public, anon, authenticated;
grant select on public.trip_route_cache to authenticated;

drop function if exists public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer);
create function public.save_trip_route(
  target_trip_id uuid,
  p_route_date date,
  route_provider text,
  route_signature text,
  route_kind text,
  route_points jsonb,
  distance_meters integer default null,
  duration_seconds integer default null
) returns public.trip_route_cache
language plpgsql security definer set search_path = '' as $$
declare parent public.trips; caller uuid := auth.uid(); result public.trip_route_cache;
begin
  select * into parent from public.trips where id = target_trip_id and deleted_at is null for update;
  if not found or caller is null or not private.is_group_member(parent.group_id, caller) then
    raise exception '여행을 찾을 수 없거나 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_route_date < parent.start_date or p_route_date > parent.end_date then
    raise exception '여행 기간 밖의 날짜입니다.' using errcode = '22023';
  end if;
  if route_provider not in ('kakao', 'osm') or route_signature !~ '^[0-9a-f]{64}$'
    or route_kind not in ('road', 'straight') or jsonb_typeof(route_points) is distinct from 'array' then
    raise exception '경로 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;
  if jsonb_array_length(route_points) not between 2 and 4000 or exists (
    select 1 from pg_catalog.jsonb_array_elements(route_points) as route_point(value)
    where case
      when jsonb_typeof(route_point.value) is distinct from 'object' then true
      when jsonb_typeof(route_point.value->'latitude') is distinct from 'number' then true
      when jsonb_typeof(route_point.value->'longitude') is distinct from 'number' then true
      else (route_point.value->>'latitude')::numeric not between -90 and 90
        or (route_point.value->>'longitude')::numeric not between -180 and 180
    end
  ) then
    raise exception '경로 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;
  insert into public.trip_route_cache(trip_id, route_date, provider, signature, route_kind, route_points, distance_meters, duration_seconds, created_by)
  values (target_trip_id, p_route_date, route_provider, route_signature, route_kind, route_points, distance_meters, duration_seconds, caller)
  on conflict (trip_id, route_date, provider, signature) do update set
    route_kind = excluded.route_kind,
    route_points = excluded.route_points,
    distance_meters = excluded.distance_meters,
    duration_seconds = excluded.duration_seconds
  returning * into result;
  return result;
end $$;

revoke all on function public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer) to authenticated;
commit;

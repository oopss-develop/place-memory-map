begin;

alter table public.trip_route_cache add column route_legs jsonb not null default '[]'::jsonb check (jsonb_typeof(route_legs) = 'array');

drop function if exists public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer);
create function public.save_trip_route(
  target_trip_id uuid,
  p_route_date date,
  route_provider text,
  route_signature text,
  route_kind text,
  route_points jsonb,
  distance_meters integer default null,
  duration_seconds integer default null,
  p_route_legs jsonb default '[]'::jsonb
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
  if jsonb_typeof(p_route_legs) is distinct from 'array' then
    raise exception '구간 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_route_legs) > 31 or (route_kind = 'straight' and jsonb_array_length(p_route_legs) > 0) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_route_legs) as leg(value)
    where case
      when jsonb_typeof(leg.value) is distinct from 'object' then true
      when jsonb_typeof(leg.value->'fromItemId') is distinct from 'string' or jsonb_typeof(leg.value->'toItemId') is distinct from 'string' then true
      when coalesce(leg.value->>'fromItemId', '') = '' or coalesce(leg.value->>'toItemId', '') = '' then true
      when jsonb_typeof(leg.value->'distanceMeters') is distinct from 'number' or jsonb_typeof(leg.value->'durationSeconds') is distinct from 'number' then true
      else (leg.value->>'distanceMeters')::numeric < 0 or (leg.value->>'durationSeconds')::numeric < 0
        or (leg.value->>'distanceMeters')::numeric <> trunc((leg.value->>'distanceMeters')::numeric)
        or (leg.value->>'durationSeconds')::numeric <> trunc((leg.value->>'durationSeconds')::numeric)
    end
  ) then
    raise exception '구간 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;
  insert into public.trip_route_cache(trip_id, route_date, provider, signature, route_kind, route_points, distance_meters, duration_seconds, route_legs, created_by)
  values (target_trip_id, p_route_date, route_provider, route_signature, route_kind, route_points, distance_meters, duration_seconds, p_route_legs, caller)
  on conflict (trip_id, route_date, provider, signature) do update set
    route_kind = excluded.route_kind,
    route_points = excluded.route_points,
    distance_meters = excluded.distance_meters,
    duration_seconds = excluded.duration_seconds,
    route_legs = excluded.route_legs
  returning * into result;
  return result;
end $$;

revoke all on function public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_trip_route(uuid, date, text, text, text, jsonb, integer, integer, jsonb) to authenticated;
commit;

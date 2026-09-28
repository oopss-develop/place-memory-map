-- Apply after 202609190001. Safe to run as one transaction in SQL Editor.
begin;

alter table public.places add constraint places_id_group_unique unique (id, group_id);
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  time_zone text not null default 'Asia/Seoul',
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, group_id)
);
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  trip_id uuid not null,
  place_id uuid not null,
  starts_at timestamp without time zone not null,
  ends_at timestamp without time zone not null check (ends_at > starts_at),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text not null default '' check (char_length(note) <= 3000),
  marker_style text not null default 'black-9' check (marker_style ~ '^((color|black)-([1-9]|1[0-6])|(square|round)-(cat|plane|gamepad|camp|museum|night|car|forest|mountain|water|park)-(color|black))$'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (trip_id, group_id) references public.trips(id, group_id) on delete cascade,
  foreign key (place_id, group_id) references public.places(id, group_id)
);
create index trips_group_dates_idx on public.trips(group_id, start_date) where deleted_at is null;
create index schedule_trip_time_idx on public.schedule_items(trip_id, starts_at) where deleted_at is null;
create index schedule_place_idx on public.schedule_items(place_id, group_id);

create function private.validate_trip() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception '유효한 IANA 시간대를 선택해 주세요.' using errcode = '22023';
  end if;
  if not isfinite(new.start_date) or not isfinite(new.end_date) then
    raise exception '유효한 여행 날짜를 입력해 주세요.' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.group_id <> old.group_id) then
    raise exception '여행의 소속 지도는 변경할 수 없습니다.' using errcode = '22023';
  end if;
  if new.deleted_at is null and exists(select 1 from public.schedule_items
    where trip_id = new.id and deleted_at is null
      and (starts_at < new.start_date::timestamp or ends_at > (new.end_date + 1)::timestamp)) then
    raise exception '새 여행 기간 밖의 일정을 먼저 옮기거나 삭제해 주세요.' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trips_validate before insert or update on public.trips
  for each row execute function private.validate_trip();

create function private.validate_schedule_item() returns trigger
language plpgsql set search_path = '' as $$
declare parent public.trips;
begin
  -- Every supported write locks the trip first, then its items.
  select * into parent from public.trips where id = new.trip_id for update;
  if not found or parent.group_id <> new.group_id then
    raise exception '여행과 일정의 지도가 일치하지 않습니다.' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and (new.trip_id <> old.trip_id or new.group_id <> old.group_id or new.id <> old.id) then
    raise exception '일정의 소속 여행은 변경할 수 없습니다.' using errcode = '22023';
  end if;
  if new.deleted_at is null and (parent.deleted_at is not null
    or not isfinite(new.starts_at) or not isfinite(new.ends_at)
    or new.starts_at < parent.start_date::timestamp or new.ends_at > (parent.end_date + 1)::timestamp) then
    raise exception '일정은 여행 기간 안에 있어야 합니다.' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger schedule_items_validate before insert or update on public.schedule_items
  for each row execute function private.validate_schedule_item();

alter table public.trips enable row level security;
alter table public.schedule_items enable row level security;
create policy trips_read on public.trips for select to authenticated
  using (deleted_at is null and private.is_group_member(group_id));
create policy schedule_items_read on public.schedule_items for select to authenticated
  using (deleted_at is null and private.is_group_member(group_id)
    and exists(select 1 from public.trips t where t.id = trip_id and t.deleted_at is null));
revoke all on public.trips, public.schedule_items from public, anon, authenticated;
grant select on public.trips, public.schedule_items to authenticated;

-- Only these RPCs can write. Never trust caller-supplied authors or group IDs
-- for updates, and never grant these functions to anonymous callers.
create function public.save_trip(payload jsonb) returns public.trips
language plpgsql security definer set search_path = '' as $$
declare result public.trips; caller uuid := auth.uid(); target uuid := (payload->>'id')::uuid;
begin
  if caller is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if target is null then
    if not private.is_group_member((payload->>'groupId')::uuid, caller) then
      raise exception '이 지도의 멤버만 여행을 만들 수 있습니다.' using errcode = '42501';
    end if;
    insert into public.trips(group_id, name, start_date, end_date, time_zone, created_by, updated_by)
    values ((payload->>'groupId')::uuid, btrim(payload->>'name'), (payload->>'startDate')::date,
      (payload->>'endDate')::date, coalesce(payload->>'timeZone', 'Asia/Seoul'), caller, caller)
    returning * into result;
  else
    select * into result from public.trips where id = target and deleted_at is null for update;
    if not found or not private.is_group_member(result.group_id, caller) then
      raise exception '여행을 찾을 수 없거나 권한이 없습니다.' using errcode = '42501';
    end if;
    if result.version is distinct from (payload->>'version')::integer then
      raise exception '다른 멤버가 먼저 수정했습니다. 최신 일정을 확인해 주세요.' using errcode = '40001';
    end if;
    update public.trips set name = btrim(payload->>'name'), start_date = (payload->>'startDate')::date,
      end_date = (payload->>'endDate')::date, time_zone = payload->>'timeZone',
      version = version + 1, updated_by = caller where id = target returning * into result;
  end if;
  return result;
end $$;

create function public.delete_trip(target_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare parent public.trips; caller uuid := auth.uid();
begin
  select * into parent from public.trips where id = target_id and deleted_at is null for update;
  if not found or caller is null or not private.is_group_member(parent.group_id, caller) then
    raise exception '여행을 찾을 수 없거나 권한이 없습니다.' using errcode = '42501';
  end if;
  if parent.version is distinct from expected_version then
    raise exception '다른 멤버가 먼저 수정했습니다. 최신 일정을 확인해 주세요.' using errcode = '40001';
  end if;
  update public.schedule_items set deleted_at = now(), updated_by = caller, version = version + 1
    where trip_id = target_id and deleted_at is null;
  update public.trips set deleted_at = now(), updated_by = caller, version = version + 1 where id = target_id;
end $$;

create function public.save_schedule_item(target_trip_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare parent public.trips; previous public.schedule_items; caller uuid := auth.uid();
  target uuid := (payload->>'id')::uuid; location_id uuid := (payload->'place'->>'id')::uuid;
  location jsonb := payload->'place';
begin
  select * into parent from public.trips where id = target_trip_id and deleted_at is null for update;
  if not found or caller is null or not private.is_group_member(parent.group_id, caller) then
    raise exception '여행을 찾을 수 없거나 권한이 없습니다.' using errcode = '42501';
  end if;
  if target is not null then
    select * into previous from public.schedule_items where id = target and trip_id = target_trip_id and deleted_at is null for update;
    if not found then raise exception '일정을 찾을 수 없습니다.' using errcode = '22023'; end if;
    if previous.version is distinct from (payload->>'version')::integer then
      raise exception '다른 멤버가 먼저 수정했습니다. 최신 일정을 확인해 주세요.' using errcode = '40001';
    end if;
  end if;
  if location_id is not null then
    if not exists(select 1 from public.places where id = location_id and group_id = parent.group_id) then
      raise exception '이 지도의 장소만 사용할 수 있습니다.' using errcode = '42501';
    end if;
  else
    if location->>'provider' = 'kakao' and nullif(location->>'providerPlaceId', '') is not null then
      insert into public.places(group_id, provider, provider_place_id, name, address, category, latitude, longitude, created_by)
      values(parent.group_id, 'kakao', location->>'providerPlaceId', location->>'name', coalesce(location->>'address',''),
        coalesce(location->>'category',''), (location->>'latitude')::numeric, (location->>'longitude')::numeric, caller)
      on conflict (group_id, provider, provider_place_id) where provider_place_id is not null do nothing
      returning id into location_id;
      if location_id is null then select id into location_id from public.places where group_id = parent.group_id
        and provider = 'kakao' and provider_place_id = location->>'providerPlaceId'; end if;
    else
      insert into public.places(group_id, provider, name, address, category, latitude, longitude, created_by)
      values(parent.group_id, 'manual', location->>'name', coalesce(location->>'address',''), coalesce(location->>'category','직접 지정'),
        (location->>'latitude')::numeric, (location->>'longitude')::numeric, caller) returning id into location_id;
    end if;
  end if;
  if target is null then
    insert into public.schedule_items(group_id, trip_id, place_id, starts_at, ends_at, title, note, marker_style, created_by, updated_by)
    values(parent.group_id, target_trip_id, location_id, (payload->>'startsAt')::timestamp, (payload->>'endsAt')::timestamp,
      btrim(payload->>'title'), coalesce(payload->>'note',''), coalesce(payload->>'markerStyle','black-9'), caller, caller)
    returning id into target;
  else
    update public.schedule_items set place_id = location_id, starts_at = (payload->>'startsAt')::timestamp,
      ends_at = (payload->>'endsAt')::timestamp, title = btrim(payload->>'title'), note = coalesce(payload->>'note',''),
      marker_style = coalesce(payload->>'markerStyle','black-9'), version = version + 1, updated_by = caller where id = target;
  end if;
  -- Trip version also covers child changes, protecting a stale whole-trip delete.
  update public.trips set version = version + 1, updated_by = caller where id = parent.id;
  return target;
end $$;

create function public.delete_schedule_item(target_trip_id uuid, target_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare parent public.trips; caller uuid := auth.uid();
begin
  select * into parent from public.trips where id = target_trip_id and deleted_at is null for update;
  if not found or caller is null or not private.is_group_member(parent.group_id, caller) then
    raise exception '여행을 찾을 수 없거나 권한이 없습니다.' using errcode = '42501';
  end if;
  update public.schedule_items set deleted_at = now(), updated_by = caller, version = version + 1
    where id = target_id and trip_id = target_trip_id and version = expected_version and deleted_at is null;
  if not found then raise exception '다른 멤버가 먼저 수정했습니다. 최신 일정을 확인해 주세요.' using errcode = '40001'; end if;
  update public.trips set version = version + 1, updated_by = caller where id = parent.id;
end $$;

revoke all on function public.save_trip(jsonb), public.delete_trip(uuid, integer),
  public.save_schedule_item(uuid, jsonb), public.delete_schedule_item(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.save_trip(jsonb), public.delete_trip(uuid, integer),
  public.save_schedule_item(uuid, jsonb), public.delete_schedule_item(uuid, uuid, integer) to authenticated;
revoke all on function private.validate_trip(), private.validate_schedule_item() from public, anon, authenticated;
commit;

begin;
create table if not exists public.memory_boards (
  group_id uuid primary key references public.groups(id) on delete cascade,
  background text not null default 'pegboard' check (background in ('pegboard','whiteboard','cork')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 80),
  version integer not null default 1 check (version > 0),
  updated_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(),
  request_id uuid not null, request_payload jsonb not null
);
alter table public.memory_boards enable row level security;
drop policy if exists memory_boards_read on public.memory_boards;
create policy memory_boards_read on public.memory_boards for select to authenticated using (private.is_group_member(group_id));
revoke all on public.memory_boards from public,anon,authenticated;
grant select on public.memory_boards to authenticated;
create or replace function public.save_memory_board(payload jsonb) returns public.memory_boards
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); gid uuid := (payload->>'groupId')::uuid;
  current_board public.memory_boards; entry jsonb; ids uuid[] := '{}'; eid uuid;
  vx numeric; vy numeric; vw numeric; vh numeric; vr numeric;
begin
  if caller is null or not private.is_group_member(gid, caller) then
    raise exception '이 지도의 멤버만 보드를 수정할 수 있습니다.' using errcode='42501';
  end if;
  -- The group row serializes initial creation as well as subsequent saves.
  perform 1 from public.groups where id=gid for update;
  select * into current_board from public.memory_boards where group_id=gid for update;
  if current_board.request_id = (payload->>'requestId')::uuid then
    if current_board.request_payload is distinct from payload then
      raise exception '같은 저장 요청의 내용이 달라졌습니다.' using errcode='40001';
    end if;
    return current_board;
  end if;
  if coalesce(current_board.version,0) is distinct from (payload->>'version')::integer then
    raise exception '다른 멤버가 먼저 보드를 수정했습니다.' using errcode='40001';
  end if;
  if payload->>'background' not in ('pegboard','whiteboard','cork') or payload->>'background' is null
    or jsonb_typeof(payload->'items') is distinct from 'array' then
    raise exception '보드 형식을 확인해 주세요.' using errcode='22023';
  end if;
  if jsonb_array_length(payload->'items')>80 then raise exception '보드에는 최대 80개까지 붙일 수 있습니다.' using errcode='22023'; end if;
  for entry in select value from jsonb_array_elements(payload->'items') loop
    eid := (entry->>'id')::uuid;
    vx := (entry->>'x')::numeric; vy := (entry->>'y')::numeric;
    vw := (entry->>'width')::numeric; vh := (entry->>'height')::numeric; vr := (entry->>'rotation')::numeric;
    if eid is null or eid=any(ids) or entry->>'kind' not in ('photo','note') or entry->>'kind' is null
      or entry->>'color' not in ('cream','rose','sage','sky') or entry->>'color' is null
      or entry->>'attachment' not in ('tape','pin') or entry->>'attachment' is null
      or entry->>'text' is null or char_length(entry->>'text')>500
      or vx is null or vy is null or vw is null or vh is null or vr is null
      or not (vx>=0 and vy>=0 and vw between 120 and 560 and vh between 100 and 600
        and vx+vw<=1200 and vy+vh<=840 and vr between -180 and 180) then
      raise exception '사진과 메모의 위치·크기를 확인해 주세요.' using errcode='22023';
    end if;
    ids := array_append(ids,eid);
    if entry->>'kind'='photo' then
      -- Deleted source photos may stay on a board as unavailable placeholders.
      -- A newly introduced photo must belong to an active visit in this group.
      if not exists(select 1 from public.visit_photos p join public.visits v on v.id=p.visit_id
        where p.id=(entry->>'photoId')::uuid and v.id=(entry->>'visitId')::uuid and v.group_id=gid
          and p.deleted_at is null and p.upload_state='complete' and v.deleted_at is null and not v.is_planned)
        and not exists(select 1 from jsonb_array_elements(coalesce(current_board.items,'[]')) old
          where old->>'id'=entry->>'id' and old->>'photoId'=entry->>'photoId' and old->>'visitId'=entry->>'visitId') then
        raise exception '이 지도의 방문 사진만 붙일 수 있습니다.' using errcode='42501';
      end if;
    end if;
  end loop;
  insert into public.memory_boards(group_id,background,items,version,updated_by,request_id,request_payload)
    values(gid,payload->>'background',payload->'items',coalesce(current_board.version,0)+1,caller,(payload->>'requestId')::uuid,payload)
    on conflict(group_id) do update set background=excluded.background,items=excluded.items,
      version=excluded.version,updated_by=caller,updated_at=now(),request_id=excluded.request_id,request_payload=excluded.request_payload
    returning * into current_board;
  return current_board;
end $$;
revoke all on function public.save_memory_board(jsonb) from public,anon;
grant execute on function public.save_memory_board(jsonb) to authenticated;
-- Repeatable. Export uses one database statement for a consistent snapshot.
create or replace function public.export_workspace_backup() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid(); gids uuid[]; vids uuid[]; tids uuid[]; pids uuid[]; payload jsonb;
begin
  if caller is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  select coalesce(array_agg(group_id),'{}'::uuid[]) into gids from public.group_members where user_id=caller;
  select coalesce(array_agg(id),'{}'::uuid[]) into vids from public.visits where group_id=any(gids);
  select coalesce(array_agg(id),'{}'::uuid[]) into tids from public.trips where group_id=any(gids);
  select coalesce(array_agg(distinct person),'{}'::uuid[]) into pids from (
    select caller as person union select user_id from public.group_members where group_id=any(gids)
    union select created_by from public.groups where id=any(gids)
    union select created_by from public.places where group_id=any(gids)
    union select created_by from public.visits where id=any(vids)
    union select updated_by from public.visits where id=any(vids)
    union select user_id from public.visit_participants where visit_id=any(vids)
    union select uploaded_by from public.visit_photos where visit_id=any(vids)
    union select author_id from public.visit_comments where visit_id=any(vids)
    union select actor_id from public.activity_logs where group_id=any(gids)
    union select created_by from public.trips where id=any(tids)
    union select updated_by from public.trips where id=any(tids)
    union select created_by from public.schedule_items where trip_id=any(tids)
    union select updated_by from public.schedule_items where trip_id=any(tids)
    union select created_by from public.trip_route_cache where trip_id=any(tids)
    union select updated_by from public.memory_boards where group_id=any(gids)
  ) people where person is not null;
  payload := jsonb_build_object(
    'memory_boards', (select coalesce(jsonb_agg(to_jsonb(t) order by group_id),'[]') from public.memory_boards t where group_id=any(gids)),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.profiles t where id=any(pids)),
    'groups', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.groups t where id=any(gids)),
    'group_members', (select coalesce(jsonb_agg(to_jsonb(t) order by group_id,user_id),'[]') from public.group_members t where group_id=any(gids)),
    'places', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.places t where group_id=any(gids)),
    'visits', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.visits t where id=any(vids)),
    'visit_participants', (select coalesce(jsonb_agg(to_jsonb(t) order by visit_id,user_id),'[]') from public.visit_participants t where visit_id=any(vids)),
    'visit_photos', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.visit_photos t where visit_id=any(vids)),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.trips t where id=any(tids)),
    'schedule_items', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.schedule_items t where trip_id=any(tids)),
    'trip_route_cache', (select coalesce(jsonb_agg(to_jsonb(t) order by trip_id,route_date,provider,signature),'[]') from public.trip_route_cache t where trip_id=any(tids)),
    'visit_comments', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.visit_comments t where visit_id=any(vids)),
    'activity_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.activity_logs t where group_id=any(gids)),
    'sticker_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by sticker_id),'[]') from public.sticker_favorites t where user_id=caller),
    'comment_notifications', (select coalesce(jsonb_agg(to_jsonb(t) order by comment_id),'[]') from public.comment_notifications t where user_id=caller and comment_id in (select id from public.visit_comments where visit_id=any(vids))),
    'workspace_save_requests', (select coalesce(jsonb_agg(to_jsonb(t) order by operation,request_id),'[]') from public.workspace_save_requests t where user_id=caller and ((operation='group' and result_id=any(gids)) or (operation='trip' and result_id=any(tids)) or (operation='schedule' and result_id in (select id from public.schedule_items where trip_id=any(tids)))))
  );
  return jsonb_build_object('format','uttumak-backup','version',1,'createdAt',now(),'userId',caller,'data',payload);
end $$;
revoke all on function public.export_workspace_backup() from public,anon;
grant execute on function public.export_workspace_backup() to authenticated;

commit;

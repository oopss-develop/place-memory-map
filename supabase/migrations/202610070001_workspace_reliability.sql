begin;
create table public.workspace_save_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation text not null, request_id uuid not null, result_id uuid not null,
 primary key(user_id,operation,request_id)
);
alter table public.workspace_save_requests enable row level security;

alter function public.save_trip(jsonb) rename to save_trip_legacy;
alter function public.save_schedule_item(uuid,jsonb) rename to save_schedule_item_legacy;

create function public.save_trip(payload jsonb) returns public.trips
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); rid uuid:=(payload->>'requestId')::uuid; saved public.trips; gid uuid:=(payload->>'groupId')::uuid; replay uuid;
begin
 if caller is null or not private.is_group_member(gid,caller) then raise exception '이 지도의 멤버만 저장할 수 있습니다.' using errcode='42501'; end if;
 if rid is not null then
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':trip:'||rid::text,0));
  select result_id into replay from public.workspace_save_requests where user_id=caller and operation='trip' and request_id=rid;
  if replay is not null then
   select * into saved from public.trips where id=replay and group_id=gid and deleted_at is null;
   if not found then raise exception '이미 삭제되거나 변경된 요청입니다.' using errcode='40001'; end if;
   return saved;
  end if;
 end if;
 saved:=public.save_trip_legacy(payload);
 if rid is not null then insert into public.workspace_save_requests values(caller,'trip',rid,saved.id); end if;
 return saved;
end $$;

create function public.save_schedule_item(target_trip_id uuid,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); rid uuid:=(payload->>'requestId')::uuid; gid uuid; replay uuid; saved uuid;
begin
 select group_id into gid from public.trips where id=target_trip_id and deleted_at is null;
 if caller is null or gid is null or not private.is_group_member(gid,caller) then raise exception '이 여행에 저장할 권한이 없습니다.' using errcode='42501'; end if;
 if rid is not null then
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':schedule:'||rid::text,0));
  select result_id into replay from public.workspace_save_requests where user_id=caller and operation='schedule' and request_id=rid;
  if replay is not null then
   if not exists(select 1 from public.schedule_items where id=replay and trip_id=target_trip_id and deleted_at is null) then raise exception '이미 삭제되거나 변경된 요청입니다.' using errcode='40001'; end if;
   return replay;
  end if;
 end if;
 saved:=public.save_schedule_item_legacy(target_trip_id,payload);
 if rid is not null then insert into public.workspace_save_requests values(caller,'schedule',rid,saved); end if;
 return saved;
end $$;

create function public.create_group_once(group_name text,request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); saved uuid;
begin
 if caller is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':group:'||request_id::text,0));
 select result_id into saved from public.workspace_save_requests r where r.user_id=caller and r.operation='group' and r.request_id=create_group_once.request_id;
 if saved is not null then
  if not exists(select 1 from public.groups where id=saved and created_by=caller) then raise exception '이미 삭제된 지도입니다.' using errcode='40001'; end if;
  return saved;
 end if;
 saved:=public.create_group(group_name);
 insert into public.workspace_save_requests values(caller,'group',request_id,saved);
 return saved;
end $$;

create function public.dashboard_group_counts() returns table(group_id uuid,visit_count bigint,member_count bigint)
language sql stable security invoker set search_path='' as $$
 select g.id,(select count(*) from public.visits v where v.group_id=g.id and v.deleted_at is null),
 (select count(*) from public.group_members m where m.group_id=g.id)
 from public.groups g where private.is_group_member(g.id,auth.uid())
$$;
revoke all on function public.save_trip(jsonb),public.save_schedule_item(uuid,jsonb),public.create_group_once(text,uuid),public.dashboard_group_counts() from public,anon;
grant execute on function public.save_trip(jsonb),public.save_schedule_item(uuid,jsonb),public.create_group_once(text,uuid),public.dashboard_group_counts() to authenticated;
revoke all on function public.save_trip_legacy(jsonb),public.save_schedule_item_legacy(uuid,jsonb) from public,anon,authenticated;
create or replace function public.save_visit(input jsonb, request_id uuid, creating boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); gid uuid := (input->>'groupId')::uuid; v public.visits; pid uuid; person uuid;
begin
  if request_id is null then raise exception '요청 ID가 필요합니다.'; end if;
  if caller is null or not private.is_group_member(gid, caller) then raise exception '이 지도에 기록할 권한이 없습니다.' using errcode='42501'; end if;
  perform 1 from public.groups where id=gid for update;
  if creating then
    select * into v from public.visits where created_by=caller and client_request_id=request_id;
    if found then
      if v.group_id<>gid or v.deleted_at is not null then raise exception '이미 삭제되거나 변경된 요청입니다.' using errcode='40001'; end if;
      return jsonb_build_object('id',v.id,'version',v.version,'placeId',v.place_id);
    end if;
  else
    select * into v from public.visits where id=(input->>'id')::uuid and group_id=gid and deleted_at is null for update;
    if not found then raise exception '방문 기록을 찾지 못했습니다.' using errcode='P0002'; end if;
    if v.last_request_id=request_id then return jsonb_build_object('id',v.id,'version',v.version,'placeId',v.place_id); end if;
    if input->>'version' is null or v.version<>(input->>'version')::integer then raise exception '다른 멤버가 먼저 수정했습니다.' using errcode='40001'; end if;
  end if;
  for person in select jsonb_array_elements_text(input->'participantIds')::uuid loop
    if not private.is_group_member(gid,person) then raise exception '이 지도에 속하지 않은 참여자입니다.' using errcode='42501'; end if;
  end loop;
  if creating then
    if nullif(input->'place'->>'id','') is not null then
      select id into pid from public.places where id=(input->'place'->>'id')::uuid and group_id=gid;
      if pid is null and exists(select 1 from public.places where id=(input->'place'->>'id')::uuid) then raise exception '이 지도의 장소만 사용할 수 있습니다.' using errcode='42501'; end if;
    end if;
    if pid is null and input->'place'->>'provider'='kakao' then
      select id into pid from public.places where group_id=gid and provider='kakao' and provider_place_id=input->'place'->>'providerPlaceId';
    end if;
    if pid is null then
      insert into public.places(group_id,provider,provider_place_id,name,address,category,latitude,longitude,created_by)
      values(gid,input->'place'->>'provider',input->'place'->>'providerPlaceId',input->'place'->>'name',input->'place'->>'address',input->'place'->>'category',(input->'place'->>'latitude')::numeric,(input->'place'->>'longitude')::numeric,caller) returning id into pid;
    end if;
    insert into public.visits(group_id,place_id,visited_on,is_planned,title,note,rating,tags,marker_style,created_by,updated_by,client_request_id,last_request_id)
    values(gid,pid,(input->>'visitedOn')::date,(input->>'isPlanned')::boolean,input->>'title',input->>'note',(input->>'rating')::numeric,array(select jsonb_array_elements_text(input->'tags')),input->>'markerStyle',caller,caller,request_id,request_id) returning * into v;
  else
    update public.visits set visited_on=(input->>'visitedOn')::date,is_planned=(input->>'isPlanned')::boolean,title=input->>'title',note=input->>'note',rating=(input->>'rating')::numeric,tags=array(select jsonb_array_elements_text(input->'tags')),marker_style=input->>'markerStyle',updated_by=caller,version=version+1,last_request_id=request_id where id=v.id returning * into v;
    delete from public.visit_participants where visit_id=v.id;
  end if;
  insert into public.visit_participants(visit_id,user_id) select v.id, jsonb_array_elements_text(input->'participantIds')::uuid on conflict do nothing;
  return jsonb_build_object('id',v.id,'version',v.version,'placeId',v.place_id);
end $$;


commit;

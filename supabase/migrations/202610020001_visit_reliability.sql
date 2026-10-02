begin;

alter table public.visits add column if not exists client_request_id uuid;
alter table public.visits add column if not exists last_request_id uuid;
alter table public.visits add column if not exists purge_started_at timestamptz;
create unique index if not exists visits_request_unique on public.visits(created_by, client_request_id) where client_request_id is not null;
alter table public.visit_photos add column if not exists deleted_at timestamptz;
alter table public.visit_photos add column if not exists client_file_id uuid;
alter table public.visit_photos add column if not exists content_hash text;
alter table public.visit_photos add column if not exists upload_state text not null default 'complete' check (upload_state in ('pending','complete'));
create unique index if not exists visit_photo_request_unique on public.visit_photos(visit_id, client_file_id) where client_file_id is not null;

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
    if input->'place'->>'provider'='kakao' then
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

create or replace function public.reserve_visit_photo(target_id uuid, file_id uuid, file_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.visits; p public.visit_photos; total integer;
begin
  if file_id is null then raise exception '사진 요청 ID가 필요합니다.'; end if;
  select * into v from public.visits where id=target_id and deleted_at is null for update;
  if not found or not private.is_group_member(v.group_id) then raise exception '사진을 추가할 권한이 없습니다.' using errcode='42501'; end if;
  select * into p from public.visit_photos where visit_id=target_id and client_file_id=file_id;
  if found then
    if p.deleted_at is not null then raise exception '이미 삭제된 사진 요청입니다.'; end if;
    if p.content_hash<>file_hash then raise exception '동일한 요청으로 다른 사진을 올릴 수 없습니다.'; end if;
    return to_jsonb(p);
  end if;
  select count(*) into total from public.visit_photos where visit_id=target_id and deleted_at is null;
  if total>=5 then raise exception '사진은 최대 5장까지 추가할 수 있어요.'; end if;
  insert into public.visit_photos(visit_id,client_file_id,content_hash,storage_path,sort_order,uploaded_by,upload_state)
  values(target_id,file_id,file_hash,v.group_id::text||'/'||target_id::text||'/'||file_id::text||'.webp',total,auth.uid(),'pending') returning * into p;
  return to_jsonb(p);
end $$;

create or replace function public.complete_visit_photo(target_id uuid, file_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id=target_id and deleted_at is null for update;
  if not found or not private.is_group_member(v.group_id) then raise exception '사진을 저장할 권한이 없습니다.' using errcode='42501'; end if;
  update public.visit_photos set upload_state='complete' where visit_id=target_id and client_file_id=file_id and deleted_at is null;
  if not found then raise exception '사진 요청이 만료되었거나 삭제되었습니다.'; end if;
end $$;

create or replace function public.restore_visit(target_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id=target_id for update;
  if not found or not private.is_group_member(v.group_id) then raise exception '복원할 권한이 없습니다.' using errcode='42501'; end if;
  if v.deleted_at is null then return jsonb_build_object('id',v.id,'version',v.version); end if;
  if v.deleted_at<=now()-interval '30 days' or v.purge_started_at is not null then raise exception '복원 기간이 지났습니다.' using errcode='P0002'; end if;
  if expected_version is null or v.version<>expected_version then raise exception '이미 변경된 기록입니다.' using errcode='40001'; end if;
  update public.visits set deleted_at=null,updated_by=auth.uid(),version=version+1,last_request_id=null where id=target_id returning * into v;
  return jsonb_build_object('id',v.id,'version',v.version);
end $$;

-- Claim expired rows before touching Storage; restoration cannot race cleanup.
create or replace function public.claim_expired_visits()
returns setof public.visits language sql security definer set search_path = '' as $$
  update public.visits set purge_started_at=coalesce(purge_started_at,now()) where id in
    (select id from public.visits where deleted_at<=now()-interval '30 days' order by deleted_at limit 100 for update skip locked)
  returning *;
$$;
revoke all on function public.claim_expired_visits() from public,anon,authenticated;
grant execute on function public.claim_expired_visits() to service_role;
-- Old DB-only purge would orphan Storage files. Use the authenticated maintenance endpoint.
create or replace function public.purge_expired_deleted_visits() returns integer language plpgsql security definer set search_path='' as $$ begin raise exception 'Use the Storage-aware maintenance endpoint'; end $$;
revoke all on function public.save_visit(jsonb,uuid,boolean), public.reserve_visit_photo(uuid,uuid,text),public.complete_visit_photo(uuid,uuid),public.restore_visit(uuid,integer) from public,anon;
grant execute on function public.save_visit(jsonb,uuid,boolean),public.reserve_visit_photo(uuid,uuid,text),public.complete_visit_photo(uuid,uuid),public.restore_visit(uuid,integer) to authenticated;

-- Abandoned editor files are not part of drafts. Release their slots after seven days.
create or replace function public.release_stale_photo_reservations()
returns integer language plpgsql security definer set search_path='' as $$
declare target public.visits; affected integer; total integer:=0;
begin
  for target in select v.* from public.visits v where v.deleted_at is null and exists
    (select 1 from public.visit_photos p where p.visit_id=v.id and p.upload_state='pending' and p.deleted_at is null and p.created_at<now()-interval '7 days') limit 100 for update skip locked loop
    update public.visit_photos set deleted_at=now() where visit_id=target.id and upload_state='pending' and deleted_at is null and created_at<now()-interval '7 days';
    get diagnostics affected=row_count; total:=total+affected;
  end loop;
  return total;
end $$;
revoke all on function public.release_stale_photo_reservations() from public,anon,authenticated;
grant execute on function public.release_stale_photo_reservations() to service_role;

commit;

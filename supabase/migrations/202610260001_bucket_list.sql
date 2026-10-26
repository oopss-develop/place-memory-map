begin;
create table public.bucket_items (
 id uuid primary key, group_id uuid not null references public.groups(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 kind text not null check(kind in ('place','activity')), reason text not null default '' check(char_length(reason)<=3000),
 place jsonb, tags text[] not null default '{}' check(cardinality(tags)<=8),
 visit_id uuid references public.visits(id) on delete set null,
 version integer not null default 1 check(version>0),
 created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, last_request_id uuid not null
);
create index bucket_items_group_idx on public.bucket_items(group_id,created_at desc,id) where deleted_at is null;
create table public.bucket_comments (
 id uuid primary key, bucket_id uuid not null references public.bucket_items(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 1000), created_at timestamptz not null default now()
);
create index bucket_comments_item_idx on public.bucket_comments(bucket_id,created_at,id);
alter table public.bucket_items enable row level security;
alter table public.bucket_comments enable row level security;
create policy bucket_read on public.bucket_items for select to authenticated using(deleted_at is null and private.is_group_member(group_id));
create policy bucket_comments_read on public.bucket_comments for select to authenticated using(exists(select 1 from public.bucket_items b where b.id=bucket_id and b.deleted_at is null and private.is_group_member(b.group_id)));
revoke all on public.bucket_items,public.bucket_comments from anon,authenticated;
grant select on public.bucket_items,public.bucket_comments to authenticated;

create function public.save_bucket_item(input jsonb, creating boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); gid uuid:=(input->>'groupId')::uuid; bid uuid:=(input->>'id')::uuid; rid uuid:=(input->>'requestId')::uuid; b public.bucket_items; p jsonb:=nullif(input->'place','null'::jsonb);
begin
 if caller is null or not private.is_group_member(gid) then raise exception '이 지도에 접근할 수 없습니다.' using errcode='42501'; end if;
 perform 1 from public.groups where id=gid for update;
 if rid is null or bid is null then raise exception '요청 ID가 필요합니다.' using errcode='22023'; end if;
 if p is not null and (jsonb_typeof(p)<>'object' or coalesce(p->>'provider','') not in ('kakao','manual') or coalesce(length(btrim(p->>'name')),0) not between 1 and 120 or (p->>'latitude') is null or (p->>'longitude') is null or (p->>'latitude')::numeric not between -90 and 90 or (p->>'longitude')::numeric not between -180 and 180) then raise exception '장소 입력을 확인해 주세요.' using errcode='22023'; end if;
 select * into b from public.bucket_items where id=bid for update;
 if found then
  if b.group_id<>gid or b.deleted_at is not null then raise exception '접근할 수 없는 항목입니다.' using errcode='42501'; end if;
  if b.last_request_id=rid and (not creating or b.created_by=caller) then return to_jsonb(b); end if;
  if creating or (input->>'version') is null or b.version<>(input->>'version')::integer then raise exception '다른 멤버가 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.' using errcode='40001'; end if;
 elsif not creating then raise exception '항목을 찾지 못했습니다.' using errcode='P0002';
 end if;
 if creating then
  insert into public.bucket_items(id,group_id,title,kind,reason,place,tags,created_by,updated_by,last_request_id)
  values(bid,gid,btrim(input->>'title'),input->>'kind',coalesce(input->>'reason',''),p,array(select jsonb_array_elements_text(input->'tags')),caller,caller,rid) returning * into b;
 else
  update public.bucket_items set title=btrim(input->>'title'),kind=input->>'kind',reason=coalesce(input->>'reason',''),place=p,tags=array(select jsonb_array_elements_text(input->'tags')),version=version+1,updated_by=caller,updated_at=now(),last_request_id=rid where id=bid returning * into b;
 end if;
 return to_jsonb(b);
end $$;

create function public.delete_bucket_item(target_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bucket_items;
begin
 select * into b from public.bucket_items where id=target_id;
 if b.id is null or auth.uid() is null or not private.is_group_member(b.group_id) then raise exception '항목에 접근할 수 없습니다.' using errcode='42501'; end if;
 perform 1 from public.groups where id=b.group_id for update;
 update public.bucket_items set deleted_at=now(),version=version+1,updated_by=auth.uid(),updated_at=now() where id=target_id and version=expected_version and deleted_at is null;
 if not found then raise exception '다른 멤버가 먼저 변경했습니다.' using errcode='40001'; end if;
end $$;

-- The visit and link commit together; one item cannot generate duplicate visits.
create function public.save_bucket_visit(input jsonb, request_id uuid, creating boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gid uuid:=(input->>'groupId')::uuid; b public.bucket_items; v public.visits; result jsonb;
begin
 if auth.uid() is null or not private.is_group_member(gid) then raise exception '이 지도에 접근할 수 없습니다.' using errcode='42501'; end if;
 perform 1 from public.groups where id=gid for update;
 select * into b from public.bucket_items where id=(input->>'bucketId')::uuid and group_id=gid and deleted_at is null for update;
 if not found then raise exception '버킷리스트를 찾지 못했습니다.' using errcode='P0002'; end if;
 select * into v from public.visits where id=b.visit_id and deleted_at is null;
 if creating then
  if v.id is not null then
   if v.created_by=auth.uid() and v.client_request_id=request_id then return jsonb_build_object('id',v.id,'version',v.version,'placeId',v.place_id); end if;
   raise exception '이미 연결된 기록이 있습니다. 새로고침해 주세요.' using errcode='40001';
  end if;
  if (input->>'bucketVersion') is null or b.version<>(input->>'bucketVersion')::integer then raise exception '버킷리스트가 변경되었습니다. 새로고침해 주세요.' using errcode='40001'; end if;
 elsif v.id is null or v.id<>(input->>'id')::uuid then raise exception '연결된 기록을 확인해 주세요.' using errcode='40001'; end if;
 result:=public.save_visit(input,request_id,creating);
 if creating then update public.bucket_items set visit_id=(result->>'id')::uuid,place=coalesce(place,jsonb_set(input->'place','{id}',result->'placeId')),version=version+1,updated_by=auth.uid(),updated_at=now() where id=b.id; end if;
 return result;
end $$;

create function public.write_bucket_comment(target_id uuid, comment_id uuid, comment_body text, removing boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bucket_items; c public.bucket_comments;
begin
 select * into b from public.bucket_items where id=target_id and deleted_at is null for update;
 if b.id is null or auth.uid() is null or not private.is_group_member(b.group_id) then raise exception '항목에 접근할 수 없습니다.' using errcode='42501'; end if;
 if removing then
  select * into c from public.bucket_comments where id=comment_id;
  if c.id is null then return '{}'::jsonb; end if;
  if c.bucket_id<>target_id or c.author_id<>auth.uid() then raise exception '본인 댓글만 삭제할 수 있습니다.' using errcode='42501'; end if;
  delete from public.bucket_comments where id=comment_id;
  return '{}'::jsonb;
 end if;
 insert into public.bucket_comments(id,bucket_id,author_id,body) values(comment_id,target_id,auth.uid(),btrim(comment_body)) on conflict(id) do nothing;
 select * into c from public.bucket_comments where id=comment_id;
 if c.bucket_id<>target_id or c.author_id<>auth.uid() then raise exception '댓글에 접근할 수 없습니다.' using errcode='42501'; end if;
 if c.body<>btrim(comment_body) then raise exception '새 요청으로 댓글을 작성해 주세요.' using errcode='40001'; end if;
 return to_jsonb(c);
end $$;
revoke all on function public.save_bucket_item(jsonb,boolean),public.delete_bucket_item(uuid,integer),public.save_bucket_visit(jsonb,uuid,boolean),public.write_bucket_comment(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.save_bucket_item(jsonb,boolean),public.delete_bucket_item(uuid,integer),public.save_bucket_visit(jsonb,uuid,boolean),public.write_bucket_comment(uuid,uuid,text,boolean) to authenticated;

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
    union select uploaded_by from public.memory_board_photos where group_id=any(gids)
    union select created_by from public.bucket_items where group_id=any(gids)
    union select updated_by from public.bucket_items where group_id=any(gids)
    union select author_id from public.bucket_comments where bucket_id in(select id from public.bucket_items where group_id=any(gids))
  ) people where person is not null;
  payload := jsonb_build_object(
    'bucket_items', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.bucket_items t where group_id=any(gids)),
    'bucket_comments', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.bucket_comments t where bucket_id in(select id from public.bucket_items where group_id=any(gids))),
    'memory_board_photos', (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.memory_board_photos t where group_id=any(gids)),
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

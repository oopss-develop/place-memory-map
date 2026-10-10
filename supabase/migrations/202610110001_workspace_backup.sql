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
  ) people where person is not null;
  payload := jsonb_build_object(
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

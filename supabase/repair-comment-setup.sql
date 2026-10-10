-- Repeatable repair for existing comment DBs. Preserves comments, favorites and read receipts.
-- Run in Supabase SQL Editor, in the project configured in Vercel.
begin;

-- 202610100001_visit_comments.sql
create table if not exists public.visit_comments (
  id uuid primary key,
  visit_id uuid not null references public.visits(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists visit_comments_visit_created_idx on public.visit_comments(visit_id, created_at, id);
alter table public.visit_comments enable row level security;
drop policy if exists comments_read on public.visit_comments;
create policy comments_read on public.visit_comments for select to authenticated using (
  exists(select 1 from public.visits v where v.id = visit_id and v.deleted_at is null and private.is_group_member(v.group_id))
);
revoke all on public.visit_comments from anon, authenticated;
grant select on public.visit_comments to authenticated;

-- Serialize writes with visit deletion and make retries safe with a client UUID.
create or replace function public.add_visit_comment(target_visit uuid, comment_id uuid, comment_body text)
returns public.visit_comments language plpgsql security definer set search_path = '' as $$
declare v public.visits; saved public.visit_comments;
begin
  select * into v from public.visits where id = target_visit for update;
  if auth.uid() is null or v.id is null or v.deleted_at is not null or not private.is_group_member(v.group_id) then
    raise exception '기록에 접근할 수 없습니다.' using errcode = '42501';
  end if;
  if comment_body is null or char_length(btrim(comment_body)) not between 1 and 1000 then
    raise exception '댓글은 1~1000자로 입력해 주세요.' using errcode = '22023';
  end if;
  insert into public.visit_comments(id, visit_id, author_id, body)
    values(comment_id, target_visit, auth.uid(), btrim(comment_body)) on conflict(id) do nothing;
  select * into saved from public.visit_comments where id = comment_id;
  if saved.visit_id <> target_visit or saved.author_id <> auth.uid() then
    raise exception '댓글에 접근할 수 없습니다.' using errcode = '42501';
  end if;
  if saved.body <> btrim(comment_body) then
    raise exception '전송한 댓글을 확인한 뒤 새 댓글을 작성해 주세요.' using errcode = '40001';
  end if;
  return saved;
end $$;

create or replace function public.delete_visit_comment(target_visit uuid, comment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits; saved public.visit_comments;
begin
  select * into v from public.visits where id = target_visit for update;
  if auth.uid() is null or v.id is null or v.deleted_at is not null or not private.is_group_member(v.group_id) then
    raise exception '기록에 접근할 수 없습니다.' using errcode = '42501';
  end if;
  select * into saved from public.visit_comments where id = comment_id;
  if saved.id is null then return; end if;
  if saved.visit_id <> target_visit or saved.author_id <> auth.uid() then
    raise exception '본인 댓글만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.visit_comments where id = comment_id;
end $$;
revoke all on function public.add_visit_comment(uuid,uuid,text), public.delete_visit_comment(uuid,uuid) from public, anon;
grant execute on function public.add_visit_comment(uuid,uuid,text), public.delete_visit_comment(uuid,uuid) to authenticated;


-- 202610100002_comment_stickers.sql
alter table public.visit_comments add column if not exists sticker_id text;
alter table public.visit_comments drop constraint if exists visit_comments_body_check;
alter table public.visit_comments drop constraint if exists visit_comments_content_check;
alter table public.visit_comments add constraint visit_comments_content_check check (
  char_length(btrim(body)) <= 1000 and (char_length(btrim(body)) > 0 or sticker_id is not null)
);
alter table public.visit_comments drop constraint if exists visit_comments_sticker_path_check;
alter table public.visit_comments add constraint visit_comments_sticker_path_check check (
  sticker_id is null or (char_length(sticker_id) <= 512 and
  sticker_id ~* '^[^./\\][^/\\]*/[^./\\][^/\\]*\.(png|webp|gif)$' and
  sticker_id !~ '[[:cntrl:]]' and sticker_id !~* '\.preview\.png$')
);
create or replace function public.add_visit_comment(target_visit uuid, comment_id uuid, comment_body text, comment_sticker_id text)
returns public.visit_comments language plpgsql security definer set search_path = '' as $$
declare v public.visits; saved public.visit_comments; cleaned text := btrim(coalesce(comment_body, ''));
begin
  select * into v from public.visits where id = target_visit for update;
  if auth.uid() is null or v.id is null or v.deleted_at is not null or not private.is_group_member(v.group_id) then
    raise exception '기록에 접근할 수 없습니다.' using errcode = '42501';
  end if;
  if char_length(cleaned) > 1000 or (cleaned = '' and comment_sticker_id is null) or
    (comment_sticker_id is not null and (char_length(comment_sticker_id) > 512 or
      comment_sticker_id !~* '^[^./\\][^/\\]*/[^./\\][^/\\]*\.(png|webp|gif)$' or
      comment_sticker_id ~ '[[:cntrl:]]' or comment_sticker_id ~* '\.preview\.png$')) then
    raise exception '댓글 내용을 확인해 주세요.' using errcode = '22023';
  end if;
  insert into public.visit_comments(id,visit_id,author_id,body,sticker_id)
    values(comment_id,target_visit,auth.uid(),cleaned,comment_sticker_id) on conflict(id) do nothing;
  select * into saved from public.visit_comments where id = comment_id;
  if saved.visit_id <> target_visit or saved.author_id <> auth.uid() then
    raise exception '댓글에 접근할 수 없습니다.' using errcode = '42501';
  end if;
  if saved.body is distinct from cleaned or saved.sticker_id is distinct from comment_sticker_id then
    raise exception '이미 전송한 댓글입니다.' using errcode = '40001';
  end if;
  return saved;
end $$;
-- Keep text-only clients compatible and apply identical retry checks.
create or replace function public.add_visit_comment(target_visit uuid, comment_id uuid, comment_body text)
returns public.visit_comments language sql security definer set search_path = '' as $$
  select public.add_visit_comment(target_visit,comment_id,comment_body,null::text);
$$;
revoke all on function public.add_visit_comment(uuid,uuid,text,text) from public,anon;
grant execute on function public.add_visit_comment(uuid,uuid,text,text) to authenticated;


-- 202610100003_sticker_favorites.sql
create table if not exists public.sticker_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  sticker_id text not null check (char_length(sticker_id) between 1 and 512),
  created_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);
alter table public.sticker_favorites enable row level security;
drop policy if exists sticker_favorites_read on public.sticker_favorites;
create policy sticker_favorites_read on public.sticker_favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists sticker_favorites_insert on public.sticker_favorites;
create policy sticker_favorites_insert on public.sticker_favorites for insert to authenticated with check (user_id = auth.uid());
drop policy if exists sticker_favorites_delete on public.sticker_favorites;
create policy sticker_favorites_delete on public.sticker_favorites for delete to authenticated using (user_id = auth.uid());
revoke all on public.sticker_favorites from anon, authenticated;
grant select, insert, delete on public.sticker_favorites to authenticated;


-- 202610100004_comment_notifications.sql
create table if not exists public.comment_notifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.visit_comments(id) on delete cascade,
  read_at timestamptz,
  primary key(user_id, comment_id)
);
create index if not exists comment_notifications_unread_idx on public.comment_notifications(user_id) where read_at is null;
alter table public.comment_notifications enable row level security;
drop policy if exists comment_notifications_read on public.comment_notifications;
create policy comment_notifications_read on public.comment_notifications for select to authenticated using (
  user_id = auth.uid() and exists(select 1 from public.visit_comments c join public.visits v on v.id = c.visit_id
    where c.id = comment_id and v.deleted_at is null and private.is_group_member(v.group_id))
);
drop policy if exists comment_notifications_update on public.comment_notifications;
create policy comment_notifications_update on public.comment_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.comment_notifications from anon,authenticated;
grant select on public.comment_notifications to authenticated;
grant update(read_at) on public.comment_notifications to authenticated;
create or replace function private.notify_visit_comment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.comment_notifications(user_id,comment_id,read_at)
    select m.user_id,new.id,case when m.user_id = new.author_id then now() else null end
    from public.group_members m join public.visits v on v.group_id = m.group_id where v.id = new.visit_id
    on conflict do nothing;
  return new;
end $$;
revoke all on function private.notify_visit_comment() from public,anon,authenticated;
drop trigger if exists visit_comment_notifications on public.visit_comments;
create trigger visit_comment_notifications after insert on public.visit_comments for each row execute function private.notify_visit_comment();
-- Recent comments become available immediately; own comments start as read.
insert into public.comment_notifications(user_id,comment_id,read_at)
  select m.user_id,c.id,case when m.user_id = c.author_id then now() else null end
  from public.visit_comments c join public.visits v on v.id = c.visit_id join public.group_members m on m.group_id = v.group_id
  where v.deleted_at is null and c.created_at >= now() - interval '30 days' on conflict do nothing;
create or replace function public.list_comment_notifications() returns table (
  comment_id uuid, visit_id uuid, group_id uuid, body text, sticker_id text,
  author_name text, place_name text, created_at timestamptz, read_at timestamptz, own boolean
) language sql stable security invoker set search_path = '' as $$
  select c.id,c.visit_id,v.group_id,left(c.body,300),c.sticker_id,p.display_name,places.name,c.created_at,n.read_at,c.author_id = auth.uid()
  from public.comment_notifications n join public.visit_comments c on c.id = n.comment_id
  join public.visits v on v.id = c.visit_id join public.profiles p on p.id = c.author_id
  join public.places on places.id = v.place_id
  where n.user_id = auth.uid() and v.deleted_at is null and private.is_group_member(v.group_id)
  order by (n.read_at is null) desc,c.created_at desc,c.id desc limit 100;
$$;
revoke all on function public.list_comment_notifications() from public,anon;
grant execute on function public.list_comment_notifications() to authenticated;

notify pgrst, 'reload schema';
commit;

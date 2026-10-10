create table public.visit_comments (
  id uuid primary key,
  visit_id uuid not null references public.visits(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index visit_comments_visit_created_idx on public.visit_comments(visit_id, created_at, id);
alter table public.visit_comments enable row level security;
create policy comments_read on public.visit_comments for select to authenticated using (
  exists(select 1 from public.visits v where v.id = visit_id and v.deleted_at is null and private.is_group_member(v.group_id))
);
revoke all on public.visit_comments from anon, authenticated;
grant select on public.visit_comments to authenticated;

-- Serialize writes with visit deletion and make retries safe with a client UUID.
create function public.add_visit_comment(target_visit uuid, comment_id uuid, comment_body text)
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

create function public.delete_visit_comment(target_visit uuid, comment_id uuid)
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

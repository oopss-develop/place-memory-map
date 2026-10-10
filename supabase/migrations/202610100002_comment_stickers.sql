alter table public.visit_comments add column sticker_id text;
alter table public.visit_comments drop constraint visit_comments_body_check;
alter table public.visit_comments add constraint visit_comments_content_check check (
  char_length(btrim(body)) <= 1000 and (char_length(btrim(body)) > 0 or sticker_id is not null)
);
alter table public.visit_comments add constraint visit_comments_sticker_path_check check (
  sticker_id is null or (char_length(sticker_id) <= 512 and
  sticker_id ~* '^[^./\\][^/\\]*/[^./\\][^/\\]*\.(png|webp|gif)$' and
  sticker_id !~ '[[:cntrl:]]' and sticker_id !~* '\.preview\.png$')
);
create function public.add_visit_comment(target_visit uuid, comment_id uuid, comment_body text, comment_sticker_id text)
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

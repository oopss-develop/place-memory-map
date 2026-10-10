create table public.comment_notifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.visit_comments(id) on delete cascade,
  read_at timestamptz,
  primary key(user_id, comment_id)
);
create index comment_notifications_unread_idx on public.comment_notifications(user_id) where read_at is null;
alter table public.comment_notifications enable row level security;
create policy comment_notifications_read on public.comment_notifications for select to authenticated using (
  user_id = auth.uid() and exists(select 1 from public.visit_comments c join public.visits v on v.id = c.visit_id
    where c.id = comment_id and v.deleted_at is null and private.is_group_member(v.group_id))
);
create policy comment_notifications_update on public.comment_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.comment_notifications from anon,authenticated;
grant select on public.comment_notifications to authenticated;
grant update(read_at) on public.comment_notifications to authenticated;
create function private.notify_visit_comment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.comment_notifications(user_id,comment_id,read_at)
    select m.user_id,new.id,case when m.user_id = new.author_id then now() else null end
    from public.group_members m join public.visits v on v.group_id = m.group_id where v.id = new.visit_id
    on conflict do nothing;
  return new;
end $$;
revoke all on function private.notify_visit_comment() from public,anon,authenticated;
create trigger visit_comment_notifications after insert on public.visit_comments for each row execute function private.notify_visit_comment();
-- Recent comments become available immediately; own comments start as read.
insert into public.comment_notifications(user_id,comment_id,read_at)
  select m.user_id,c.id,case when m.user_id = c.author_id then now() else null end
  from public.visit_comments c join public.visits v on v.id = c.visit_id join public.group_members m on m.group_id = v.group_id
  where v.deleted_at is null and c.created_at >= now() - interval '30 days' on conflict do nothing;
create function public.list_comment_notifications() returns table (
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

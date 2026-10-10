create table public.sticker_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  sticker_id text not null check (char_length(sticker_id) between 1 and 512),
  created_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);
alter table public.sticker_favorites enable row level security;
create policy sticker_favorites_read on public.sticker_favorites for select to authenticated using (user_id = auth.uid());
create policy sticker_favorites_insert on public.sticker_favorites for insert to authenticated with check (user_id = auth.uid());
create policy sticker_favorites_delete on public.sticker_favorites for delete to authenticated using (user_id = auth.uid());
revoke all on public.sticker_favorites from anon, authenticated;
grant select, insert, delete on public.sticker_favorites to authenticated;

create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members(user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_invites_group_id_idx on public.group_invites(group_id);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  provider text not null check (provider in ('kakao','manual')),
  provider_place_id text,
  name text not null check (char_length(name) between 1 and 120),
  address text not null default '',
  category text not null default '직접 지정',
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index places_kakao_unique_idx on public.places(group_id, provider, provider_place_id) where provider_place_id is not null;
create index places_group_id_idx on public.places(group_id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  place_id uuid not null references public.places(id),
  visited_on date not null,
  is_planned boolean not null default false,
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 3000),
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index visits_group_date_idx on public.visits(group_id, visited_on desc) where deleted_at is null;
create index visits_place_id_idx on public.visits(place_id);

create table public.visit_participants (
  visit_id uuid not null references public.visits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (visit_id, user_id)
);
create index visit_participants_user_id_idx on public.visit_participants(user_id);

create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 4),
  caption text not null default '' check (char_length(caption) <= 200),
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index visit_photos_visit_id_idx on public.visit_photos(visit_id);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create','update','delete','restore')),
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_logs_group_created_idx on public.activity_logs(group_id, created_at desc);

create or replace function private.is_group_member(check_group_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.group_members where group_id = check_group_id and user_id = check_user_id)
$$;
create or replace function private.is_group_owner(check_group_id uuid, check_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.group_members where group_id = check_group_id and user_id = check_user_id and role = 'owner')
$$;
create or replace function private.shares_group(other_user_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(
    select 1 from public.group_members mine
    join public.group_members theirs on mine.group_id = theirs.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other_user_id
  )
$$;

create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.groups(name, created_by) values (trim(group_name), auth.uid()) returning id into new_id;
  insert into public.group_members(group_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

create or replace function public.accept_group_invite(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite_row public.group_invites; token_digest text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  token_digest := encode(digest(raw_token, 'sha256'), 'hex');
  select * into invite_row from public.group_invites
    where token_hash = token_digest and used_at is null and revoked_at is null and expires_at > now()
    for update;
  if invite_row.id is null then raise exception 'invalid or expired invite'; end if;
  insert into public.group_members(group_id, user_id, role) values (invite_row.group_id, auth.uid(), 'member') on conflict do nothing;
  update public.group_invites set used_at = now() where id = invite_row.id;
  return invite_row.group_id;
end $$;

create or replace function public.purge_expired_deleted_visits()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.visits where deleted_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end $$;

create or replace function private.log_visit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare action_name text;
begin
  action_name := case
    when tg_op = 'INSERT' then 'create'
    when old.deleted_at is null and new.deleted_at is not null then 'delete'
    when old.deleted_at is not null and new.deleted_at is null then 'restore'
    else 'update' end;
  insert into public.activity_logs(group_id, actor_id, entity_type, entity_id, action, summary)
  values (new.group_id, auth.uid(), 'visit', new.id, action_name, jsonb_build_object('title', new.title, 'version', new.version));
  new.updated_at := now();
  return new;
end $$;
create trigger visits_activity before insert or update on public.visits for each row execute function private.log_visit_change();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.places enable row level security;
alter table public.visits enable row level security;
alter table public.visit_participants enable row level security;
alter table public.visit_photos enable row level security;
alter table public.activity_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.shares_group(id));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy groups_read on public.groups for select to authenticated using (private.is_group_member(id));
create policy groups_update_owner on public.groups for update to authenticated using (private.is_group_owner(id)) with check (private.is_group_owner(id));
create policy members_read on public.group_members for select to authenticated using (private.is_group_member(group_id));
create policy members_delete_owner on public.group_members for delete to authenticated using (private.is_group_owner(group_id));
create policy invites_owner_all on public.group_invites for all to authenticated using (private.is_group_owner(group_id)) with check (private.is_group_owner(group_id) and created_by = auth.uid());
create policy places_read on public.places for select to authenticated using (private.is_group_member(group_id));
create policy places_insert on public.places for insert to authenticated with check (private.is_group_member(group_id) and created_by = auth.uid());
create policy places_update on public.places for update to authenticated using (private.is_group_member(group_id)) with check (private.is_group_member(group_id));
create policy places_delete on public.places for delete to authenticated using (private.is_group_member(group_id));
create policy visits_read on public.visits for select to authenticated using (private.is_group_member(group_id));
create policy visits_insert on public.visits for insert to authenticated with check (private.is_group_member(group_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy visits_update on public.visits for update to authenticated using (private.is_group_member(group_id)) with check (private.is_group_member(group_id) and updated_by = auth.uid());
create policy participants_read on public.visit_participants for select to authenticated using (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id)));
create policy participants_write on public.visit_participants for all to authenticated using (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id))) with check (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id)));
create policy photos_read on public.visit_photos for select to authenticated using (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id)));
create policy photos_write on public.visit_photos for all to authenticated using (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id))) with check (exists(select 1 from public.visits v where v.id = visit_id and private.is_group_member(v.group_id)));
create policy activity_read on public.activity_logs for select to authenticated using (private.is_group_member(group_id));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 1572864, array['image/webp']) on conflict (id) do nothing;
create policy storage_group_read on storage.objects for select to authenticated using (bucket_id = 'visit-photos' and private.is_group_member(((storage.foldername(name))[1])::uuid));
create policy storage_group_insert on storage.objects for insert to authenticated with check (bucket_id = 'visit-photos' and private.is_group_member(((storage.foldername(name))[1])::uuid));
create policy storage_group_delete on storage.objects for delete to authenticated using (bucket_id = 'visit-photos' and private.is_group_member(((storage.foldername(name))[1])::uuid));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles, public.groups, public.group_members, public.group_invites, public.places, public.visits, public.visit_participants, public.visit_photos, public.activity_logs to authenticated;
grant usage on schema private to authenticated;
grant execute on function public.create_group(text), public.accept_group_invite(text) to authenticated;
revoke execute on function public.purge_expired_deleted_visits() from public, anon, authenticated;

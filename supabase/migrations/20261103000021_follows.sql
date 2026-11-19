-- =============================================================================
-- Shekargah — following members and follower notifications
--
--   * follows              — a member can follow another member
--   * follower counts      — shown on profiles
--   * notifications        — a new 'follow' kind, plus 'new_product' and
--                            'collection' for the lists feature
-- =============================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

-- Who follows whom is public (it powers the counts on every profile).
drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public"
  on public.follows for select
  to anon, authenticated
  using (true);

drop policy if exists "Members manage their own follows" on public.follows;
create policy "Members manage their own follows"
  on public.follows for all
  to authenticated
  using (follower_id = (select auth.uid()))
  with check (follower_id = (select auth.uid()));

revoke all on table public.follows from anon, authenticated;
grant select on table public.follows to anon, authenticated;
grant insert, delete on table public.follows to authenticated;

-- -----------------------------------------------------------------------------
-- Notification kinds gain follow + product/collection announcements.
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('vote', 'comment', 'review', 'approved', 'rejected', 'system', 'follow', 'new_product', 'collection'));

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_user(new.following_id, 'follow', null, null, new.follower_id, null);
  return null;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- A maker's followers hear about a newly published product.
create or replace function public.notify_followers_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  follower uuid;
begin
  for follower in select follower_id from public.follows where following_id = new.maker_id loop
    perform public.notify_user(follower, 'new_product', new.id, null, new.maker_id, null);
  end loop;
  return null;
end;
$$;

-- TG_OP cannot appear in a trigger WHEN clause, so insert and update are separate.
drop trigger if exists products_notify_followers_insert on public.products;
drop trigger if exists products_notify_followers_update on public.products;

create trigger products_notify_followers_insert
  after insert on public.products
  for each row
  when (new.status = 'published')
  execute function public.notify_followers_on_publish();

create trigger products_notify_followers_update
  after update of status on public.products
  for each row
  when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.notify_followers_on_publish();

-- -----------------------------------------------------------------------------
-- Read helpers used by profiles and the follow button.
-- -----------------------------------------------------------------------------
create or replace function public.follow_user(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select id into target from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if target is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if target = (select auth.uid()) then
    raise exception 'cannot_follow_self' using errcode = '22023';
  end if;
  insert into public.follows (follower_id, following_id)
  values ((select auth.uid()), target)
  on conflict do nothing;
end;
$$;

revoke execute on function public.follow_user(text) from public, anon;
grant execute on function public.follow_user(text) to authenticated;

create or replace function public.unfollow_user(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select id into target from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if target is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  delete from public.follows
  where follower_id = (select auth.uid()) and following_id = target;
end;
$$;

revoke execute on function public.unfollow_user(text) from public, anon;
grant execute on function public.unfollow_user(text) to authenticated;

create or replace function public.is_following(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = (select auth.uid()) and following_id = p_profile_id
  );
$$;

revoke execute on function public.is_following(uuid) from public;
grant execute on function public.is_following(uuid) to authenticated;

create or replace function public.profile_follow_counts(p_profile_id uuid)
returns table (followers bigint, following bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.follows where following_id = p_profile_id),
    (select count(*) from public.follows where follower_id = p_profile_id);
$$;

revoke execute on function public.profile_follow_counts(uuid) from public;
grant execute on function public.profile_follow_counts(uuid) to anon, authenticated;

create or replace function public.list_followers(
  p_profile_id uuid,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  followed_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_path, f.created_at, count(*) over ()
  from public.follows f
  join public.profiles pr on pr.id = f.follower_id
  where f.following_id = p_profile_id
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_followers(uuid, integer, integer) from public;
grant execute on function public.list_followers(uuid, integer, integer) to anon, authenticated;

create or replace function public.list_following(
  p_profile_id uuid,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  followed_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_path, f.created_at, count(*) over ()
  from public.follows f
  join public.profiles pr on pr.id = f.following_id
  where f.follower_id = p_profile_id
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_following(uuid, integer, integer) from public;
grant execute on function public.list_following(uuid, integer, integer) to anon, authenticated;
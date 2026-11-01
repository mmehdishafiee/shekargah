-- =============================================================================
-- Shekargah — pending migrations for 2026-11-03
-- Paste this whole file into the Supabase dashboard SQL editor and run it once.
-- It concatenates, in order:
--   20261102000020_leaderboard_anchor.sql
--   20261103000021_follows.sql
--   20261103000022_user_lists.sql
-- =============================================================================

-- >>> supabase/migrations/20261102000020_leaderboard_anchor.sql
-- =============================================================================
-- Shekargah — leaderboard with a date anchor
--
-- Before this, list_leaderboard() always ranked the rolling window that ends
-- "now", so /leaderboard/daily/2026-10-30 was impossible. The function gains an
-- optional p_anchor date; when it is null the behaviour is unchanged (today in
-- Tehran), otherwise the window is the one that *ends* on that day.
-- =============================================================================

-- The old three-argument overload must go: with p_anchor defaulted the four-
-- argument version also accepts three arguments, and keeping both would make
-- calls ambiguous ("function ... is not unique").
drop function if exists public.list_leaderboard(text, integer, integer);

create or replace function public.list_leaderboard(
  p_period text default 'daily',
  p_limit integer default 20,
  p_offset integer default 0,
  p_anchor date default null
)
returns table (
  id uuid,
  slug text,
  name text,
  tagline text,
  logo_path text,
  votes_count integer,
  comments_count integer,
  views_count integer,
  published_at timestamptz,
  category_id uuid,
  category_slug text,
  category_name text,
  tag_slugs text[],
  tag_names text[],
  score bigint,
  rank integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  anchor_date date := coalesce(p_anchor, (now() at time zone 'Asia/Tehran')::date);
  window_start timestamptz;
  window_end timestamptz;
begin
  if p_period = 'yearly' then
    window_start := ((anchor_date - 364)::timestamp at time zone 'Asia/Tehran');
  elsif p_period = 'monthly' then
    window_start := ((anchor_date - 29)::timestamp at time zone 'Asia/Tehran');
  elsif p_period = 'weekly' then
    window_start := ((anchor_date - 6)::timestamp at time zone 'Asia/Tehran');
  else
    window_start := (anchor_date::timestamp at time zone 'Asia/Tehran');
  end if;
  window_end := ((anchor_date + 1)::timestamp at time zone 'Asia/Tehran');

  return query
  with scored as (
    select
      p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
      p.comments_count, p.views_count, p.published_at, p.category_id,
      count(v.id) as score
    from public.products p
    join public.votes v
      on v.product_id = p.id
     and v.created_at >= window_start
     and v.created_at < window_end
    where p.status = 'published'
    group by p.id
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.published_at desc, s.id) as rank
    from scored s
  )
  select
    r.id, r.slug, r.name, r.tagline, r.logo_path,
    r.votes_count, r.comments_count, r.views_count, r.published_at,
    c.id, c.slug, c.name,
    coalesce(
      (select array_agg(t.slug order by t.slug)
       from public.product_tags pt join public.tags t on t.id = pt.tag_id
       where pt.product_id = r.id),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(t.name order by t.slug)
       from public.product_tags pt join public.tags t on t.id = pt.tag_id
       where pt.product_id = r.id),
      '{}'::text[]
    ),
    r.score,
    r.rank::integer,
    count(*) over () as total_count
  from ranked r
  left join public.categories c on c.id = r.category_id
  order by r.rank
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
end;
$$;

revoke execute on function public.list_leaderboard(text, integer, integer, date) from public;
grant execute on function public.list_leaderboard(text, integer, integer, date) to anon, authenticated;
-- >>> supabase/migrations/20261103000021_follows.sql
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
-- >>> supabase/migrations/20261103000022_user_lists.sql
-- =============================================================================
-- Shekargah — member-created product lists
--
-- collections gains an owner and a public flag so any member can curate a list
-- (e.g. «بهترین ابزارهای مشاهده قیمت»), share its /collections/<slug> link and
-- have it appear on their profile. Anyone can save someone else's list.
-- Admin-curated collections keep owner_id null and stay public.
-- =============================================================================

alter table public.collections
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade,
  add column if not exists is_public boolean not null default true;

create index if not exists collections_owner_idx on public.collections (owner_id);

create table if not exists public.saved_collections (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, collection_id)
);

alter table public.saved_collections enable row level security;

drop policy if exists "Members read their saved lists" on public.saved_collections;
create policy "Members read their saved lists"
  on public.saved_collections for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Members manage their saved lists" on public.saved_collections;
create policy "Members manage their saved lists"
  on public.saved_collections for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on table public.saved_collections from anon, authenticated;
grant select, insert, delete on table public.saved_collections to authenticated;

-- -----------------------------------------------------------------------------
-- Visibility: public lists for everyone, private ones only for their owner.
-- -----------------------------------------------------------------------------
create or replace function public.collection_visible(p_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and c.is_active
      and (c.is_public or c.owner_id = (select auth.uid()) or (select public.is_admin()))
  );
$$;

revoke execute on function public.collection_visible(uuid) from public;
grant execute on function public.collection_visible(uuid) to anon, authenticated;

drop policy if exists "Active collections are public" on public.collections;
create policy "Visible collections are readable"
  on public.collections for select
  to anon, authenticated
  using (
    is_active
    and (is_public or owner_id = (select auth.uid()) or (select public.is_admin()))
  );

drop policy if exists "Members manage their own collections" on public.collections;
create policy "Members manage their own collections"
  on public.collections for all
  to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Collection items are public" on public.collection_products;
create policy "Collection items follow the collection"
  on public.collection_products for select
  to anon, authenticated
  using ((select public.collection_visible(collection_id)));

drop policy if exists "Members manage their own collection items" on public.collection_products;
create policy "Members manage their own collection items"
  on public.collection_products for all
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

-- -----------------------------------------------------------------------------
-- Mutations
-- -----------------------------------------------------------------------------
create or replace function public.create_collection(
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_slug := 'list-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.collections (slug, name, description, owner_id, is_public, is_active)
  values (v_slug, v_name, v_description, (select auth.uid()), coalesce(p_is_public, true), true);
  return v_slug;
end;
$$;

revoke execute on function public.create_collection(text, text, boolean) from public, anon;
grant execute on function public.create_collection(text, text, boolean) to authenticated;

create or replace function public.update_collection(
  p_collection_id uuid,
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.collections
  set name = v_name, description = v_description, is_public = coalesce(p_is_public, true)
  where id = p_collection_id;
end;
$$;

revoke execute on function public.update_collection(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_collection(uuid, text, text, boolean) to authenticated;

create or replace function public.delete_collection(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.collections where id = p_collection_id;
end;
$$;

revoke execute on function public.delete_collection(uuid) from public, anon;
grant execute on function public.delete_collection(uuid) to authenticated;

create or replace function public.add_product_to_collection(p_collection_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if (select count(*) from public.collection_products where collection_id = p_collection_id) >= 200 then
    raise exception 'collection_full' using errcode = '22023';
  end if;
  insert into public.collection_products (collection_id, product_id)
  values (p_collection_id, p_product_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.add_product_to_collection(uuid, uuid) from public, anon;
grant execute on function public.add_product_to_collection(uuid, uuid) to authenticated;

create or replace function public.remove_product_from_collection(p_collection_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.collection_products
  where collection_id = p_collection_id and product_id = p_product_id;
end;
$$;

revoke execute on function public.remove_product_from_collection(uuid, uuid) from public, anon;
grant execute on function public.remove_product_from_collection(uuid, uuid) to authenticated;

create or replace function public.set_collection_saved(p_collection_id uuid, p_saved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not (select public.collection_visible(p_collection_id)) then
    raise exception 'collection_not_found' using errcode = 'P0002';
  end if;
  if coalesce(p_saved, true) then
    insert into public.saved_collections (profile_id, collection_id)
    values ((select auth.uid()), p_collection_id)
    on conflict do nothing;
  else
    delete from public.saved_collections
    where profile_id = (select auth.uid()) and collection_id = p_collection_id;
  end if;
end;
$$;

revoke execute on function public.set_collection_saved(uuid, boolean) from public, anon;
grant execute on function public.set_collection_saved(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Reads
-- -----------------------------------------------------------------------------
create or replace function public.get_collection(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    exists (select 1 from public.saved_collections sc
            where sc.collection_id = c.id and sc.profile_id = (select auth.uid())),
    c.owner_id is not null and c.owner_id = (select auth.uid())
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.slug = btrim(p_slug)
    and c.is_active
    and (c.is_public or c.owner_id = (select auth.uid()) or (select public.is_admin()));
$$;

revoke execute on function public.get_collection(text) from public;
grant execute on function public.get_collection(text) to anon, authenticated;

create or replace function public.list_my_collections()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    false,
    true
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.owner_id = (select auth.uid()) and c.is_active
  order by c.created_at desc;
$$;

revoke execute on function public.list_my_collections() from public, anon;
grant execute on function public.list_my_collections() to authenticated;

create or replace function public.list_profile_collections(p_profile_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    exists (select 1 from public.saved_collections sc
            where sc.collection_id = c.id and sc.profile_id = (select auth.uid())),
    c.owner_id = (select auth.uid())
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.owner_id = p_profile_id and c.is_active and c.is_public
  order by c.created_at desc;
$$;

revoke execute on function public.list_profile_collections(uuid) from public;
grant execute on function public.list_profile_collections(uuid) to anon, authenticated;

create or replace function public.list_saved_collections()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    true,
    c.owner_id = (select auth.uid())
  from public.saved_collections mine
  join public.collections c on c.id = mine.collection_id and c.is_active
  left join public.profiles pr on pr.id = c.owner_id
  where mine.profile_id = (select auth.uid())
  order by mine.created_at desc;
$$;

revoke execute on function public.list_saved_collections() from public, anon;
grant execute on function public.list_saved_collections() to authenticated;

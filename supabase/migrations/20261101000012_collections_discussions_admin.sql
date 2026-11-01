-- =============================================================================
-- Shekargah — collections, discussions, personal feed, admin tools
--
--   * collections   — curated product lists (public read, admin managed)
--   * discussions   — threaded conversations with replies
--   * personal feed — products from makers/topics the visitor engaged with
--   * banned words  — moderation filter enforced by triggers
--   * broadcast     — admin sends a system notification to every user
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Collections
-- -----------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (description is null or char_length(btrim(description)) <= 300),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);

create index if not exists collection_products_product_idx on public.collection_products (product_id);

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

drop policy if exists "Active collections are public" on public.collections;
create policy "Active collections are public"
  on public.collections for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists "Admins manage collections" on public.collections;
create policy "Admins manage collections"
  on public.collections for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Collection items are public" on public.collection_products;
create policy "Collection items are public"
  on public.collection_products for select
  to anon, authenticated
  using (
    exists (select 1 from public.collections c where c.id = collection_id and (c.is_active or (select public.is_admin())))
  );

drop policy if exists "Admins manage collection items" on public.collection_products;
create policy "Admins manage collection items"
  on public.collection_products for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.collections, public.collection_products from anon, authenticated;
grant select on public.collections, public.collection_products to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
grant insert, update, delete on public.collection_products to authenticated;

create or replace function public.list_collections()
returns table (
  slug text,
  name text,
  description text,
  product_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.description, count(p.id)
  from public.collections c
  left join public.collection_products cp on cp.collection_id = c.id
  left join public.products p on p.id = cp.product_id and p.status = 'published'
  where c.is_active
  group by c.id, c.slug, c.name, c.description, c.sort_order
  order by c.sort_order, c.name;
$$;

revoke execute on function public.list_collections() from public;
grant execute on function public.list_collections() to anon, authenticated;

create or replace function public.list_collection_products(
  p_slug text,
  p_limit integer default 20,
  p_offset integer default 0
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
  rating_avg numeric,
  rating_count integer,
  verified boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.slug, p.name, p.tagline, p.logo_path,
    p.votes_count, p.comments_count, p.views_count, p.published_at,
    p.rating_avg, p.rating_count, p.verified,
    count(*) over () as total_count
  from public.collections c
  join public.collection_products cp on cp.collection_id = c.id
  join public.products p on p.id = cp.product_id and p.status = 'published'
  where c.is_active and c.slug = btrim(p_slug)
  order by cp.sort_order, p.published_at desc, p.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_collection_products(text, integer, integer) from public;
grant execute on function public.list_collection_products(text, integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Discussions
-- -----------------------------------------------------------------------------
create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  body text not null check (char_length(btrim(body)) between 10 and 4000),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  related_url text check (related_url is null or related_url ~* '^https?://[^\s]+$'),
  post_count integer not null default 0 check (post_count >= 0),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists discussion_threads_activity_idx on public.discussion_threads (last_activity_at desc);
create index if not exists discussion_posts_thread_idx on public.discussion_posts (thread_id, created_at);

alter table public.discussion_threads enable row level security;
alter table public.discussion_posts enable row level security;

drop policy if exists "Threads are public" on public.discussion_threads;
create policy "Threads are public"
  on public.discussion_threads for select
  to anon, authenticated
  using (true);

drop policy if exists "Members start threads as themselves" on public.discussion_threads;
create policy "Members start threads as themselves"
  on public.discussion_threads for insert
  to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors and admins delete threads" on public.discussion_threads;
create policy "Authors and admins delete threads"
  on public.discussion_threads for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Posts are public" on public.discussion_posts;
create policy "Posts are public"
  on public.discussion_posts for select
  to anon, authenticated
  using (true);

drop policy if exists "Members reply as themselves" on public.discussion_posts;
create policy "Members reply as themselves"
  on public.discussion_posts for insert
  to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors and admins delete posts" on public.discussion_posts;
create policy "Authors and admins delete posts"
  on public.discussion_posts for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

revoke all on table public.discussion_threads, public.discussion_posts from anon, authenticated;
grant select on public.discussion_threads, public.discussion_posts to anon, authenticated;
grant insert (title, body, product_id, related_url) on public.discussion_threads to authenticated;
grant delete on public.discussion_threads to authenticated;
grant insert (thread_id, body) on public.discussion_posts to authenticated;
grant delete on public.discussion_posts to authenticated;

create or replace function public.prepare_discussion_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.author_id := (select auth.uid());
  end if;
  new.title := btrim(public.normalize_fa(new.title));
  new.body := btrim(public.normalize_fa(new.body));
  new.created_at := now();
  new.last_activity_at := now();
  new.post_count := 0;
  return new;
end;
$$;

drop trigger if exists discussion_threads_prepare on public.discussion_threads;
create trigger discussion_threads_prepare
  before insert on public.discussion_threads
  for each row execute function public.prepare_discussion_thread();

create or replace function public.prepare_discussion_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.author_id := (select auth.uid());
  end if;
  new.body := btrim(public.normalize_fa(new.body));
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists discussion_posts_prepare on public.discussion_posts;
create trigger discussion_posts_prepare
  before insert on public.discussion_posts
  for each row execute function public.prepare_discussion_post();

create or replace function public.sync_thread_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.discussion_threads
    set post_count = post_count + 1, last_activity_at = new.created_at
    where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.discussion_threads
    set post_count = greatest(post_count - 1, 0)
    where id = old.thread_id;
  end if;
  return null;
end;
$$;

drop trigger if exists discussion_posts_sync on public.discussion_posts;
create trigger discussion_posts_sync
  after insert or delete on public.discussion_posts
  for each row execute function public.sync_thread_activity();

revoke execute on function public.prepare_discussion_thread() from public, anon, authenticated;
revoke execute on function public.prepare_discussion_post() from public, anon, authenticated;
revoke execute on function public.sync_thread_activity() from public, anon, authenticated;

create or replace function public.list_discussion_threads(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  body text,
  post_count integer,
  last_activity_at timestamptz,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  product_slug text,
  product_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.body, t.post_count, t.last_activity_at, t.created_at,
         pr.id, pr.username, pr.display_name, pr.avatar_path,
         p.slug, p.name,
         count(*) over () as total_count
  from public.discussion_threads t
  join public.profiles pr on pr.id = t.author_id
  left join public.products p on p.id = t.product_id
  order by t.last_activity_at desc, t.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_discussion_threads(integer, integer) from public;
grant execute on function public.list_discussion_threads(integer, integer) to anon, authenticated;

create or replace function public.get_discussion_thread(p_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  post_count integer,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  product_slug text,
  product_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.body, t.post_count, t.created_at,
         pr.id, pr.username, pr.display_name, pr.avatar_path,
         p.slug, p.name
  from public.discussion_threads t
  join public.profiles pr on pr.id = t.author_id
  left join public.products p on p.id = t.product_id
  where t.id = p_id;
$$;

revoke execute on function public.get_discussion_thread(uuid) from public;
grant execute on function public.get_discussion_thread(uuid) to anon, authenticated;

create or replace function public.list_discussion_posts(p_thread_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select dp.id, dp.body, dp.created_at, pr.id, pr.username, pr.display_name, pr.avatar_path
  from public.discussion_posts dp
  join public.profiles pr on pr.id = dp.author_id
  where dp.thread_id = p_thread_id
  order by dp.created_at
  limit 200;
$$;

revoke execute on function public.list_discussion_posts(uuid) from public;
grant execute on function public.list_discussion_posts(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Personal feed: makers and topics this visitor already engaged with
-- -----------------------------------------------------------------------------
create or replace function public.list_personal_feed(
  p_limit integer default 20,
  p_offset integer default 0
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
  rating_avg numeric,
  rating_count integer,
  verified boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  liked_makers as (
    select distinct p.maker_id
    from public.votes v
    join public.products p on p.id = v.product_id
    cross join me
    where v.user_id = me.uid
  ),
  liked_topics as (
    select distinct p.category_id
    from public.votes v
    join public.products p on p.id = v.product_id
    cross join me
    where v.user_id = me.uid
  ),
  picked as (
    select p.*
    from public.products p
    cross join me
    where p.status = 'published'
      and me.uid is not null
      and p.maker_id <> me.uid
      and (
        p.maker_id in (select maker_id from liked_makers)
        or p.category_id in (select category_id from liked_topics)
      )
  )
  select
    p.id, p.slug, p.name, p.tagline, p.logo_path,
    p.votes_count, p.comments_count, p.views_count, p.published_at,
    p.rating_avg, p.rating_count, p.verified,
    count(*) over () as total_count
  from picked p
  order by p.published_at desc, p.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_personal_feed(integer, integer) from public, anon;
grant execute on function public.list_personal_feed(integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Banned words (moderation filter)
-- -----------------------------------------------------------------------------
create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null check (char_length(btrim(word)) between 2 and 40),
  created_at timestamptz not null default now(),
  constraint banned_words_word_unique unique (word)
);

alter table public.banned_words enable row level security;

drop policy if exists "Admins manage banned words" on public.banned_words;
create policy "Admins manage banned words"
  on public.banned_words for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.banned_words from anon, authenticated;
grant select, insert, delete on public.banned_words to authenticated;

create or replace function public.contains_banned_word(p_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.banned_words bw
    where p_text ilike '%' || bw.word || '%'
  );
$$;

revoke execute on function public.contains_banned_word(text) from public, anon, authenticated;

create or replace function public.guard_banned_words()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    if public.contains_banned_word(new.name) or public.contains_banned_word(new.tagline) or public.contains_banned_word(new.description) then
      raise exception 'banned_word' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'comments' then
    if public.contains_banned_word(new.body) then
      raise exception 'banned_word' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_words on public.products;
create trigger products_guard_words
  before insert or update on public.products
  for each row execute function public.guard_banned_words();

drop trigger if exists comments_guard_words on public.comments;
create trigger comments_guard_words
  before insert on public.comments
  for each row execute function public.guard_banned_words();

revoke execute on function public.guard_banned_words() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Broadcast: one system notification per user, admins only
-- -----------------------------------------------------------------------------
create or replace function public.admin_broadcast(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_title text := btrim(coalesce(p_title, ''));
  clean_body text := btrim(coalesce(p_body, ''));
  sent integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if char_length(clean_title) < 3 or char_length(clean_body) < 3 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, kind, body)
  select pr.id, 'system', left(clean_title || ': ' || clean_body, 300)
  from public.profiles pr;

  get diagnostics sent = row_count;
  return sent;
end;
$$;

revoke execute on function public.admin_broadcast(text, text) from public, anon;
grant execute on function public.admin_broadcast(text, text) to authenticated;
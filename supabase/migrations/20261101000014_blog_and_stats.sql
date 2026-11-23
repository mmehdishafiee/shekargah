-- =============================================================================
-- Shekargah — blog posts
--
-- Simple editorial layer: admins write posts in Markdown with per-post SEO
-- fields. Public reads published posts only.
-- =============================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  excerpt text check (excerpt is null or char_length(btrim(excerpt)) <= 300),
  content text not null check (char_length(btrim(content)) between 10 and 60000),
  cover_key text check (cover_key is null or char_length(cover_key) <= 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid references public.profiles (id) on delete set null,
  seo_title text check (seo_title is null or char_length(btrim(seo_title)) <= 70),
  seo_description text check (seo_description is null or char_length(btrim(seo_description)) <= 160),
  tags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_published_at check (status <> 'published' or published_at is not null)
);

create index if not exists posts_published_idx on public.posts (status, published_at desc);
create index if not exists posts_tags_idx on public.posts using gin (tags);

alter table public.posts enable row level security;

drop policy if exists "Published posts are public" on public.posts;
create policy "Published posts are public"
  on public.posts for select
  to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

drop policy if exists "Admins manage posts" on public.posts;
create policy "Admins manage posts"
  on public.posts for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

create or replace function public.list_posts(
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  cover_key text,
  tags text[],
  published_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.title, p.excerpt, p.cover_key, p.tags, p.published_at,
         pr.id, pr.username, pr.display_name, pr.avatar_path,
         count(*) over () as total_count
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.status = 'published'
  order by p.published_at desc, p.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_posts(integer, integer) from public;
grant execute on function public.list_posts(integer, integer) to anon, authenticated;

create or replace function public.get_post(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  content text,
  cover_key text,
  tags text[],
  seo_title text,
  seo_description text,
  published_at timestamptz,
  updated_at timestamptz,
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
  select p.id, p.slug, p.title, p.excerpt, p.content, p.cover_key, p.tags,
         p.seo_title, p.seo_description, p.published_at, p.updated_at,
         pr.id, pr.username, pr.display_name, pr.avatar_path
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.slug = btrim(p_slug) and p.status = 'published';
$$;

revoke execute on function public.get_post(text) from public;
grant execute on function public.get_post(text) to anon, authenticated;

-- Admin: save (create or update) a post and return its slug.
create or replace function public.admin_save_post(
  p_id uuid,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_content text,
  p_seo_title text,
  p_seo_description text,
  p_tags text[],
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_id uuid := p_id;
  v_status text := case when p_status = 'published' then 'published' else 'draft' end;
  v_tags text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 or char_length(btrim(coalesce(p_content, ''))) < 10 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct left(btrim(t), 24)), '{}'::text[])
  into v_tags
  from unnest(coalesce(p_tags, '{}'::text[])) as t
  where nullif(btrim(t), '') is not null;

  if v_id is null then
    insert into public.posts (slug, title, excerpt, content, seo_title, seo_description, tags, status, author_id, published_at)
    values (v_slug, btrim(p_title), nullif(btrim(coalesce(p_excerpt, '')), ''), p_content,
            nullif(btrim(coalesce(p_seo_title, '')), ''), nullif(btrim(coalesce(p_seo_description, '')), ''),
            v_tags, v_status, (select auth.uid()), case when v_status = 'published' then now() else null end)
    returning id into v_id;
  else
    update public.posts
    set slug = v_slug,
        title = btrim(p_title),
        excerpt = nullif(btrim(coalesce(p_excerpt, '')), ''),
        content = p_content,
        seo_title = nullif(btrim(coalesce(p_seo_title, '')), ''),
        seo_description = nullif(btrim(coalesce(p_seo_description, '')), ''),
        tags = v_tags,
        status = v_status,
        published_at = case
          when v_status = 'published' then coalesce(published_at, now())
          else published_at
        end,
        updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'post_not_found' using errcode = 'P0002';
    end if;
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.admin_save_post(uuid, text, text, text, text, text, text, text[], text) from public, anon;
grant execute on function public.admin_save_post(uuid, text, text, text, text, text, text, text[], text) to authenticated;

-- Admin: everything including drafts.
create or replace function public.admin_list_posts(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  status text,
  tags text[],
  published_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.slug, p.title, p.status, p.tags, p.published_at, p.updated_at,
         count(*) over () as total_count
  from public.posts p
  order by p.updated_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
end;
$$;

revoke execute on function public.admin_list_posts(integer, integer) from public, anon;
grant execute on function public.admin_list_posts(integer, integer) to authenticated;

-- Admin: load one post for editing (drafts included).
create or replace function public.admin_get_post(p_id uuid)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  content text,
  seo_title text,
  seo_description text,
  tags text[],
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.slug, p.title, p.excerpt, p.content, p.seo_title, p.seo_description, p.tags, p.status
  from public.posts p where p.id = p_id;
end;
$$;

revoke execute on function public.admin_get_post(uuid) from public, anon;
grant execute on function public.admin_get_post(uuid) to authenticated;

create or replace function public.admin_delete_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.posts where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_post(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Site stats (used on the home sidebar and the admin dashboard)
-- -----------------------------------------------------------------------------
create or replace function public.site_stats()
returns table (products bigint, makers bigint, votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.products where status = 'published'),
    (select count(distinct maker_id) from public.products where status = 'published'),
    (select coalesce(sum(votes_count), 0) from public.products where status = 'published');
$$;

revoke execute on function public.site_stats() from public;
grant execute on function public.site_stats() to anon, authenticated;
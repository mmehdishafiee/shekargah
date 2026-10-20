-- =============================================================================
-- Shekargah — engagement features
--
-- Adds the data needed for: daily product lists, daily/weekly leaderboards,
-- a trending feed, view counters, saved (bookmarked) products and multiple
-- tags per product (the single category stays as the primary taxonomy).
--
-- Security model, consistent with 20261011000001_initial_schema.sql:
--   * Every table has RLS enabled and privileges are revoked from anon and
--     authenticated before being re-granted column-by-column.
--   * Counter columns (views_count) are never writable by clients; they move
--     only through SECURITY DEFINER functions.
--   * Aggregations over private rows (votes) happen inside SECURITY DEFINER
--     functions that filter to published products explicitly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New columns
-- -----------------------------------------------------------------------------

alter table public.products
  add column if not exists views_count integer not null default 0
    check (views_count >= 0);

create index if not exists products_views_idx on public.products (views_count desc);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  name text not null unique
    check (char_length(btrim(name)) between 2 and 30),
  created_at timestamptz not null default now()
);

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);

create index product_tags_tag_idx on public.product_tags (tag_id);

create table public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_products_unique unique (user_id, product_id)
);

create index saved_products_user_idx on public.saved_products (user_id, created_at desc);
create index saved_products_product_idx on public.saved_products (product_id);

-- One row per counted view. `viewer_key` is a client-generated identifier
-- (stored in the browser) so anonymous visitors can also be de-duplicated.
create table public.product_views (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  viewer_key text not null
    check (char_length(viewer_key) between 1 and 64),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index product_views_lookup_idx on public.product_views (product_id, viewer_key, created_at desc);

-- -----------------------------------------------------------------------------
-- Default tags
-- -----------------------------------------------------------------------------

insert into public.tags (slug, name) values
  ('open-source',   'متن‌باز'),
  ('ai',            'هوش مصنوعی'),
  ('persian',       'فارسی'),
  ('mobile',        'موبایل'),
  ('web',           'وب'),
  ('api',           'API'),
  ('productivity',  'بهره‌وری'),
  ('education',     'آموزش'),
  ('fintech',       'مالی'),
  ('design',        'طراحی'),
  ('games',         'بازی'),
  ('health',        'سلامت'),
  ('ecommerce',     'فروشگاهی'),
  ('security',      'امنیت'),
  ('data',          'داده'),
  ('cloud',         'ابری'),
  ('devtools',      'ابزار توسعه‌دهندگان'),
  ('startup',       'استارتاپ'),
  ('utility',       'ابزارک'),
  ('content',       'محتوا'),
  ('automation',    'اتوماسیون'),
  ('privacy',       'حریم خصوصی')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Saved products always belong to the caller.
create or replace function public.prepare_new_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.user_id := (select auth.uid());
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger saved_products_before_insert
  before insert on public.saved_products
  for each row execute function public.prepare_new_save();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.saved_products enable row level security;
alter table public.product_views enable row level security;

-- tags
create policy "Tags are public"
  on public.tags for select
  to anon, authenticated
  using (true);

create policy "Admins manage tags"
  on public.tags for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- product_tags
create policy "Product tags are public"
  on public.product_tags for select
  to anon, authenticated
  using (true);

-- saved_products
create policy "Users see their own saves"
  on public.saved_products for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users save published products as themselves"
  on public.saved_products for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

create policy "Users remove their own saves"
  on public.saved_products for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- product_views: nothing is readable or writable directly; only through RPC.
create policy "No direct access to product views"
  on public.product_views for select
  to anon, authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on table
  public.tags, public.product_tags, public.saved_products, public.product_views
from anon, authenticated;

grant select on public.tags, public.product_tags to anon, authenticated;
grant insert, update, delete on public.tags to authenticated;

grant select, delete on public.saved_products to authenticated;
grant insert (product_id) on public.saved_products to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: feed listing (rewritten to include tags, views and a tag filter)
-- -----------------------------------------------------------------------------

drop function if exists public.list_products(text, text, text, integer, integer);

create or replace function public.list_products(
  p_search text default null,
  p_category text default null,
  p_sort text default 'popular',
  p_limit integer default 20,
  p_offset integer default 0,
  p_tags text[] default null
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
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
           p.comments_count, p.views_count, p.published_at, p.category_id
    from public.products p
    left join public.categories c on c.id = p.category_id
    where p.status = 'published'
      and (nullif(btrim(p_category), '') is null or c.slug = btrim(p_category))
      and (
        nullif(btrim(p_search), '') is null
        or (p.name || ' ' || p.tagline) ilike
           '%' || public.escape_like(public.normalize_fa(btrim(p_search))) || '%'
      )
      and (
        p_tags is null
        or cardinality(p_tags) = 0
        or exists (
          select 1
          from public.product_tags pt
          join public.tags t on t.id = pt.tag_id
          where pt.product_id = p.id and t.slug = any (p_tags)
        )
      )
  )
  select
    m.id, m.slug, m.name, m.tagline, m.logo_path,
    m.votes_count, m.comments_count, m.views_count, m.published_at,
    c.id, c.slug, c.name,
    coalesce(
      (select array_agg(t.slug order by t.slug)
       from public.product_tags pt join public.tags t on t.id = pt.tag_id
       where pt.product_id = m.id),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(t.name order by t.slug)
       from public.product_tags pt join public.tags t on t.id = pt.tag_id
       where pt.product_id = m.id),
      '{}'::text[]
    ),
    count(*) over () as total_count
  from matched m
  left join public.categories c on c.id = m.category_id
  order by
    case when p_sort = 'popular' then m.votes_count end desc nulls last,
    case when p_sort = 'views' then m.views_count end desc nulls last,
    m.published_at desc,
    m.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

-- -----------------------------------------------------------------------------
-- RPC: daily products (published on a given Tehran calendar day)
-- -----------------------------------------------------------------------------

create or replace function public.list_daily_products(
  p_date date default null,
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
  category_id uuid,
  category_slug text,
  category_name text,
  tag_slugs text[],
  tag_names text[],
  rank integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select coalesce(p_date, (now() at time zone 'Asia/Tehran')::date) as day
  ),
  ranked as (
    select
      p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
      p.comments_count, p.views_count, p.published_at, p.category_id,
      row_number() over (order by p.votes_count desc, p.published_at desc, p.id) as rank
    from public.products p, target
    where p.status = 'published'
      and (p.published_at at time zone 'Asia/Tehran')::date = target.day
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
    r.rank::integer,
    count(*) over () as total_count
  from ranked r
  left join public.categories c on c.id = r.category_id
  order by r.rank
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

-- -----------------------------------------------------------------------------
-- RPC: leaderboard (ranked by votes received inside a time window)
-- -----------------------------------------------------------------------------

create or replace function public.list_leaderboard(
  p_period text default 'daily',
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
  window_start timestamptz;
begin
  if p_period = 'weekly' then
    window_start := (((now() at time zone 'Asia/Tehran')::date - 6)::timestamp at time zone 'Asia/Tehran');
  else
    window_start := (((now() at time zone 'Asia/Tehran')::date)::timestamp at time zone 'Asia/Tehran');
  end if;

  return query
  with scored as (
    select
      p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
      p.comments_count, p.views_count, p.published_at, p.category_id,
      count(v.id) as score
    from public.products p
    join public.votes v on v.product_id = p.id and v.created_at >= window_start
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

-- -----------------------------------------------------------------------------
-- RPC: trending (recent engagement velocity, not lifetime totals)
-- -----------------------------------------------------------------------------

create or replace function public.list_trending(
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
  category_id uuid,
  category_slug text,
  category_name text,
  tag_slugs text[],
  tag_names text[],
  score bigint,
  rank integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with scored as (
    select
      p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
      p.comments_count, p.views_count, p.published_at, p.category_id,
      (
        select count(*) * 3 from public.votes v
        where v.product_id = p.id and v.created_at > now() - interval '48 hours'
      )
      +
      (
        select count(*) from public.comments m
        where m.product_id = p.id and m.created_at > now() - interval '48 hours'
      ) as score
    from public.products p
    where p.status = 'published'
      and p.published_at > now() - interval '30 days'
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.published_at desc, s.id) as rank
    from scored s
    where s.score > 0
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
$$;

-- -----------------------------------------------------------------------------
-- RPC: record a view (de-duplicated per viewer for 24 hours)
-- -----------------------------------------------------------------------------

create or replace function public.record_product_view(
  p_product_id uuid,
  p_viewer_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_key text := left(btrim(coalesce(p_viewer_key, '')), 64);
begin
  if char_length(clean_key) < 1 then
    raise exception 'invalid_viewer_key' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.products p where p.id = p_product_id and p.status = 'published'
  ) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.product_views v
    where v.product_id = p_product_id
      and v.viewer_key = clean_key
      and v.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into public.product_views (product_id, viewer_key, user_id)
  values (p_product_id, clean_key, (select auth.uid()));

  update public.products
  set views_count = views_count + 1
  where id = p_product_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: assign tags to a product (makers on their drafts, admins anywhere)
-- -----------------------------------------------------------------------------

create or replace function public.set_product_tags(
  p_product_id uuid,
  p_slugs text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_maker uuid;
  product_status text;
  cleaned text[];
  unknown_tags text[];
begin
  select maker_id, status into product_maker, product_status
  from public.products where id = p_product_id;

  if product_maker is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if not (public.is_admin() or (product_maker = (select auth.uid()) and product_status <> 'published')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct btrim(slug)), '{}'::text[])
  into cleaned
  from unnest(coalesce(p_slugs, '{}'::text[])) as slug
  where nullif(btrim(slug), '') is not null;

  if cardinality(cleaned) > 5 then
    raise exception 'too_many_tags' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(s), '{}'::text[]) into unknown_tags
  from unnest(cleaned) as s
  where not exists (select 1 from public.tags t where t.slug = s);

  if cardinality(unknown_tags) > 0 then
    raise exception 'unknown_tag' using errcode = 'P0001';
  end if;

  delete from public.product_tags where product_id = p_product_id;

  insert into public.product_tags (product_id, tag_id)
  select p_product_id, t.id
  from public.tags t
  where t.slug = any (cleaned)
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------

revoke execute on function public.prepare_new_save() from public, anon, authenticated;

revoke execute on function public.list_products(text, text, text, integer, integer, text[]) from public;
revoke execute on function public.list_daily_products(date, integer, integer) from public;
revoke execute on function public.list_leaderboard(text, integer, integer) from public;
revoke execute on function public.list_trending(integer, integer) from public;
revoke execute on function public.record_product_view(uuid, text) from public;
revoke execute on function public.set_product_tags(uuid, text[]) from public;

grant execute on function public.list_products(text, text, text, integer, integer, text[]) to anon, authenticated;
grant execute on function public.list_daily_products(date, integer, integer) to anon, authenticated;
grant execute on function public.list_leaderboard(text, integer, integer) to anon, authenticated;
grant execute on function public.list_trending(integer, integer) to anon, authenticated;
grant execute on function public.record_product_view(uuid, text) to anon, authenticated;
grant execute on function public.set_product_tags(uuid, text[]) to authenticated;

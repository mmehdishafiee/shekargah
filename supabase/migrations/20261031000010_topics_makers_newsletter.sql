-- =============================================================================
-- Shekargah — topics, top makers, richer search, newsletter
--
-- Adds the discovery surfaces that the current UI lacks:
--   * list_topics()        — categories with product counts + recent traction
--   * list_top_makers()    — makers ranked by votes their products received
--   * list_products()      — search now also matches makers and tag names
--   * newsletter           — subscribers table + validated subscribe RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Topics (categories are the primary taxonomy already)
-- -----------------------------------------------------------------------------
create or replace function public.list_topics()
returns table (
  slug text,
  name text,
  description text,
  product_count bigint,
  recent_votes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.slug,
    c.name,
    c.description,
    count(p.id) as product_count,
    coalesce(sum(
      (select count(*) from public.votes v
       where v.product_id = p.id and v.created_at > now() - interval '7 days')
    ), 0) as recent_votes
  from public.categories c
  left join public.products p on p.category_id = c.id and p.status = 'published'
  where c.is_active
  group by c.id, c.slug, c.name, c.description
  order by recent_votes desc, product_count desc, c.name;
$$;

revoke execute on function public.list_topics() from public;
grant execute on function public.list_topics() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Top makers (ranked by votes received on published products)
-- -----------------------------------------------------------------------------
create or replace function public.list_top_makers(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  product_count bigint,
  votes_total bigint,
  rank integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with scored as (
    select
      pr.id,
      pr.username,
      pr.display_name,
      pr.avatar_path,
      count(p.id) as product_count,
      coalesce(sum(p.votes_count), 0)::bigint as votes_total
    from public.profiles pr
    join public.products p on p.maker_id = pr.id and p.status = 'published'
    group by pr.id, pr.username, pr.display_name, pr.avatar_path
  )
  select
    s.id, s.username, s.display_name, s.avatar_path,
    s.product_count, s.votes_total,
    (row_number() over (order by s.votes_total desc, s.product_count desc, s.username))::integer as rank
  from scored s
  order by s.votes_total desc, s.product_count desc, s.username
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_top_makers(integer, integer) from public;
grant execute on function public.list_top_makers(integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Richer search: products, makers and tag names
-- -----------------------------------------------------------------------------
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
  with term as (
    select public.escape_like(public.normalize_fa(btrim(coalesce(p_search, '')))) as value
  ),
  matched as (
    select p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
           p.comments_count, p.views_count, p.published_at, p.category_id
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.profiles maker on maker.id = p.maker_id
    cross join term
    where p.status = 'published'
      and (nullif(btrim(p_category), '') is null or c.slug = btrim(p_category))
      and (
        term.value = ''
        or (p.name || ' ' || p.tagline) ilike '%' || term.value || '%'
        or coalesce(c.name, '') ilike '%' || term.value || '%'
        or maker.username ilike '%' || term.value || '%'
        or maker.display_name ilike '%' || term.value || '%'
        or exists (
          select 1 from public.product_tags pt
          join public.tags t on t.id = pt.tag_id
          where pt.product_id = p.id
            and (t.name ilike '%' || term.value || '%' or t.slug ilike '%' || term.value || '%')
        )
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
-- Newsletter
-- -----------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (
      char_length(btrim(email)) between 5 and 254
      and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
    ),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_unique unique (email)
);

create index if not exists newsletter_created_idx on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- Nobody reads the list from the client; only admins may inspect it.
drop policy if exists "Admins read newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins read newsletter subscribers"
  on public.newsletter_subscribers for select
  to authenticated
  using ((select public.is_admin()));

revoke all on table public.newsletter_subscribers from anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;

-- subscribe_newsletter(): idempotent, normalises the address, never reveals
-- whether an address was already on the list.
create or replace function public.subscribe_newsletter(
  p_email text,
  p_source text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_source text := nullif(left(btrim(coalesce(p_source, '')), 40), '');
begin
  if clean_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(clean_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers (email, source)
  values (clean_email, clean_source)
  on conflict (email) do nothing;
end;
$$;

revoke execute on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
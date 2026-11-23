-- =============================================================================
-- Daily winners + longer leaderboard periods
--
--   * list_daily_winners() — the top products of each recent day, which is the
--     home page's main discovery surface.
--   * list_leaderboard()   — gains monthly and yearly windows.
-- =============================================================================

create or replace function public.list_daily_winners(
  p_days integer default 7,
  p_per_day integer default 5
)
returns table (
  day date,
  rank integer,
  id uuid,
  slug text,
  name text,
  tagline text,
  logo_path text,
  votes_count integer,
  comments_count integer,
  views_count integer,
  published_at timestamptz,
  category_slug text,
  category_name text,
  rating_avg numeric,
  rating_count integer,
  verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      least(greatest(coalesce(p_days, 7), 1), 30) as days,
      least(greatest(coalesce(p_per_day, 5), 1), 10) as per_day
  ),
  ranked as (
    select
      (p.published_at at time zone 'Asia/Tehran')::date as day,
      p.id, p.slug, p.name, p.tagline, p.logo_path, p.votes_count,
      p.comments_count, p.views_count, p.published_at, p.category_id,
      p.rating_avg, p.rating_count, p.verified,
      row_number() over (
        partition by (p.published_at at time zone 'Asia/Tehran')::date
        order by p.votes_count desc, p.published_at desc, p.id
      ) as rank
    from public.products p, bounds b
    where p.status = 'published'
      and p.published_at >= (
        ((now() at time zone 'Asia/Tehran')::date - (b.days - 1))::timestamp at time zone 'Asia/Tehran'
      )
  )
  select
    r.day, r.rank::integer,
    r.id, r.slug, r.name, r.tagline, r.logo_path,
    r.votes_count, r.comments_count, r.views_count, r.published_at,
    (select c.slug from public.categories c where c.id = r.category_id),
    (select c.name from public.categories c where c.id = r.category_id),
    r.rating_avg, r.rating_count, r.verified
  from ranked r
  cross join bounds b
  where r.rank <= b.per_day
  order by r.day desc, r.rank;
$$;

revoke execute on function public.list_daily_winners(integer, integer) from public;
grant execute on function public.list_daily_winners(integer, integer) to anon, authenticated;

-- Period leaderboard: add monthly and yearly windows.
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
  if p_period = 'yearly' then
    window_start := (((now() at time zone 'Asia/Tehran')::date - 364)::timestamp at time zone 'Asia/Tehran');
  elsif p_period = 'monthly' then
    window_start := (((now() at time zone 'Asia/Tehran')::date - 29)::timestamp at time zone 'Asia/Tehran');
  elsif p_period = 'weekly' then
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

revoke execute on function public.list_leaderboard(text, integer, integer) from public;
grant execute on function public.list_leaderboard(text, integer, integer) to anon, authenticated;

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
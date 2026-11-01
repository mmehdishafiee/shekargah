-- =============================================================================
-- Shekargah — notifications, reviews, verified marks, sponsors
--
--   * notifications — per-user inbox with unread state, fed by triggers
--   * reviews       — one 1–5 star review per user per product
--   * verified      — "human reviewed" badge an admin can grant
--   * sponsors      — sponsor cards shown on the home page
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('vote', 'comment', 'review', 'approved', 'rejected', 'system')),
  product_id uuid references public.products (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  body text check (body is null or char_length(btrim(body)) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users read their own notifications" on public.notifications;
create policy "Users read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users delete their own notifications" on public.notifications;
create policy "Users delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
-- Only the read marker may be written by the client.
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_user(
  p_user_id uuid,
  p_kind text,
  p_product_id uuid default null,
  p_comment_id uuid default null,
  p_actor_id uuid default null,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- Never notify people about their own actions.
  if p_actor_id is not null and p_actor_id = p_user_id then
    return;
  end if;
  insert into public.notifications (user_id, kind, product_id, comment_id, actor_id, body)
  values (p_user_id, p_kind, p_product_id, p_comment_id, p_actor_id, left(coalesce(p_body, ''), 300));
end;
$$;

revoke execute on function public.notify_user(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
$$;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.notify_on_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  maker uuid;
begin
  select maker_id into maker from public.products where id = new.product_id;
  perform public.notify_user(maker, 'vote', new.product_id, null, new.user_id, null);
  return null;
end;
$$;

drop trigger if exists votes_notify on public.votes;
create trigger votes_notify
  after insert on public.votes
  for each row execute function public.notify_on_vote();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  maker uuid;
begin
  select maker_id into maker from public.products where id = new.product_id;
  perform public.notify_user(maker, 'comment', new.product_id, new.id, new.author_id, left(new.body, 120));
  return null;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

revoke execute on function public.notify_on_vote() from public, anon, authenticated;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reviews (one per user per product, 1–5 stars)
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(btrim(body)) between 3 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_product_author_unique unique (product_id, author_id)
);

create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Reviews on published products are public" on public.reviews;
create policy "Reviews on published products are public"
  on public.reviews for select
  to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or (select public.is_admin())
  );

drop policy if exists "Users write their own review" on public.reviews;
create policy "Users write their own review"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
  );

drop policy if exists "Users edit their own review" on public.reviews;
create policy "Users edit their own review"
  on public.reviews for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "Users delete their own review" on public.reviews;
create policy "Users delete their own review"
  on public.reviews for delete
  to authenticated
  using (author_id = (select auth.uid()));

revoke all on table public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (product_id, rating, body) on public.reviews to authenticated;
grant update (rating, body) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

create or replace function public.prepare_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.author_id := (select auth.uid());
    end if;
    new.created_at := now();
  end if;
  new.body := nullif(btrim(public.normalize_fa(coalesce(new.body, ''))), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_prepare on public.reviews;
create trigger reviews_prepare
  before insert or update on public.reviews
  for each row execute function public.prepare_review();

revoke execute on function public.prepare_review() from public, anon, authenticated;

-- Aggregated ratings on products, kept in sync.
alter table public.products
  add column if not exists rating_avg numeric(3, 2) not null default 0
    check (rating_avg between 0 and 5),
  add column if not exists rating_count integer not null default 0
    check (rating_count >= 0);

create or replace function public.sync_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce(agg.avg_rating, 0),
      rating_count = coalesce(agg.total, 0)
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as total
    from public.reviews where product_id = target
  ) agg
  where p.id = target;
  return null;
end;
$$;

drop trigger if exists reviews_sync_rating on public.reviews;
create trigger reviews_sync_rating
  after insert or update or delete on public.reviews
  for each row execute function public.sync_product_rating();

revoke execute on function public.sync_product_rating() from public, anon, authenticated;

create or replace function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  maker uuid;
begin
  select maker_id into maker from public.products where id = new.product_id;
  perform public.notify_user(maker, 'review', new.product_id, null, new.author_id, left(coalesce(new.body, 'امتیاز تازه'), 120));
  return null;
end;
$$;

drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify
  after insert on public.reviews
  for each row execute function public.notify_on_review();

revoke execute on function public.notify_on_review() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Verified ("بررسی‌شده توسط انسان") + admin toggle
-- -----------------------------------------------------------------------------
alter table public.products add column if not exists verified boolean not null default false;

create or replace function public.set_product_verified(
  p_product_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.products
  set verified = coalesce(p_verified, false), updated_at = now()
  where id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_product_verified(uuid, boolean) from public, anon;
grant execute on function public.set_product_verified(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Sponsors
-- -----------------------------------------------------------------------------
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  tagline text check (tagline is null or char_length(btrim(tagline)) <= 120),
  url text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 300),
  logo_key text check (logo_key is null or char_length(logo_key) <= 200),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sponsors_active_idx on public.sponsors (is_active, sort_order);

alter table public.sponsors enable row level security;

drop policy if exists "Active sponsors are public" on public.sponsors;
create policy "Active sponsors are public"
  on public.sponsors for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists "Admins manage sponsors" on public.sponsors;
create policy "Admins manage sponsors"
  on public.sponsors for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.sponsors from anon, authenticated;
grant select on public.sponsors to anon, authenticated;
grant insert, update, delete on public.sponsors to authenticated;

-- -----------------------------------------------------------------------------
-- list_products(): expose rating + verified (return type changes, so recreate)
-- -----------------------------------------------------------------------------
drop function if exists public.list_products(text, text, text, integer, integer, text[]);

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
  rating_avg numeric,
  rating_count integer,
  verified boolean,
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
           p.comments_count, p.views_count, p.published_at, p.category_id,
           p.rating_avg, p.rating_count, p.verified
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
    m.rating_avg,
    m.rating_count,
    m.verified,
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

revoke execute on function public.list_products(text, text, text, integer, integer, text[]) from public;
grant execute on function public.list_products(text, text, text, integer, integer, text[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- list_reviews(p_product_id)
-- -----------------------------------------------------------------------------
create or replace function public.list_reviews(p_product_id uuid)
returns table (
  id uuid,
  rating smallint,
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
  select r.id, r.rating, r.body, r.created_at,
         pr.id, pr.username, pr.display_name, pr.avatar_path
  from public.reviews r
  join public.profiles pr on pr.id = r.author_id
  where r.product_id = p_product_id
    and exists (select 1 from public.products p where p.id = p_product_id and p.status = 'published')
  order by r.created_at desc
  limit 100;
$$;

revoke execute on function public.list_reviews(uuid) from public;
grant execute on function public.list_reviews(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- list_users_overview(p_query, ...) — admin-only directory
-- -----------------------------------------------------------------------------
create or replace function public.list_users_overview(
  p_query text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  role text,
  created_at timestamptz,
  product_count bigint,
  votes_received bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  term text := public.escape_like(public.normalize_fa(btrim(coalesce(p_query, ''))));
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select pr.id, pr.username, pr.display_name, pr.avatar_path, pr.role, pr.created_at,
         count(distinct p.id) as product_count,
         coalesce(sum(p.votes_count), 0)::bigint as votes_received
  from public.profiles pr
  left join public.products p on p.maker_id = pr.id and p.status = 'published'
  where term = ''
     or pr.username ilike '%' || term || '%'
     or pr.display_name ilike '%' || term || '%'
  group by pr.id, pr.username, pr.display_name, pr.avatar_path, pr.role, pr.created_at
  order by pr.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
end;
$$;

revoke execute on function public.list_users_overview(text, integer, integer) from public, anon;
grant execute on function public.list_users_overview(text, integer, integer) to authenticated;
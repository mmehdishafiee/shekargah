-- =============================================================================
-- Shekargah — initial schema
--
-- Security model (see docs/SECURITY.md):
--   * Every table has RLS enabled.
--   * Table privileges are revoked from anon/authenticated and re-granted
--     column-by-column, so clients can never write ownership, status, role,
--     moderation or counter columns — even if a policy were too permissive.
--   * Ownership columns default to auth.uid() and BEFORE triggers force them.
--   * Moderation happens only through SECURITY DEFINER functions that check
--     public.is_admin() and record the acting admin and a timestamp.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalise Arabic code points that commonly sneak into Persian text.
create or replace function public.normalize_fa(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(value, 'يكى', 'یکی');
$$;

-- URL-safe slug that keeps Persian letters (e.g. «دیوار من» → «دیوار-من»).
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    btrim(
      regexp_replace(
        lower(public.normalize_fa(coalesce(value, ''))),
        '[^a-z0-9ء-يپچژکگی۰-۹]+',
        '-',
        'g'
      ),
      '-'
    ),
    80
  );
$$;

create or replace function public.escape_like(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(value, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 50),
  bio text
    check (bio is null or char_length(bio) <= 280),
  avatar_path text
    check (avatar_path is null or (
      avatar_path like id::text || '/%'
      and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
    )),
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  name text not null unique
    check (char_length(btrim(name)) between 2 and 40),
  description text
    check (description is null or char_length(description) <= 200),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) between 1 and 100),
  name text not null
    check (char_length(btrim(name)) between 2 and 60),
  tagline text not null
    check (char_length(btrim(tagline)) between 10 and 120),
  description text not null
    check (char_length(btrim(description)) between 30 and 3000),
  website_url text not null
    check (
      char_length(website_url) <= 300
      and website_url ~* '^https?://[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$'
    ),
  logo_path text,
  category_id uuid not null references public.categories (id) on delete restrict,
  maker_id uuid not null default auth.uid(),
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  moderation_note text
    check (moderation_note is null or char_length(moderation_note) <= 500),
  moderated_by uuid,
  moderated_at timestamptz,
  published_at timestamptz,
  votes_count integer not null default 0 check (votes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_maker_id_fkey
    foreign key (maker_id) references public.profiles (id) on delete cascade,
  constraint products_moderated_by_fkey
    foreign key (moderated_by) references public.profiles (id) on delete set null,
  constraint products_logo_path_owner check (
    logo_path is null or (
      logo_path like maker_id::text || '/%'
      and logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
    )
  ),
  constraint products_published_at check (status <> 'published' or published_at is not null)
);

create index products_feed_newest_idx on public.products (status, published_at desc);
create index products_feed_popular_idx on public.products (status, votes_count desc, published_at desc);
create index products_category_idx on public.products (category_id);
create index products_maker_idx on public.products (maker_id, created_at desc);
create index products_search_idx on public.products
  using gin ((name || ' ' || tagline) extensions.gin_trgm_ops);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_user_product_unique unique (user_id, product_id)
);

create index votes_product_idx on public.votes (product_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  author_id uuid not null default auth.uid(),
  body text not null
    check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint comments_author_id_fkey
    foreign key (author_id) references public.profiles (id) on delete cascade
);

create index comments_product_idx on public.comments (product_id, created_at);
create index comments_author_idx on public.comments (author_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  product_id uuid references public.products (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'inappropriate', 'misleading', 'copyright', 'other')),
  details text
    check (details is null or char_length(details) <= 500),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.profiles (id) on delete cascade,
  constraint reports_resolved_by_fkey
    foreign key (resolved_by) references public.profiles (id) on delete set null,
  constraint reports_single_target check (num_nonnulls(product_id, comment_id) = 1)
);

create unique index reports_unique_product on public.reports (reporter_id, product_id)
  where product_id is not null;
create unique index reports_unique_comment on public.reports (reporter_id, comment_id)
  where comment_id is not null;
create index reports_status_idx on public.reports (status, created_at desc);

-- Append-only audit log of moderation actions.
create table public.moderation_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null
    check (action in ('approve', 'reject', 'unpublish', 'resolve_report', 'dismiss_report', 'delete_comment')),
  product_id uuid references public.products (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  comment_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index moderation_events_created_idx on public.moderation_events (created_at desc);

-- -----------------------------------------------------------------------------
-- Authorization helper
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. Never trusts client metadata for
-- anything except an optional display name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  display text;
begin
  base := left(lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), 20);
  if char_length(base) < 3 then
    base := 'user' || base;
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;

  display := btrim(public.normalize_fa(coalesce(new.raw_user_meta_data ->> 'display_name', '')));
  if char_length(display) not between 2 and 50 then
    display := candidate;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, display);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Products: force ownership + pending status for client inserts, normalise
-- text, generate a unique slug and apply a simple submission rate limit.
create or replace function public.prepare_new_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  pending_count integer;
begin
  if (select auth.uid()) is not null then
    new.maker_id := (select auth.uid());
    new.status := 'pending';
    new.moderation_note := null;
    new.moderated_by := null;
    new.moderated_at := null;
    new.published_at := null;
    new.votes_count := 0;
    new.comments_count := 0;
    new.created_at := now();
    new.updated_at := now();

    select count(*) into pending_count
    from public.products
    where maker_id = new.maker_id and status = 'pending';
    if pending_count >= 3 then
      raise exception 'too_many_pending_submissions' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'inactive_category' using errcode = 'P0001';
  end if;

  new.name := btrim(public.normalize_fa(new.name));
  new.tagline := btrim(public.normalize_fa(new.tagline));
  new.description := btrim(public.normalize_fa(new.description));
  new.website_url := btrim(new.website_url);

  base := public.slugify(new.name);
  if base = '' then
    base := 'product';
  end if;
  candidate := base;
  while exists (select 1 from public.products where slug = candidate) loop
    candidate := base || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger products_before_insert
  before insert on public.products
  for each row execute function public.prepare_new_product();

-- Votes: force the voter and keep products.votes_count in sync.
create or replace function public.prepare_new_vote()
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

create trigger votes_before_insert
  before insert on public.votes
  for each row execute function public.prepare_new_vote();

create or replace function public.sync_votes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set votes_count = votes_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set votes_count = greatest(votes_count - 1, 0) where id = old.product_id;
  end if;
  return null;
end;
$$;

create trigger votes_sync_count
  after insert or delete on public.votes
  for each row execute function public.sync_votes_count();

-- Comments: force the author, rate limit, keep comments_count in sync and
-- log deletions performed by admins on other people's comments.
create or replace function public.prepare_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if (select auth.uid()) is not null then
    new.author_id := (select auth.uid());
    select count(*) into recent_count
    from public.comments
    where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent_count >= 5 then
      raise exception 'comment_rate_limited' using errcode = 'P0001';
    end if;
  end if;
  new.body := btrim(public.normalize_fa(new.body));
  new.created_at := now();
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.prepare_new_comment();

create or replace function public.sync_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set comments_count = comments_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set comments_count = greatest(comments_count - 1, 0) where id = old.product_id;
    if (select auth.uid()) is not null
       and old.author_id <> (select auth.uid())
       and public.is_admin() then
      insert into public.moderation_events (actor_id, action, product_id, comment_id)
      values ((select auth.uid()), 'delete_comment', old.product_id, old.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger comments_sync_count
  after insert or delete on public.comments
  for each row execute function public.sync_comments_count();

-- Reports: force the reporter + open status, rate limit.
create or replace function public.prepare_new_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if (select auth.uid()) is not null then
    new.reporter_id := (select auth.uid());
    select count(*) into recent_count
    from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if recent_count >= 10 then
      raise exception 'report_rate_limited' using errcode = 'P0001';
    end if;
  end if;
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.prepare_new_report();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_events enable row level security;

-- profiles
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- categories
create policy "Active categories are public"
  on public.categories for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Admins create categories"
  on public.categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update categories"
  on public.categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete categories"
  on public.categories for delete
  to authenticated
  using ((select public.is_admin()));

-- products
create policy "Published products are public; makers and admins see the rest"
  on public.products for select
  to anon, authenticated
  using (
    status = 'published'
    or maker_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Users submit pending products as themselves"
  on public.products for insert
  to authenticated
  with check (
    maker_id = (select auth.uid())
    and status = 'pending'
  );

create policy "Makers delete unpublished products; admins delete any"
  on public.products for delete
  to authenticated
  using (
    (maker_id = (select auth.uid()) and status <> 'published')
    or (select public.is_admin())
  );

-- votes
create policy "Users see their own votes"
  on public.votes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users vote on published products"
  on public.votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

create policy "Users remove their own votes"
  on public.votes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- comments
create policy "Comments on published products are public"
  on public.comments for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
    or (select public.is_admin())
  );

create policy "Users comment on published products"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

create policy "Authors and admins delete comments"
  on public.comments for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- reports
create policy "Reporters and admins see reports"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users file reports as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

-- moderation_events
create policy "Admins read the moderation log"
  on public.moderation_events for select
  to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what clients need.
-- -----------------------------------------------------------------------------

revoke all on table
  public.profiles, public.categories, public.products, public.votes,
  public.comments, public.reports, public.moderation_events
from anon, authenticated;

grant select on public.profiles, public.categories, public.products, public.comments
  to anon, authenticated;

grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;

grant insert, update, delete on public.categories to authenticated;

grant insert (name, tagline, description, website_url, logo_path, category_id)
  on public.products to authenticated;
grant delete on public.products to authenticated;

grant select, delete on public.votes to authenticated;
grant insert (product_id) on public.votes to authenticated;

grant insert (product_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant select on public.reports to authenticated;
grant insert (product_id, comment_id, reason, details) on public.reports to authenticated;

grant select on public.moderation_events to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: feed listing (runs with the caller's privileges, so RLS applies)
-- -----------------------------------------------------------------------------

create or replace function public.list_products(
  p_search text default null,
  p_category text default null,
  p_sort text default 'popular',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  tagline text,
  logo_path text,
  maker_id uuid,
  votes_count integer,
  comments_count integer,
  published_at timestamptz,
  category_id uuid,
  category_slug text,
  category_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.slug, p.name, p.tagline, p.logo_path, p.maker_id,
    p.votes_count, p.comments_count, p.published_at,
    c.id, c.slug, c.name,
    count(*) over () as total_count
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.status = 'published'
    and (nullif(btrim(p_category), '') is null or c.slug = btrim(p_category))
    and (
      nullif(btrim(p_search), '') is null
      or (p.name || ' ' || p.tagline) ilike
         '%' || public.escape_like(public.normalize_fa(btrim(p_search))) || '%'
    )
  order by
    case when p_sort = 'popular' then p.votes_count end desc nulls last,
    p.published_at desc,
    p.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

-- -----------------------------------------------------------------------------
-- RPC: moderation (admins only, audited)
-- -----------------------------------------------------------------------------

create or replace function public.moderate_product(
  p_product_id uuid,
  p_action text,
  p_note text default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_product public.products;
  next_status text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into current_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    if current_product.status = 'published' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    next_status := 'published';
  elsif p_action = 'reject' then
    if current_product.status <> 'pending' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    next_status := 'rejected';
  elsif p_action = 'unpublish' then
    if current_product.status <> 'published' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    next_status := 'rejected';
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  if next_status = 'rejected' and clean_note is null then
    raise exception 'note_required' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 500 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  update public.products
  set status = next_status,
      moderation_note = clean_note,
      moderated_by = (select auth.uid()),
      moderated_at = now(),
      published_at = case
        when next_status = 'published' then coalesce(published_at, now())
        else published_at
      end,
      updated_at = now()
  where id = p_product_id
  returning * into current_product;

  insert into public.moderation_events (actor_id, action, product_id, note)
  values ((select auth.uid()), p_action, p_product_id, clean_note);

  return current_product;
end;
$$;

create or replace function public.resolve_report(
  p_report_id uuid,
  p_status text
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_report public.reports;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.reports
  set status = p_status,
      resolved_by = (select auth.uid()),
      resolved_at = now()
  where id = p_report_id
  returning * into current_report;

  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  insert into public.moderation_events (actor_id, action, report_id, product_id, comment_id)
  values (
    (select auth.uid()),
    case when p_status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
    p_report_id,
    current_report.product_id,
    current_report.comment_id
  );

  return current_report;
end;
$$;

-- Function privileges: trigger functions are never callable by clients;
-- RPCs are callable only by the roles that need them.
revoke execute on function
  public.handle_new_user(),
  public.prepare_new_product(),
  public.prepare_new_vote(),
  public.sync_votes_count(),
  public.prepare_new_comment(),
  public.sync_comments_count(),
  public.prepare_new_report(),
  public.set_updated_at()
from public, anon, authenticated;

revoke execute on function public.moderate_product(uuid, text, text) from public, anon;
revoke execute on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.moderate_product(uuid, text, text) to authenticated;
grant execute on function public.resolve_report(uuid, text) to authenticated;
grant execute on function public.list_products(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

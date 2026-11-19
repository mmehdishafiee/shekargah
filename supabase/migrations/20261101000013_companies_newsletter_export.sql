-- =============================================================================
-- Shekargah — companies (organizations) + newsletter export
--
--   * companies        — organization profiles with members
--   * company_members  — who belongs to a company
--   * products.company_id — optional link from a product to its company
--   * list_newsletter_subscribers() — admin-only export source
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Companies
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (description is null or char_length(btrim(description)) <= 500),
  website_url text check (website_url is null or (website_url ~* '^https?://[^\s]+$' and char_length(website_url) <= 300)),
  logo_key text check (logo_key is null or char_length(logo_key) <= 200),
  owner_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);

create index if not exists company_members_profile_idx on public.company_members (profile_id);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists "Active companies are public" on public.companies;
create policy "Active companies are public"
  on public.companies for select
  to anon, authenticated
  using (is_active or (select public.is_admin()) or owner_id = (select auth.uid()));

drop policy if exists "Admins manage companies" on public.companies;
create policy "Admins manage companies"
  on public.companies for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Company members are public" on public.company_members;
create policy "Company members are public"
  on public.company_members for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage company members" on public.company_members;
create policy "Admins manage company members"
  on public.company_members for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.companies, public.company_members from anon, authenticated;
grant select on public.companies, public.company_members to anon, authenticated;
grant insert, update, delete on public.companies to authenticated;
grant insert, update, delete on public.company_members to authenticated;

alter table public.products add column if not exists company_id uuid
  references public.companies (id) on delete set null;

create index if not exists products_company_idx on public.products (company_id);

-- -----------------------------------------------------------------------------
-- Company read RPCs
-- -----------------------------------------------------------------------------
create or replace function public.list_companies(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  logo_key text,
  product_count bigint,
  member_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.description, c.logo_key,
         count(distinct p.id) as product_count,
         count(distinct m.profile_id) as member_count,
         count(*) over () as total_count
  from public.companies c
  left join public.products p on p.company_id = c.id and p.status = 'published'
  left join public.company_members m on m.company_id = c.id
  where c.is_active
  group by c.id, c.slug, c.name, c.description, c.logo_key
  order by product_count desc, c.name
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_companies(integer, integer) from public;
grant execute on function public.list_companies(integer, integer) to anon, authenticated;

create or replace function public.get_company(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  website_url text,
  logo_key text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.description, c.website_url, c.logo_key, c.is_active
  from public.companies c
  where c.slug = btrim(p_slug);
$$;

revoke execute on function public.get_company(text) from public;
grant execute on function public.get_company(text) to anon, authenticated;

create or replace function public.list_company_products(
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
  select p.id, p.slug, p.name, p.tagline, p.logo_path,
         p.votes_count, p.comments_count, p.views_count, p.published_at,
         p.rating_avg, p.rating_count, p.verified,
         count(*) over () as total_count
  from public.companies c
  join public.products p on p.company_id = c.id and p.status = 'published'
  where c.is_active and c.slug = btrim(p_slug)
  order by p.published_at desc, p.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_company_products(text, integer, integer) from public;
grant execute on function public.list_company_products(text, integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Company management (admin only)
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_company(
  p_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_website_url text,
  p_logo_key text,
  p_is_active boolean,
  p_members text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := p_id;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(public.normalize_fa(coalesce(p_name, '')));
  handle text;
  member_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_name) < 2 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if v_company is null then
    insert into public.companies (slug, name, description, website_url, logo_key, is_active)
    values (clean_slug, clean_name, nullif(btrim(coalesce(p_description, '')), ''),
            nullif(btrim(coalesce(p_website_url, '')), ''), nullif(btrim(coalesce(p_logo_key, '')), ''),
            coalesce(p_is_active, true))
    returning id into v_company;
  else
    update public.companies
    set slug = clean_slug,
        name = clean_name,
        description = nullif(btrim(coalesce(p_description, '')), ''),
        website_url = nullif(btrim(coalesce(p_website_url, '')), ''),
        logo_key = nullif(btrim(coalesce(p_logo_key, '')), ''),
        is_active = coalesce(p_is_active, true)
    where id = v_company;
    if not found then
      raise exception 'company_not_found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.company_members m where m.company_id = v_company;

  foreach handle in array coalesce(p_members, '{}'::text[]) loop
    select id into member_id from public.profiles where username = lower(btrim(handle)) limit 1;
    if member_id is not null then
      insert into public.company_members (company_id, profile_id, role)
      values (v_company, member_id, 'member')
      on conflict do nothing;
    end if;
  end loop;

  update public.companies c
  set owner_id = (
    select m.profile_id from public.company_members m
    where m.company_id = c.id
    order by m.created_at
    limit 1
  )
  where c.id = v_company;

  return v_company;
end;
$$;

revoke execute on function public.admin_save_company(uuid, text, text, text, text, text, boolean, text[]) from public, anon;
grant execute on function public.admin_save_company(uuid, text, text, text, text, text, boolean, text[]) to authenticated;

-- Admin links a product to a company (or clears it).
create or replace function public.set_product_company(
  p_product_id uuid,
  p_company_id uuid
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
  set company_id = p_company_id, updated_at = now()
  where id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_product_company(uuid, uuid) from public, anon;
grant execute on function public.set_product_company(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Newsletter export (admin only)
-- -----------------------------------------------------------------------------
create or replace function public.list_newsletter_subscribers(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  email text,
  source text,
  created_at timestamptz,
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
  select n.email, n.source, n.created_at, count(*) over () as total_count
  from public.newsletter_subscribers n
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  offset least(greatest(coalesce(p_offset, 0), 0), 100000);
end;
$$;

revoke execute on function public.list_newsletter_subscribers(integer, integer) from public, anon;
grant execute on function public.list_newsletter_subscribers(integer, integer) to authenticated;
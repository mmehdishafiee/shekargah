-- Product URLs now use the product's own domain instead of the Persian name:
--   /products/با-کیا      -> /products/bakiya      (bakiya.ir)
--   /products/تسکیار      -> /products/taskyar     (github.com/…/taskyar)
-- The previous slug is kept in products.legacy_slug so old links keep resolving.

-- ---- domain_slug(): the spelling used in the URL -----------------------------
-- Order of preference, mirroring scripts/slug-map.simulation:
--   * github.com/<user>/<repo>          -> <repo>
--   * <sub>.github.io[/<repo>]          -> <repo> or <sub>
--   * *.vercel.app / *.netlify.app …    -> first path segment or the subdomain
--   * t.me/<name>                       -> <name>
--   * cafebazaar.ir / apps.apple.com …  -> the app identifier in the path
--   * otherwise, the second-level label (farshad.example.ir -> example),
--     unless the leading label is a generic host name (www, cloud, map, …),
--     in which case the label before the TLD is used.
create or replace function public.domain_slug(url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  bare text;
  authority text;
  host text;
  path text;
  segs text[];
  cand text[];
  labels text[];
  base text;
  generic text[] := array[
    'www','cloud','app','apps','map','mm','m','tools','tool','portfolio',
    'get','try','go','my','web','api','static','demo','shop','store','cdn',
    'dashboard','panel','admin'
  ];
begin
  bare := lower(coalesce(url, ''));
  bare := regexp_replace(bare, '^[a-z][a-z0-9+.\-]*://', '');
  authority := regexp_replace(bare, '[/?#].*$', '');
  -- strip any userinfo, then the port
  authority := regexp_replace(authority, '^[^@]*@', '');
  authority := regexp_replace(authority, ':[0-9]+$', '');
  host := regexp_replace(authority, '^www\.', '');
  path := regexp_replace(bare, '^[^/]*', '');
  path := regexp_replace(path, '[?#].*$', '');
  segs := array(select s from unnest(string_to_array(path, '/')) as s where s <> '');

  if host = 'github.com' then
    base := coalesce(segs[2], segs[1], 'github');
  elsif host like '%.github.io' or host like '%.vercel.app'
     or host like '%.netlify.app' or host like '%.pages.dev' then
    base := coalesce(segs[1], split_part(host, '.', 1));
  elsif host in ('t.me', 'telegram.me', 'telegram.dog') then
    base := coalesce(segs[1], 'telegram');
  elsif host in ('cafebazaar.ir', 'apps.apple.com', 'play.google.com') then
    cand := array(
      select s from unnest(segs) as s
      where s not in ('app', 'apps', 'us', 'en', 'store', 'details', 'market', 'www')
        and s !~ '^id[0-9]+$'
    );
    if array_length(cand, 1) > 0 then
      base := cand[array_length(cand, 1)];
      base := split_part(base, '.', array_length(string_to_array(base, '.'), 1));
    else
      base := split_part(host, '.', 1);
    end if;
  else
    labels := string_to_array(host, '.');
    if array_length(labels, 1) >= 3 and labels[1] = any (generic) then
      base := labels[2];
    else
      base := labels[1];
    end if;
  end if;

  base := public.slugify(base);
  if base = '' then
    base := 'product';
  end if;
  return base;
end;
$$;

-- ---- keep the previous slug addressable --------------------------------------
alter table public.products add column if not exists legacy_slug text;

create index if not exists products_legacy_slug_idx
  on public.products (legacy_slug)
  where legacy_slug is not null;

-- ---- one-off backfill for the products that already exist --------------------
-- Step 1: stash the current slug and park everyone on a guaranteed-unique temp
-- value, so the unique index on slug cannot trip mid-update. coalesce keeps the
-- first legacy slug if the migration is ever re-run.
update public.products
set legacy_slug = coalesce(legacy_slug, slug),
    slug = 'tmp-' || replace(id::text, '-', '')
where slug not like 'tmp-%';

-- Step 2: assign the domain slug, disambiguating collisions deterministically
-- (e.g. two apps on cafebazaar.ir) with a numeric suffix.
with ranked as (
  select
    id,
    public.domain_slug(website_url) as base,
    row_number() over (
      partition by public.domain_slug(website_url)
      order by published_at nulls last, created_at, id
    ) as rn
  from public.products
)
update public.products p
set slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
from ranked r
where p.id = r.id;

-- ---- new products get a domain slug automatically ----------------------------
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
    if pending_count >= 3000 then
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

  base := public.domain_slug(new.website_url);
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

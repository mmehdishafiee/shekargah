-- =============================================================================
-- Shekargah — member-created product lists
--
-- collections gains an owner and a public flag so any member can curate a list
-- (e.g. «بهترین ابزارهای مشاهده قیمت»), share its /collections/<slug> link and
-- have it appear on their profile. Anyone can save someone else's list.
-- Admin-curated collections keep owner_id null and stay public.
-- =============================================================================

alter table public.collections
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade,
  add column if not exists is_public boolean not null default true;

create index if not exists collections_owner_idx on public.collections (owner_id);

create table if not exists public.saved_collections (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, collection_id)
);

alter table public.saved_collections enable row level security;

drop policy if exists "Members read their saved lists" on public.saved_collections;
create policy "Members read their saved lists"
  on public.saved_collections for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Members manage their saved lists" on public.saved_collections;
create policy "Members manage their saved lists"
  on public.saved_collections for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on table public.saved_collections from anon, authenticated;
grant select, insert, delete on table public.saved_collections to authenticated;

-- -----------------------------------------------------------------------------
-- Visibility: public lists for everyone, private ones only for their owner.
-- -----------------------------------------------------------------------------
create or replace function public.collection_visible(p_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and c.is_active
      and (c.is_public or c.owner_id = (select auth.uid()) or (select public.is_admin()))
  );
$$;

revoke execute on function public.collection_visible(uuid) from public;
grant execute on function public.collection_visible(uuid) to anon, authenticated;

drop policy if exists "Active collections are public" on public.collections;
create policy "Visible collections are readable"
  on public.collections for select
  to anon, authenticated
  using (
    is_active
    and (is_public or owner_id = (select auth.uid()) or (select public.is_admin()))
  );

drop policy if exists "Members manage their own collections" on public.collections;
create policy "Members manage their own collections"
  on public.collections for all
  to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Collection items are public" on public.collection_products;
create policy "Collection items follow the collection"
  on public.collection_products for select
  to anon, authenticated
  using ((select public.collection_visible(collection_id)));

drop policy if exists "Members manage their own collection items" on public.collection_products;
create policy "Members manage their own collection items"
  on public.collection_products for all
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

-- -----------------------------------------------------------------------------
-- Mutations
-- -----------------------------------------------------------------------------
create or replace function public.create_collection(
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_slug := 'list-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.collections (slug, name, description, owner_id, is_public, is_active)
  values (v_slug, v_name, v_description, (select auth.uid()), coalesce(p_is_public, true), true);
  return v_slug;
end;
$$;

revoke execute on function public.create_collection(text, text, boolean) from public, anon;
grant execute on function public.create_collection(text, text, boolean) to authenticated;

create or replace function public.update_collection(
  p_collection_id uuid,
  p_name text,
  p_description text default null,
  p_is_public boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.collections
  set name = v_name, description = v_description, is_public = coalesce(p_is_public, true)
  where id = p_collection_id;
end;
$$;

revoke execute on function public.update_collection(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_collection(uuid, text, text, boolean) to authenticated;

create or replace function public.delete_collection(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.collections where id = p_collection_id;
end;
$$;

revoke execute on function public.delete_collection(uuid) from public, anon;
grant execute on function public.delete_collection(uuid) to authenticated;

create or replace function public.add_product_to_collection(p_collection_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if (select count(*) from public.collection_products where collection_id = p_collection_id) >= 200 then
    raise exception 'collection_full' using errcode = '22023';
  end if;
  insert into public.collection_products (collection_id, product_id)
  values (p_collection_id, p_product_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.add_product_to_collection(uuid, uuid) from public, anon;
grant execute on function public.add_product_to_collection(uuid, uuid) to authenticated;

create or replace function public.remove_product_from_collection(p_collection_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collections
    where id = p_collection_id
      and (owner_id = (select auth.uid()) or (select public.is_admin()))
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  delete from public.collection_products
  where collection_id = p_collection_id and product_id = p_product_id;
end;
$$;

revoke execute on function public.remove_product_from_collection(uuid, uuid) from public, anon;
grant execute on function public.remove_product_from_collection(uuid, uuid) to authenticated;

create or replace function public.set_collection_saved(p_collection_id uuid, p_saved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not (select public.collection_visible(p_collection_id)) then
    raise exception 'collection_not_found' using errcode = 'P0002';
  end if;
  if coalesce(p_saved, true) then
    insert into public.saved_collections (profile_id, collection_id)
    values ((select auth.uid()), p_collection_id)
    on conflict do nothing;
  else
    delete from public.saved_collections
    where profile_id = (select auth.uid()) and collection_id = p_collection_id;
  end if;
end;
$$;

revoke execute on function public.set_collection_saved(uuid, boolean) from public, anon;
grant execute on function public.set_collection_saved(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Reads
-- -----------------------------------------------------------------------------
create or replace function public.get_collection(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    exists (select 1 from public.saved_collections sc
            where sc.collection_id = c.id and sc.profile_id = (select auth.uid())),
    c.owner_id is not null and c.owner_id = (select auth.uid())
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.slug = btrim(p_slug)
    and c.is_active
    and (c.is_public or c.owner_id = (select auth.uid()) or (select public.is_admin()));
$$;

revoke execute on function public.get_collection(text) from public;
grant execute on function public.get_collection(text) to anon, authenticated;

create or replace function public.list_my_collections()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    false,
    true
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.owner_id = (select auth.uid()) and c.is_active
  order by c.created_at desc;
$$;

revoke execute on function public.list_my_collections() from public, anon;
grant execute on function public.list_my_collections() to authenticated;

create or replace function public.list_profile_collections(p_profile_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    exists (select 1 from public.saved_collections sc
            where sc.collection_id = c.id and sc.profile_id = (select auth.uid())),
    c.owner_id = (select auth.uid())
  from public.collections c
  left join public.profiles pr on pr.id = c.owner_id
  where c.owner_id = p_profile_id and c.is_active and c.is_public
  order by c.created_at desc;
$$;

revoke execute on function public.list_profile_collections(uuid) from public;
grant execute on function public.list_profile_collections(uuid) to anon, authenticated;

create or replace function public.list_saved_collections()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  is_public boolean,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_path text,
  product_count bigint,
  save_count bigint,
  is_saved boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.name, c.description, c.is_public,
    c.owner_id, pr.username, pr.display_name, pr.avatar_path,
    (select count(*) from public.collection_products cp
       join public.products p on p.id = cp.product_id and p.status = 'published'
      where cp.collection_id = c.id),
    (select count(*) from public.saved_collections sc where sc.collection_id = c.id),
    true,
    c.owner_id = (select auth.uid())
  from public.saved_collections mine
  join public.collections c on c.id = mine.collection_id and c.is_active
  left join public.profiles pr on pr.id = c.owner_id
  where mine.profile_id = (select auth.uid())
  order by mine.created_at desc;
$$;

revoke execute on function public.list_saved_collections() from public, anon;
grant execute on function public.list_saved_collections() to authenticated;
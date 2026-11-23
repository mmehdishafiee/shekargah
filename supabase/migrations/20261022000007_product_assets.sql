-- =============================================================================
-- Shekargah — product screenshots in Supabase Storage
--
-- Screenshot metadata lives in product_screenshots. Files live in the public
-- product-screenshots bucket under products/<product-id>/screenshots/<file>.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-screenshots', 'product-screenshots', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own uploads" on storage.objects;
drop policy if exists "Users upload into their own folder" on storage.objects;
drop policy if exists "Users delete their own uploads" on storage.objects;

create policy "Users read their own uploads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('product-logos', 'avatars', 'product-screenshots')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('product-logos', 'avatars', 'product-screenshots')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
  );

create policy "Users delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('product-logos', 'avatars', 'product-screenshots')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create table if not exists public.product_screenshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'r2')),
  object_key text not null
    check (
      char_length(btrim(object_key)) between 1 and 300
      and object_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    ),
  sort_order integer not null check (sort_order between 1 and 5),
  alt_text text check (alt_text is null or char_length(btrim(alt_text)) <= 200),
  created_at timestamptz not null default now(),
  constraint product_screenshots_product_order_unique unique (product_id, sort_order),
  constraint product_screenshots_object_key_unique unique (object_key)
);

create index if not exists product_screenshots_product_idx on public.product_screenshots (product_id, sort_order);

alter table public.product_screenshots enable row level security;

-- Screenshot rows are readable for any product the caller may view.
drop policy if exists "Published product screenshots are public" on public.product_screenshots;
drop policy if exists "Visible product screenshots are public" on public.product_screenshots;
create policy "Visible product screenshots are public"
  on public.product_screenshots for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (p.status = 'published' or p.maker_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

revoke all on table public.product_screenshots from anon, authenticated;
grant select on public.product_screenshots to anon, authenticated;

-- Attach the submitted logo after the product row exists without opening a
-- broad client UPDATE grant on products.
create or replace function public.set_product_logo(
  p_product_id uuid,
  p_logo_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_maker uuid;
begin
  select maker_id into product_maker from public.products where id = p_product_id;
  if product_maker is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or product_maker = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_logo_path is not null
     and p_logo_path !~ ('^' || product_maker::text || '/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$') then
    raise exception 'invalid_logo_path' using errcode = '22023';
  end if;
  update public.products
  set logo_path = p_logo_path, updated_at = now()
  where id = p_product_id;
end;
$$;

revoke execute on function public.set_product_logo(uuid, text) from public, anon;
grant execute on function public.set_product_logo(uuid, text) to authenticated;

-- Replaces screenshot metadata for a product. Object files are still written by
-- the client into its own folder; this RPC only records the references.
create or replace function public.set_product_screenshots(
  p_product_id uuid,
  p_screenshots jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_maker uuid;
  product_status text;
  item jsonb;
  position integer := 0;
  seen_key text[] := '{}';
  shot_key text;
  shot_alt text;
begin
  select maker_id, status into product_maker, product_status
  from public.products where id = p_product_id;
  if product_maker is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or (product_maker = (select auth.uid()) and product_status <> 'published')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_screenshots, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_screenshots, '[]'::jsonb)) > 5 then
    raise exception 'too_many_screenshots' using errcode = 'P0001';
  end if;

  -- Replace the set atomically: validate every incoming key first, then swap.
  for item in select * from jsonb_array_elements(coalesce(p_screenshots, '[]'::jsonb)) loop
    position := position + 1;
    shot_key := btrim(coalesce(item ->> 'object_key', ''));
    -- Keys must be owner-folder uploads (`<a-uuid>/<file>.<ext>`). Non-admins
    -- may only reference their own folder; admins may reference any valid key.
    if position > 5
       or shot_key = ''
       or shot_key !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
       or (not public.is_admin() and shot_key !~ ('^' || (select auth.uid())::text || '/'))
       or shot_key = any (seen_key) then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    seen_key := seen_key || shot_key;
  end loop;

  delete from public.product_screenshots where product_id = p_product_id;

  position := 0;
  for item in select * from jsonb_array_elements(coalesce(p_screenshots, '[]'::jsonb)) loop
    position := position + 1;
    shot_key := btrim(item ->> 'object_key');
    shot_alt := nullif(btrim(coalesce(item ->> 'alt', '')), '');
    if shot_alt is not null and char_length(shot_alt) > 200 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    insert into public.product_screenshots (product_id, storage_provider, object_key, sort_order, alt_text)
    values (p_product_id, 'supabase', shot_key, position, shot_alt);
  end loop;
end;
$$;

revoke execute on function public.set_product_screenshots(uuid, jsonb) from public, anon;
grant execute on function public.set_product_screenshots(uuid, jsonb) to authenticated;

-- Admin-only edit of a product's content fields. Status, maker, counters and
-- moderation columns are intentionally NOT updatable here — those go through
-- moderate_product() which keeps the audit trail.
create or replace function public.admin_update_product(
  p_product_id uuid,
  p_name text,
  p_tagline text,
  p_description text,
  p_website_url text,
  p_category_id uuid
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
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id and is_active) then
    raise exception 'inactive_category' using errcode = 'P0001';
  end if;
  update public.products
  set name = btrim(public.normalize_fa(p_name)),
      tagline = btrim(public.normalize_fa(p_tagline)),
      description = btrim(public.normalize_fa(p_description)),
      website_url = btrim(p_website_url),
      category_id = p_category_id,
      updated_at = now()
  where id = p_product_id;
end;
$$;

revoke execute on function public.admin_update_product(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.admin_update_product(uuid, text, text, text, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Corrective pass for databases where the R2-oriented draft of this migration
-- already ran: normalise all path CHECKs to the Supabase-only shape.
-- -----------------------------------------------------------------------------
do $$
begin
  -- profiles.avatar_path
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'profiles'
      and c.conname = 'profiles_avatar_path_check'
  ) then
    alter table public.profiles drop constraint profiles_avatar_path_check;
  end if;
  alter table public.profiles add constraint profiles_avatar_path_check check (
    avatar_path is null or (
      avatar_path like id::text || '/%'
      and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
    )
  );

  -- products.logo_path
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'products'
      and c.conname = 'products_logo_path_owner'
  ) then
    alter table public.products drop constraint products_logo_path_owner;
  end if;
  alter table public.products add constraint products_logo_path_owner check (
    logo_path is null or (
      logo_path like maker_id::text || '/%'
      and logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|jpg|jpeg|webp)$'
    )
  );

  -- product_screenshots.object_key (table may already exist from the R2 draft)
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'product_screenshots'
      and c.conname = 'product_screenshots_object_key_check'
  ) then
    alter table public.product_screenshots drop constraint product_screenshots_object_key_check;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_screenshots' and column_name = 'object_key'
  ) then
    alter table public.product_screenshots
      alter column object_key type text,
      alter column storage_provider set default 'supabase';
    alter table public.product_screenshots
      add constraint product_screenshots_object_key_check check (
        char_length(btrim(object_key)) between 1 and 300
        and object_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Profile bootstrap hardening
--
-- If a trigger-time profile insert fails for any reason (invalid metadata,
-- a racing username, a bad display name), the user can still be repaired
-- safely instead of being left with no profile and no way to submit products.
-- -----------------------------------------------------------------------------
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := (select auth.uid());
  profile public.profiles%rowtype;
begin
  if user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into profile from public.profiles where id = user_id;
  if found then
    return profile;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    user_id,
    'user_' || substr(user_id::text, 1, 8),
    'کاربر'
  )
  on conflict (id) do nothing
  returning * into profile;

  if not found then
    select * into profile from public.profiles where id = user_id;
  end if;
  return profile;
end;
$$;

revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

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
exception when others then
  -- Never leave a signup without a profile; use a deterministic fallback so
  -- the user can still log in and submit products.
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user_' || substr(new.id::text, 1, 8), 'کاربر')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =============================================================================
-- Shekargah — resilient profile bootstrap
--
-- If `handle_new_user` fails for any reason (bad metadata, duplicate username,
-- invalid display name, race condition), the user can still end up with no
-- public profile. When that happens product submission, avatar/profile pages
-- and maker links all break.
--
-- This migration makes profile creation self-healing:
--   * the signup trigger falls back to a deterministic safe profile instead of
--     aborting the user insert;
--   * a new authenticated RPC, ensure_profile(), repairs a missing profile on
--     demand and is safe to call repeatedly.
-- =============================================================================

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
  -- Never leave signup without a profile; use a deterministic fallback so the
  -- user can still sign in and submit products.
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user_' || substr(new.id::text, 1, 8), 'کاربر')
  on conflict (id) do nothing;
  return new;
end;
$$;

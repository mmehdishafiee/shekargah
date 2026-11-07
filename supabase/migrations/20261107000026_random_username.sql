-- =============================================================================
-- Shekargah — random handles for new sign-ups
--
-- New accounts used to inherit the local part of their email address as the
-- username, which leaked personal information (first name, company, ...) and
-- produced handles like `mehdi.shafiee`.
--
-- From now on every new profile gets a short random alphabetic handle
-- (e.g. `kqrmtbnd`) that the member can change afterwards from
-- /settings — `profiles.username` is already updatable by its owner
-- (grant update (username, ...) on public.profiles to authenticated).
--
-- Existing profiles are left untouched.
-- =============================================================================

-- Lowercase ASCII letters only so the handle passes the profiles.username
-- check (`^[a-z0-9_]{3,30}$`) and survives URLs without escaping. `i`, `l` and
-- `o` are dropped so nobody confuses them with 1 and 0.
create or replace function public.generate_username()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz';
  candidate text;
  attempt integer;
begin
  for attempt in 1..20 loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
  end loop;

  -- Practically unreachable (23^8 ≈ 7.8e10 handles), but never fail a signup.
  return 'u' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 11);
end;
$$;

-- Internal helper only: keep it out of the PostgREST surface.
revoke execute on function public.generate_username() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  display text;
begin
  candidate := public.generate_username();

  display := btrim(public.normalize_fa(coalesce(new.raw_user_meta_data ->> 'display_name', '')));
  if char_length(display) not between 2 and 50 then
    -- A random handle is a poor display name; fall back to a neutral label.
    display := 'کاربر';
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

-- `ensure_profile()` (self-heal path) keeps its deterministic `user_<uuid>`
-- handle: it runs for accounts whose trigger already failed, and a stable
-- handle matters more than a pretty one there.
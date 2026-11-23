-- =============================================================================
-- Richer public profiles: a short bio already existed; this adds the links a
-- maker or hunter wants to share. Each value is stored as a handle/URL and is
-- validated so a profile can never carry markup or a javascript: link.
-- =============================================================================

alter table public.profiles
  add column if not exists website_url text
    check (website_url is null or (website_url ~* '^https?://[^\s]+$' and char_length(website_url) <= 200)),
  add column if not exists x_username text
    check (x_username is null or x_username ~ '^[A-Za-z0-9_]{1,15}$'),
  add column if not exists telegram_username text
    check (telegram_username is null or telegram_username ~ '^[A-Za-z0-9_]{4,32}$'),
  add column if not exists linkedin_username text
    check (linkedin_username is null or linkedin_username ~ '^[A-Za-z0-9_-]{3,100}$'),
  add column if not exists github_username text
    check (github_username is null or github_username ~ '^[A-Za-z0-9-]{1,39}$');

-- Clients may edit these on their own profile, exactly like bio.
grant update (website_url, x_username, telegram_username, linkedin_username, github_username)
  on public.profiles to authenticated;

-- Normalise the stored handles on write so lookups and links stay consistent.
create or replace function public.prepare_profile_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.x_username := nullif(ltrim(btrim(coalesce(new.x_username, '')), '@'), '');
  new.telegram_username := nullif(ltrim(btrim(coalesce(new.telegram_username, '')), '@'), '');
  new.linkedin_username := nullif(btrim(coalesce(new.linkedin_username, '')), '');
  new.github_username := nullif(btrim(coalesce(new.github_username, '')), '');
  new.website_url := nullif(btrim(coalesce(new.website_url, '')), '');
  if new.x_username is not null then new.x_username := left(new.x_username, 15); end if;
  if new.telegram_username is not null then new.telegram_username := left(new.telegram_username, 32); end if;
  if new.linkedin_username is not null then new.linkedin_username := left(new.linkedin_username, 100); end if;
  if new.github_username is not null then new.github_username := left(new.github_username, 39); end if;
  return new;
end;
$$;

drop trigger if exists profiles_prepare_links on public.profiles;
create trigger profiles_prepare_links
  before insert or update on public.profiles
  for each row execute function public.prepare_profile_links();

revoke execute on function public.prepare_profile_links() from public, anon, authenticated;

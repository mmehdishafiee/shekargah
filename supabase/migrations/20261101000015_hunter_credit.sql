-- =============================================================================
-- Shekargah — hunter vs maker credit
--
-- A product can be submitted by the person who built it (maker) or by someone
-- who merely discovered it (hunter). The credited maker may or may not have an
-- account here, so we store both an optional profile link and a free-text name.
--
-- `maker_id` keeps its original meaning: the account that owns the record
-- (used by RLS, notifications and moderation), so nothing existing breaks.
-- =============================================================================

alter table public.products
  add column if not exists credit_role text not null default 'maker'
    check (credit_role in ('maker', 'hunter')),
  add column if not exists maker_credit_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists maker_credit_name text
    check (maker_credit_name is null or char_length(btrim(maker_credit_name)) between 1 and 60),
  add column if not exists hunter_id uuid
    references public.profiles (id) on delete set null;

create index if not exists products_maker_credit_idx on public.products (maker_credit_id);
create index if not exists products_hunter_idx on public.products (hunter_id);

-- Hunter credits always point at the account that submitted the row.
create or replace function public.prepare_product_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.credit_role = 'hunter' then
    -- The submitter is the hunter unless an admin overrides it later.
    if new.hunter_id is null and (select auth.uid()) is not null then
      new.hunter_id := (select auth.uid());
    end if;
    -- A hunted product must credit somebody.
    if new.maker_credit_id is null and nullif(btrim(coalesce(new.maker_credit_name, '')), '') is null then
      new.maker_credit_name := 'ناشناس';
    end if;
  else
    new.hunter_id := null;
  end if;

  if new.maker_credit_name is not null then
    new.maker_credit_name := nullif(btrim(public.normalize_fa(new.maker_credit_name)), '');
  end if;
  return new;
end;
$$;

drop trigger if exists products_prepare_credit on public.products;
create trigger products_prepare_credit
  before insert or update of credit_role, maker_credit_id, maker_credit_name, hunter_id on public.products
  for each row execute function public.prepare_product_credit();

revoke execute on function public.prepare_product_credit() from public, anon, authenticated;

-- Submitters (and admins) set the credit for a product they own.
create or replace function public.set_product_credit(
  p_product_id uuid,
  p_credit_role text,
  p_maker_credit_username text default null,
  p_maker_credit_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := case when p_credit_role = 'hunter' then 'hunter' else 'maker' end;
  v_credit_id uuid;
  v_credit_name text := nullif(btrim(coalesce(p_maker_credit_name, '')), '');
  v_handle text := lower(btrim(coalesce(p_maker_credit_username, '')));
  product_owner uuid;
  product_status text;
begin
  select maker_id, status into product_owner, product_status
  from public.products where id = p_product_id;
  if product_owner is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or product_owner = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if char_length(v_credit_name) > 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if v_handle <> '' then
    select id into v_credit_id from public.profiles where username = v_handle limit 1;
    if v_credit_id is null then
      raise exception 'maker_not_found' using errcode = 'P0002';
    end if;
  end if;

  if v_role = 'hunter' and v_credit_id is null and v_credit_name is null then
    raise exception 'maker_credit_required' using errcode = '22023';
  end if;

  update public.products
  set credit_role = v_role,
      maker_credit_id = v_credit_id,
      maker_credit_name = case when v_credit_id is null then v_credit_name else null end,
      hunter_id = case
        when v_role = 'hunter' then coalesce(hunter_id, product_owner)
        else null
      end,
      updated_at = now()
  where id = p_product_id;
end;
$$;

revoke execute on function public.set_product_credit(uuid, text, text, text) from public, anon;
grant execute on function public.set_product_credit(uuid, text, text, text) to authenticated;

-- Hunter leaderboard: who discovered the most products the community liked.
create or replace function public.list_top_hunters(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  hunt_count bigint,
  votes_total bigint,
  rank integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with scored as (
    select
      pr.id, pr.username, pr.display_name, pr.avatar_path,
      count(p.id) as hunt_count,
      coalesce(sum(p.votes_count), 0)::bigint as votes_total
    from public.profiles pr
    join public.products p on p.hunter_id = pr.id and p.status = 'published'
    group by pr.id, pr.username, pr.display_name, pr.avatar_path
  )
  select
    s.id, s.username, s.display_name, s.avatar_path,
    s.hunt_count, s.votes_total,
    (row_number() over (order by s.votes_total desc, s.hunt_count desc, s.username))::integer as rank
  from scored s
  order by s.votes_total desc, s.hunt_count desc, s.username
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 5000);
$$;

revoke execute on function public.list_top_hunters(integer, integer) from public;
grant execute on function public.list_top_hunters(integer, integer) to anon, authenticated;

-- Counts used on profiles and the dashboard.
create or replace function public.profile_credit_counts(p_profile_id uuid)
returns table (made bigint, hunted bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.products
     where status = 'published'
       and (maker_id = p_profile_id or maker_credit_id = p_profile_id)
       and credit_role = 'maker'),
    (select count(*) from public.products
     where status = 'published' and credit_role = 'hunter' and hunter_id = p_profile_id);
$$;

revoke execute on function public.profile_credit_counts(uuid) from public;
grant execute on function public.profile_credit_counts(uuid) to anon, authenticated;
-- =============================================================================
-- Admin user management: change a member's role, and guard against removing
-- the last administrator.
-- =============================================================================

create or replace function public.admin_set_role(
  p_profile_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := case when p_role = 'admin' then 'admin' else 'user' end;
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_role = 'user' and p_profile_id = (select auth.uid()) then
    raise exception 'cannot_demote_self' using errcode = 'P0001';
  end if;

  if v_role = 'user' then
    select count(*) into admin_count from public.profiles where role = 'admin' and id <> p_profile_id;
    if admin_count = 0 then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles set role = v_role where id = p_profile_id;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

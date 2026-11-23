-- =============================================================================
-- Let a product owner manage tags after publication too.
--
-- set_product_tags() used to allow the owner only while the product was still
-- pending. Makers editing their own published product therefore hit
-- not_authorized half-way through saving (after the text fields had already
-- been updated). This mirrors the relaxation already applied to logos and
-- screenshots.
-- =============================================================================

create or replace function public.set_product_tags(
  p_product_id uuid,
  p_slugs text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_maker uuid;
  cleaned text[];
  unknown_tags text[];
begin
  select maker_id into product_maker from public.products where id = p_product_id;

  if product_maker is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if not (public.is_admin() or product_maker = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct btrim(slug)), '{}'::text[])
  into cleaned
  from unnest(coalesce(p_slugs, '{}'::text[])) as slug
  where nullif(btrim(slug), '') is not null;

  if cardinality(cleaned) > 5 then
    raise exception 'too_many_tags' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(s), '{}'::text[]) into unknown_tags
  from unnest(cleaned) as s
  where not exists (select 1 from public.tags t where t.slug = s);

  if cardinality(unknown_tags) > 0 then
    raise exception 'unknown_tag' using errcode = 'P0001';
  end if;

  delete from public.product_tags where product_id = p_product_id;

  insert into public.product_tags (product_id, tag_id)
  select p_product_id, t.id
  from public.tags t
  where t.slug = any (cleaned)
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_product_tags(uuid, text[]) from public, anon;
grant execute on function public.set_product_tags(uuid, text[]) to authenticated;
-- -----------------------------------------------------------------------------
-- A requester must be able to see their own pending edit requests (the inbox
-- view previously only covered admins and the product owner).
-- -----------------------------------------------------------------------------
create or replace function public.list_product_edit_requests(
  p_status text default 'pending'
)
returns table (
  id uuid,
  product_id uuid,
  product_slug text,
  product_name text,
  requester_id uuid,
  requester_username text,
  requester_display_name text,
  payload jsonb,
  note text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.*
  from public.product_edit_base() b
  where (
      public.is_admin()
      or b.requester_id = (select auth.uid())
      or exists (
        select 1 from public.products p
        where p.id = b.product_id and p.maker_id = (select auth.uid())
      )
    )
    and (nullif(btrim(coalesce(p_status, '')), '') is null or b.status = p_status)
  order by b.created_at desc
  limit 200;
$$;

revoke execute on function public.list_product_edit_requests(text) from public, anon;
grant execute on function public.list_product_edit_requests(text) to authenticated;

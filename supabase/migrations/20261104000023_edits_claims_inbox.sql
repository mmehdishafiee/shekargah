-- =============================================================================
-- Shekargah — maker edits, edit requests, maker claims, contact + feature inbox
--
--   * update_my_product            — a maker edits their own product
--   * product_edit_requests        — anyone proposes a change; owner/admin approves
--   * maker_claims                 — "I built this" on products with no linked maker
--   * contact_messages             — the /contact form + admin inbox
--   * feature_requests             — suggestions from the changelog page
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Makers can edit their own products directly (admins can edit anything).
-- -----------------------------------------------------------------------------
create or replace function public.update_my_product(
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
declare
  product_owner uuid;
begin
  select maker_id into product_owner from public.products where id = p_product_id;
  if product_owner is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or product_owner = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
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

revoke execute on function public.update_my_product(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.update_my_product(uuid, text, text, text, text, uuid) to authenticated;

-- Owners may now manage screenshots after publication too (was pending-only).
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
  item jsonb;
  position integer := 0;
  seen_key text[] := '{}';
  shot_key text;
  shot_alt text;
begin
  select maker_id into product_maker from public.products where id = p_product_id;
  if product_maker is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or product_maker = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_screenshots, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_screenshots, '[]'::jsonb)) > 5 then
    raise exception 'too_many_screenshots' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_screenshots, '[]'::jsonb)) loop
    position := position + 1;
    shot_key := btrim(coalesce(item ->> 'object_key', ''));
    if position > 5
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

-- -----------------------------------------------------------------------------
-- Edit requests
-- -----------------------------------------------------------------------------
create table if not exists public.product_edit_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null,
  note text check (note is null or char_length(btrim(note)) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists edit_requests_product_idx on public.product_edit_requests (product_id, created_at desc);
create index if not exists edit_requests_status_idx on public.product_edit_requests (status, created_at desc);

alter table public.product_edit_requests enable row level security;

drop policy if exists "Requesters and owners read edit requests" on public.product_edit_requests;
create policy "Requesters and owners read edit requests"
  on public.product_edit_requests for select
  to authenticated
  using (
    requester_id = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.maker_id = (select auth.uid())
    )
  );

revoke all on table public.product_edit_requests from anon, authenticated;
grant select on table public.product_edit_requests to authenticated;

create or replace function public.product_edit_base()
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
  select
    r.id, r.product_id, p.slug, p.name,
    r.requester_id, pr.username, pr.display_name,
    r.payload, r.note, r.status, r.review_note, r.created_at, r.reviewed_at
  from public.product_edit_requests r
  join public.products p on p.id = r.product_id
  join public.profiles pr on pr.id = r.requester_id;
$$;

revoke execute on function public.product_edit_base() from public, anon, authenticated;

create or replace function public.submit_product_edit_request(
  p_product_id uuid,
  p_payload jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  product_owner uuid;
  v_status text;
  item jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select maker_id, status into product_owner, v_status from public.products where id = p_product_id;
  if product_owner is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'published' then
    raise exception 'product_not_published' using errcode = 'P0001';
  end if;
  if product_owner = (select auth.uid()) and not public.is_admin() then
    raise exception 'use_direct_edit' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_payload ? 'tagline' and char_length(btrim(coalesce(p_payload ->> 'tagline', ''))) not between 10 and 120 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_payload ? 'description' and char_length(btrim(coalesce(p_payload ->> 'description', ''))) not between 30 and 3000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_payload ? 'name' and char_length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 60 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_payload ? 'screenshots' then
    if jsonb_typeof(p_payload -> 'screenshots') <> 'array' or jsonb_array_length(p_payload -> 'screenshots') > 5 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    for item in select * from jsonb_array_elements(p_payload -> 'screenshots') loop
      if btrim(coalesce(item ->> 'object_key', '')) !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$' then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
    end loop;
  end if;

  insert into public.product_edit_requests (product_id, requester_id, payload, note)
  values (p_product_id, (select auth.uid()), p_payload, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  perform public.notify_user(product_owner, 'edit_request', p_product_id, null, (select auth.uid()), null);
  return v_id;
end;
$$;

revoke execute on function public.submit_product_edit_request(uuid, jsonb, text) from public, anon;
grant execute on function public.submit_product_edit_request(uuid, jsonb, text) to authenticated;

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
  where (public.is_admin() or exists (
           select 1 from public.products p
           where p.id = b.product_id and p.maker_id = (select auth.uid())
         ))
    and (nullif(btrim(coalesce(p_status, '')), '') is null or b.status = p_status)
  order by b.created_at desc
  limit 200;
$$;

revoke execute on function public.list_product_edit_requests(text) from public, anon;
grant execute on function public.list_product_edit_requests(text) to authenticated;

create or replace function public.review_product_edit_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  product_owner uuid;
  item jsonb;
  position integer;
  shot_key text;
  shot_alt text;
begin
  select * into r from public.product_edit_requests where id = p_request_id for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  select maker_id into product_owner from public.products where id = r.product_id;
  if not (public.is_admin() or product_owner = (select auth.uid())) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if coalesce(p_approve, false) then
    update public.products
    set name = case when r.payload ? 'name' then btrim(public.normalize_fa(r.payload ->> 'name')) else name end,
        tagline = case when r.payload ? 'tagline' then btrim(public.normalize_fa(r.payload ->> 'tagline')) else tagline end,
        description = case when r.payload ? 'description' then btrim(public.normalize_fa(r.payload ->> 'description')) else description end,
        website_url = case when r.payload ? 'website_url' then btrim(r.payload ->> 'website_url') else website_url end,
        category_id = case
          when r.payload ? 'category_id' and exists (
            select 1 from public.categories c where c.id = (r.payload ->> 'category_id')::uuid and c.is_active
          ) then (r.payload ->> 'category_id')::uuid
          else category_id
        end,
        updated_at = now()
    where id = r.product_id;

    if r.payload ? 'screenshots' and jsonb_typeof(r.payload -> 'screenshots') = 'array' then
      delete from public.product_screenshots where product_id = r.product_id;
      position := 0;
      for item in select * from jsonb_array_elements(r.payload -> 'screenshots') loop
        position := position + 1;
        shot_key := btrim(item ->> 'object_key');
        shot_alt := nullif(btrim(coalesce(item ->> 'alt', '')), '');
        insert into public.product_screenshots (product_id, storage_provider, object_key, sort_order, alt_text)
        values (r.product_id, 'supabase', shot_key, position, shot_alt);
      end loop;
    end if;
  end if;

  update public.product_edit_requests
  set status = case when coalesce(p_approve, false) then 'approved' else 'rejected' end,
      reviewer_id = (select auth.uid()),
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_at = now()
  where id = p_request_id;

  if coalesce(p_approve, false) then
    perform public.notify_user(r.requester_id, 'edit_approved', r.product_id, null, (select auth.uid()), null);
  end if;
end;
$$;

revoke execute on function public.review_product_edit_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_product_edit_request(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Maker claims
-- -----------------------------------------------------------------------------
create table if not exists public.maker_claims (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  proof text check (proof is null or char_length(btrim(proof)) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists maker_claims_unique_pending
  on public.maker_claims (product_id, claimant_id) where status = 'pending';
create index if not exists maker_claims_status_idx on public.maker_claims (status, created_at desc);

alter table public.maker_claims enable row level security;

drop policy if exists "Claimants read their claims" on public.maker_claims;
create policy "Claimants read their claims"
  on public.maker_claims for select
  to authenticated
  using (claimant_id = (select auth.uid()) or (select public.is_admin()));

revoke all on table public.maker_claims from anon, authenticated;
grant select on table public.maker_claims to authenticated;

create or replace function public.submit_maker_claim(p_product_id uuid, p_proof text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_credit uuid;
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select maker_credit_id, status into v_credit, v_status from public.products where id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'published' then
    raise exception 'product_not_published' using errcode = 'P0001';
  end if;
  if v_credit is not null then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;
  insert into public.maker_claims (product_id, claimant_id, proof)
  values (p_product_id, (select auth.uid()), nullif(btrim(coalesce(p_proof, '')), ''))
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_maker_claim(uuid, text) from public, anon;
grant execute on function public.submit_maker_claim(uuid, text) to authenticated;

create or replace function public.list_maker_claims(p_status text default 'pending')
returns table (
  id uuid,
  product_id uuid,
  product_slug text,
  product_name text,
  claimant_id uuid,
  claimant_username text,
  claimant_display_name text,
  proof text,
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
  select
    c.id, c.product_id, p.slug, p.name,
    c.claimant_id, pr.username, pr.display_name,
    c.proof, c.status, c.review_note, c.created_at, c.reviewed_at
  from public.maker_claims c
  join public.products p on p.id = c.product_id
  join public.profiles pr on pr.id = c.claimant_id
  where (select public.is_admin())
    and (nullif(btrim(coalesce(p_status, '')), '') is null or c.status = p_status)
  order by c.created_at desc
  limit 200;
$$;

revoke execute on function public.list_maker_claims(text) from public, anon;
grant execute on function public.list_maker_claims(text) to authenticated;

create or replace function public.review_maker_claim(
  p_claim_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into c from public.maker_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  if coalesce(p_approve, false) then
    update public.products
    set credit_role = 'maker',
        maker_credit_id = c.claimant_id,
        maker_credit_name = null,
        updated_at = now()
    where id = c.product_id;
  end if;

  update public.maker_claims
  set status = case when coalesce(p_approve, false) then 'approved' else 'rejected' end,
      reviewer_id = (select auth.uid()),
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_at = now()
  where id = p_claim_id;

  if coalesce(p_approve, false) then
    perform public.notify_user(c.claimant_id, 'claim_approved', c.product_id, null, (select auth.uid()), null);
  end if;
end;
$$;

revoke execute on function public.review_maker_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_maker_claim(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Contact messages
-- -----------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  email text not null check (char_length(btrim(email)) between 5 and 160),
  subject text not null check (char_length(btrim(subject)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 3000),
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists "Admins read contact messages" on public.contact_messages;
create policy "Admins read contact messages"
  on public.contact_messages for select
  to authenticated
  using ((select public.is_admin()));

revoke all on table public.contact_messages from anon, authenticated;
grant select on table public.contact_messages to authenticated;

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80
     or char_length(btrim(coalesce(p_email, ''))) not between 5 and 160
     or char_length(btrim(coalesce(p_subject, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_body, ''))) not between 10 and 3000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.contact_messages (name, email, subject, body, user_id)
  values (
    btrim(p_name), btrim(p_email), btrim(public.normalize_fa(p_subject)),
    btrim(public.normalize_fa(p_body)), (select auth.uid())
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;

create or replace function public.list_contact_messages(p_status text default 'new')
returns table (
  id uuid,
  name text,
  email text,
  subject text,
  body text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.name, m.email, m.subject, m.body, m.status, m.created_at
  from public.contact_messages m
  where (select public.is_admin())
    and (nullif(btrim(coalesce(p_status, '')), '') is null or m.status = p_status)
  order by m.created_at desc
  limit 200;
$$;

revoke execute on function public.list_contact_messages(text) from public, anon;
grant execute on function public.list_contact_messages(text) to authenticated;

create or replace function public.update_contact_message_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('new', 'read', 'archived') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.contact_messages set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.update_contact_message_status(uuid, text) from public, anon;
grant execute on function public.update_contact_message_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Feature requests
-- -----------------------------------------------------------------------------
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 4 and 120),
  body text check (body is null or char_length(btrim(body)) <= 2000),
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists feature_requests_status_idx on public.feature_requests (status, created_at desc);

alter table public.feature_requests enable row level security;

drop policy if exists "Feature requests are public" on public.feature_requests;
create policy "Feature requests are public"
  on public.feature_requests for select
  to anon, authenticated
  using (true);

revoke all on table public.feature_requests from anon, authenticated;
grant select on table public.feature_requests to anon, authenticated;

create or replace function public.submit_feature_request(p_title text, p_body text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 4 and 120
     or char_length(btrim(coalesce(p_body, ''))) > 2000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.feature_requests (user_id, title, body)
  values ((select auth.uid()), btrim(public.normalize_fa(p_title)), nullif(btrim(public.normalize_fa(p_body)), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_feature_request(text, text) from public, anon;
grant execute on function public.submit_feature_request(text, text) to authenticated;

create or replace function public.list_feature_requests(p_status text default null)
returns table (
  id uuid,
  title text,
  body text,
  status text,
  author_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.title, f.body, f.status, pr.display_name, f.created_at
  from public.feature_requests f
  left join public.profiles pr on pr.id = f.user_id
  where nullif(btrim(coalesce(p_status, '')), '') is null or f.status = p_status
  order by f.created_at desc
  limit 200;
$$;

revoke execute on function public.list_feature_requests(text) from public;
grant execute on function public.list_feature_requests(text) to anon, authenticated;

create or replace function public.update_feature_request_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('new', 'planned', 'done', 'declined') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.feature_requests set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.update_feature_request_status(uuid, text) from public, anon;
grant execute on function public.update_feature_request_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- New notification kinds
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'vote', 'comment', 'review', 'approved', 'rejected', 'system',
    'follow', 'new_product', 'collection',
    'edit_request', 'edit_approved', 'claim_approved'
  ));
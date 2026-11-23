-- Raise the per-user pending submission ceiling from 3 to 3000.
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

  base := public.slugify(new.name);
  if base = '' then base := 'product'; end if;
  candidate := base;
  while exists (select 1 from public.products where slug = candidate) loop
    candidate := base || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

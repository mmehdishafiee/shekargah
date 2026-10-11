-- =============================================================================
-- Storage buckets and policies
--
-- Files are publicly readable (logos and avatars are shown to everyone), but
-- uploads are limited by the bucket to small raster images, and a user may only
-- write inside a folder named after their own user id: `<auth.uid()>/<file>`.
-- SVG is intentionally not allowed (it can carry scripts).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-logos', 'product-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp']),
  ('avatars', 'avatars', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their own uploads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('product-logos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('product-logos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
  );

create policy "Users delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('product-logos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

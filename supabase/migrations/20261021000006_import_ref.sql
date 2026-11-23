alter table public.products
  add column if not exists import_ref text unique;

create index if not exists products_import_ref_idx on public.products (import_ref) where import_ref is not null;

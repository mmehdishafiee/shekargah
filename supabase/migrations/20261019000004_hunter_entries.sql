-- =============================================================================
-- Hunter entries: log which user imported/discovered each product.
-- Later this powers a "Hunter" role or leaderboard.
-- =============================================================================

create table public.hunter_entries (
  id bigint generated always as identity primary key,
  hunter_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  source_url text not null,
  source_username text not null,
  created_at timestamptz not null default now(),
  constraint hunter_entries_product_unique unique (product_id)
);

create index hunter_entries_hunter_idx on public.hunter_entries (hunter_id, created_at desc);
create index hunter_entries_created_idx on public.hunter_entries (created_at desc);

alter table public.hunter_entries enable row level security;

create policy "Admins manage hunter entries"
  on public.hunter_entries for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.hunter_entries from anon, authenticated;
grant select on public.hunter_entries to authenticated;

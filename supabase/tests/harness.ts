import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

/**
 * Minimal emulation of the pieces of a Supabase database that our migrations
 * depend on: the `auth` and `storage` schemas, the API roles, and Supabase's
 * default privileges (which grant everything on new public tables to anon and
 * authenticated — our migrations must revoke what they do not want exposed).
 */
const SUPABASE_STUB = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid default auth.uid()
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  create function storage.extension(name text) returns text language sql immutable as $$
    select reverse(split_part(reverse(name), '.', 1))
  $$;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export type Actor = { kind: 'anon' } | { kind: 'user'; id: string }
export const ANON: Actor = { kind: 'anon' }

export async function createTestDatabase() {
  const db = await PGlite.create({ extensions: { pg_trgm } })
  await db.exec(SUPABASE_STUB)
  await db.exec('create schema if not exists extensions; grant usage on schema extensions to anon, authenticated;')

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

/** Run `fn` inside a transaction as the given API role, like PostgREST does. */
export async function as<T>(db: PGlite, actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (actor.kind === 'anon') {
      await tx.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`)
    } else {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.id])
      await tx.exec('set local role authenticated;')
    }
    return fn(tx)
  })
}

/** Create an auth user (as the platform would) and return its id. */
export async function createUser(db: PGlite, email: string, displayName?: string): Promise<Actor & { kind: 'user' }> {
  const id = randomUUID()
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify(displayName ? { display_name: displayName } : {}),
  ])
  return { kind: 'user', id }
}

/** The documented admin bootstrap: run by the database owner in the SQL editor. */
export async function promoteToAdmin(db: PGlite, email: string) {
  await db.query(
    `update public.profiles set role = 'admin' where id = (select id from auth.users where email = $1)`,
    [email],
  )
}

export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('Expected the operation to fail, but it succeeded')
}

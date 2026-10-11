# Security model

Shekargah has no server of its own: the browser talks directly to Supabase with a **public** key. Every rule that matters is therefore enforced inside PostgreSQL. The frontend's checks (route guards, form validation) are for user experience only.

## Layers

1. **Table privileges.** Migrations revoke all privileges on app tables from `anon` and `authenticated`, then grant back only what clients need, column by column. Clients can insert a product's `name`, `tagline`, `description`, `website_url`, `logo_path` and `category_id`, but never `status`, `maker_id`, `votes_count`, `published_at` or moderation columns. Users can update their own `username`, `display_name`, `bio` and `avatar_path`, but never `role`.
2. **Row level security.** Enabled on every table. Policies decide which rows each role may see or change.
3. **Triggers.** `BEFORE INSERT` triggers overwrite ownership columns with `auth.uid()`, force new products to `pending`, normalise Persian text, generate unique slugs and apply rate limits. `AFTER` triggers keep `votes_count` and `comments_count` correct.
4. **Moderation RPCs.** `moderate_product()` and `resolve_report()` are `SECURITY DEFINER` functions that check `is_admin()` first, validate the transition, record `moderated_by`/`moderated_at` (or `resolved_by`/`resolved_at`) and append to the `moderation_events` audit log.

## Rules

| Rule | Where it is enforced |
| --- | --- |
| Anonymous users only see published products and active categories | `products` / `categories` SELECT policies |
| Users see their own pending/rejected submissions; nobody else does (except admins) | `products` SELECT policy |
| New products are always `pending` and owned by the caller | column grants + `prepare_new_product` trigger + INSERT policy |
| Users cannot publish their own products | no UPDATE grant on `products`; `moderate_product` requires admin |
| Max 3 pending submissions per user | `prepare_new_product` trigger |
| One vote per user per product | `votes_user_product_unique` unique constraint |
| Votes only on published products, only as yourself | INSERT policy + `prepare_new_vote` trigger + column grant |
| Individual votes are private | `votes` SELECT policy (own rows only) |
| Comments only on published products; max 5 per minute | INSERT policy + `prepare_new_comment` trigger |
| Authors and admins can delete comments; admin deletions are logged | DELETE policy + `sync_comments_count` trigger |
| Reports are visible to the reporter and admins; one report per user per item | SELECT policy + partial unique indexes |
| Only admins manage categories, approve/reject/unpublish, resolve reports | policies using `is_admin()` + RPC checks |
| Roles cannot be changed from the client | no UPDATE grant on `profiles.role` |
| Website URLs must be `http(s)` | CHECK constraint (blocks `javascript:` links) |
| Uploads: own folder only, PNG/JPEG/WebP only, 1 MB logos / 512 KB avatars | storage policies + bucket limits |
| Logo/avatar paths must point into the owner's folder | CHECK constraints on `logo_path` / `avatar_path` |

## Administrator bootstrap

There is no way to become an admin from the app. The first admin is created by the database owner in the Supabase SQL editor (see [DEPLOYMENT.md](DEPLOYMENT.md#4-create-the-first-administrator)). Admins cannot promote other users from the UI either; the same SQL statement is used.

## Browser-side measures

- User content is rendered as React text nodes; `dangerouslySetInnerHTML` is banned by ESLint.
- External links use `rel="noopener noreferrer nofollow ugc"`.
- `public/_headers` sets a Content-Security-Policy (scripts only from the site itself; network only to `*.supabase.co`), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a restrictive permissions policy.
- SVG uploads are rejected (they can contain scripts).

## How it is verified

`supabase/tests/security.test.ts` boots a real PostgreSQL (PGlite, in WebAssembly), emulates Supabase's `auth`/`storage` schemas, API roles and **Supabase's default grants** (which give `anon`/`authenticated` everything on new tables), applies the migrations, and then acts as anonymous users, regular users and admins. Run it with:

```bash
npm run test:db
```

What the emulation does **not** cover: Supabase Storage's own enforcement of bucket size/MIME limits (done by the Storage API, not SQL) and Supabase Auth itself. After deploying, spot-check those manually (see the checklist in DEPLOYMENT.md).

## Secrets

- Only the project URL and the publishable/anon key are used by the app. Both are public by design.
- The `service_role` key and database password must never appear in the repository, `.env*` files committed to Git, Cloudflare environment variables, or chat.
- `.gitignore` excludes `.env` and `.env.*` (except `.env.example`).

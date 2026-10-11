# Deployment

Shekargah is a static site (Cloudflare Pages) talking to Supabase. Nothing else needs to run.

```
Browser ──► Cloudflare Pages (dist/: HTML, JS, CSS, fonts)
   └──────► Supabase (Postgres + RLS, Auth, Storage)  — public URL + publishable key only
```

## 1. Supabase

### Create the project

1. Sign in at https://supabase.com/dashboard and click **New project**.
2. Choose the **Free** plan, a project name (e.g. `shekargah`), a strong database password (store it in a password manager; the app never needs it) and the region closest to your users.
3. When the project is ready, open **Project Settings → API** (or **API Keys**) and note:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) or the legacy **anon** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

   Do **not** copy the `service_role`/secret key anywhere.

### Apply the migrations

The SQL lives in `supabase/migrations/` and must be applied **in filename order**.

**Option A: Dashboard (no tools needed).** Open **SQL Editor → New query**, paste the full contents of each file and click **Run**, one file at a time:

1. `20261011000001_initial_schema.sql`
2. `20261011000002_storage.sql`
3. `20261011000003_default_categories.sql`

**Option B: Supabase CLI.**

```bash
npx supabase login
npx supabase init            # once; creates supabase/config.toml, keeps the migrations folder
npx supabase link --project-ref <project-ref>
npx supabase db push         # applies pending migrations
```

The CLI asks for the database password interactively. Type it in your own terminal, never in chat.

### Configure Auth

In **Authentication → URL Configuration**:

- **Site URL:** your production URL, e.g. `https://shekargah.pages.dev` (later your custom domain).
- **Redirect URLs:** add every origin that may receive email links:
  - `http://localhost:5173/**`
  - `https://shekargah.pages.dev/**`
  - `https://*.shekargah.pages.dev/**` (preview deployments)
  - your custom domain later, e.g. `https://example.ir/**`

The app sends users to `/` after confirming their email and to `/reset-password` after a recovery link, always on the current origin, so no URL is hard-coded.

In **Authentication → Providers → Email**, keep email sign-up enabled. "Confirm email" is recommended (the app shows a "check your inbox" screen).

Optional: in **Authentication → Email Templates** translate the confirmation and recovery emails to Persian.

### Verify the setup

Run these in the SQL editor:

```sql
-- RLS must be on for every app table (all rows should say true)
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- Buckets exist with limits
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- Default categories exist
select count(*) from public.categories;
```

## 2. Local development against Supabase

```bash
cp .env.example .env.local   # then fill in the two values
npm run dev
```

`.env.local` is ignored by Git.

## 3. Cloudflare Pages

1. Push the repository to GitHub (see the GitHub section below).
2. Sign in at https://dash.cloudflare.com/ → **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorize GitHub and pick the `shekargah` repository.
4. Build settings:
   - **Framework preset:** None (or Vite)
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. **Environment variables** (Production *and* Preview):
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable/anon key
   - `VITE_REPOSITORY_URL` = `https://github.com/<you>/shekargah` (optional, shows a source link)
   - The Node version comes from `.node-version` (24). To override, set `NODE_VERSION`.
6. **Save and Deploy.**

**SPA routing.** The build contains no `404.html`, so Cloudflare Pages serves `index.html` for unknown paths and deep links such as `/products/<slug>` work on refresh. Do not add a `404.html` to `public/`.

**Preview deployments.** Every pull request and non-production branch gets its own `*.shekargah.pages.dev` URL. Remember the wildcard redirect URL in Supabase Auth.

**Security headers** come from `public/_headers`. If you move Supabase to a custom domain, add it to `img-src` and `connect-src` there.

### Verify a deployment

- The Cloudflare build log ends with `Success`.
- Open the `*.pages.dev` URL: no "حالت نمایشی" banner (that would mean the env variables are missing).
- Refresh on a nested page (e.g. `/about`). It must load, not 404.
- Sign up, confirm the email, submit a product, approve it as admin, vote, comment.

## 4. Create the first administrator

1. Sign up in the app with the email you want as admin and confirm it.
2. In Supabase **SQL Editor** run (replace the email):

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Sign out and sign in again. The account menu now shows **پنل مدیریت**.

This works only from the SQL editor (database owner). The app has no way to grant roles.

## 5. GitHub workflow

- `main` is the production branch; Cloudflare deploys it automatically.
- Work on feature branches and open pull requests; each gets a preview deployment.
- Run `npm run check` before pushing.
- Database changes ship as new migration files. Apply them to Supabase (dashboard or `npx supabase db push`) **before** merging code that depends on them.

## 6. Custom domain

Once you own a domain:

1. Cloudflare dashboard → your Pages project → **Custom domains → Set up a custom domain** and enter it (e.g. `example.ir` or `www.example.ir`).
2. If the domain's DNS is on Cloudflare, the record is created automatically. Otherwise add the CNAME record Cloudflare shows you at your registrar.
3. HTTPS certificates are issued automatically; wait until the domain shows **Active**.
4. Update Supabase **Site URL** and add `https://<your-domain>/**` to **Redirect URLs**.
5. Optionally redirect `*.pages.dev` to the custom domain with a Bulk Redirect rule.

No code change is required.

## 7. Free tier limitations

Quotas change; check https://supabase.com/pricing and https://developers.cloudflare.com/pages/platform/limits/ for current numbers.

- **Supabase Free** projects are **paused after a period of inactivity** (about a week). A paused project returns errors until you restore it from the dashboard.
- Database size, storage, egress and monthly active users are capped.
- The built-in email service is meant for testing and has a **very low hourly rate limit**. Before real launch, configure custom SMTP under **Authentication → SMTP Settings** (many providers have free tiers).
- Free projects have limited backup options (no point-in-time recovery).
- **Cloudflare Pages Free** has a monthly build limit and a concurrent build limit; static requests are unmetered.

## 8. Backup and recovery

- Schema is fully reproducible from `supabase/migrations/`.
- Back up data regularly with the CLI (requires the database password, entered locally):

  ```bash
  npx supabase db dump --linked --data-only -f backups/data-$(date +%F).sql
  npx supabase db dump --linked -f backups/schema-$(date +%F).sql
  ```

  Keep dumps outside the repository (they contain user emails) or in an encrypted store.
- Storage files (logos, avatars) are not in database dumps. Download the buckets periodically, e.g. with the Storage dashboard or an S3-compatible client using Supabase's S3 credentials.
- To restore: create a new project, apply migrations, then load the data dump with `psql` and re-upload storage files.

## Post-deploy security checklist

- [ ] Anonymous visitor cannot see a pending product's URL.
- [ ] Regular user's account menu has no admin link, and `/admin` shows "دسترسی به این بخش نداری".
- [ ] Uploading an SVG or a >1 MB logo is refused.
- [ ] Voting twice is impossible (refresh between clicks to be sure).
- [ ] `service_role` key appears nowhere in Cloudflare variables or the repository.

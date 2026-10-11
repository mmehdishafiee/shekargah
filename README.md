# Shekargah · شکارگاه

An open-source Persian product discovery platform. Makers submit Iranian startups, websites, apps, open-source projects and developer tools; moderators review them; the community votes and comments.

> **فارسی:** شکارگاه یک پلتفرم متن‌باز برای کشف محصولات تازه‌ی ایرانی است. راهنمای فارسی راه‌اندازی سرویس‌ها در [docs/SETUP-FA.md](docs/SETUP-FA.md) است.

- **Frontend:** React 19, Vite, TypeScript (strict), Tailwind CSS 4, React Router 7, TanStack Query
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row Level Security). No custom server.
- **Hosting:** Cloudflare Pages (static `dist/`)
- **Tests:** Vitest + React Testing Library; database security tests run real Postgres via PGlite

## Features

- Product feed with popular/newest sorting, search, category filters and pagination
- Product pages with maker, website, votes and comments
- Email sign-up, sign-in, sign-out, password recovery, persistent sessions
- Product submission with logo upload; new products are `pending` until a moderator approves them
- One vote per user per product, enforced by a database unique constraint
- Comments (rendered as plain text), reporting of products and comments
- Profiles with avatar and published products; private view of your own pending/rejected submissions
- Admin dashboard: approve, reject, unpublish, manage categories, review reports. Every action records the admin and a timestamp.
- Fully Persian, right-to-left UI with the Vazirmatn font and Persian digits/dates

## Quick start

Requirements: Node.js 22.12+ (24 LTS recommended) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without Supabase credentials the app runs in **demo mode**: realistic sample data that lives only in your browser (`localStorage`). Sign in with `admin@demo.shekargah` (any password) to see the admin dashboard, or `sara@demo.shekargah` as a regular user.

### Connect Supabase

1. Create a Supabase project and apply the migrations. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#1-supabase).
2. Copy `.env.example` to `.env.local` and fill in the two **public** values:

   ```bash
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key>
   ```

3. Restart `npm run dev`. The demo banner disappears when the app talks to Supabase.

Never put the `service_role` key or the database password in any `VITE_` variable: everything prefixed with `VITE_` is shipped to the browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint |
| `npm test` | All tests (UI, unit, and database security tests) |
| `npm run test:db` | Only the database/RLS tests (PGlite) |
| `npm run check` | Everything CI should run |

## Project structure

```
src/
  auth/           session context, route guards
  components/     ui primitives, layout, product components, brand
  data/           ShekargahApi interface, Supabase + demo implementations, query hooks
  lib/            validation, formatting, Persian text helpers, errors
  pages/          route screens (admin/ is lazy-loaded)
  index.css       design tokens (colors, radii, shadows) — change the brand here
supabase/
  migrations/     version-controlled SQL: schema, RLS, triggers, RPCs, storage
  tests/          PGlite-based security tests for the migrations
public/
  _headers        Cloudflare Pages security headers
docs/             deployment, security, Persian setup guide
```

The UI talks to a single `ShekargahApi` interface (`src/data/types.ts`). `supabaseApi.ts` is the production implementation; `demoApi.ts` mirrors the same rules in memory. Moving off Supabase later means writing one more implementation of that interface.

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Supabase, admin bootstrap, Cloudflare Pages, custom domain, free-tier limits, backups
- [docs/SECURITY.md](docs/SECURITY.md): the authorization model and how it is tested
- [docs/SETUP-FA.md](docs/SETUP-FA.md): راهنمای فارسی راه‌اندازی
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

Not chosen yet. Until a license is added, the code is "all rights reserved" by default even though the repository is public.

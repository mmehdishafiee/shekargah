# Contributing to Shekargah

Thanks for helping! This document explains how to work on the code.

## Setup

```bash
npm install
npm run dev        # demo mode, no Supabase needed
```

To work against a real database, create your own Supabase project (free tier is fine) and follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#1-supabase).

## Workflow

1. Create a branch from `main`: `git switch -c feat/short-description`.
2. Make your change. Keep commits small and focused.
3. Run `npm run check` (types, lint, tests, build). It must pass.
4. Open a pull request against `main` describing what changed and how you tested it. Cloudflare Pages builds a preview deployment for every pull request.

Commit messages are in English and use the imperative mood, e.g. `Add report button to comments`. Conventional prefixes (`feat:`, `fix:`, `docs:`) are welcome but not required.

## Conventions

- **Language:** all user-facing text is Persian; code, identifiers, comments and docs are English.
- **Persian text:** use ZWNJ (نیم‌فاصله) correctly (`می‌شود`, `کتاب‌ها`), Persian `ی`/`ک`, Persian punctuation `،` `؛` `؟` and «گیومه». Numbers shown to users go through `formatNumber` / `formatDate`.
- **RTL:** use logical Tailwind utilities (`ms-*`, `pe-*`, `start-*`, `text-start`, `border-s`) instead of left/right. Give user-generated text `dir="auto"`, and URLs/emails/code `dir="ltr"` or the `.ltr` class.
- **Design tokens:** colors, radii and shadows live in `src/index.css` (`@theme`). Use the semantic classes (`bg-surface`, `text-ink-muted`, `border-line`, `bg-brand-600`), not raw hex values.
- **Icons:** `lucide-react` only, stroke width 1.75 (2 for small emphasis icons).
- **No raw HTML:** `dangerouslySetInnerHTML` is blocked by ESLint. Render user content as text.
- **Data access** goes through `ShekargahApi` (`src/data/types.ts`). If you add a method, implement it in both `supabaseApi.ts` and `demoApi.ts` with the same rules.

## Database changes

- Never edit an applied migration. Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`.
- Every new table needs RLS enabled, explicit `revoke`/`grant` statements and policies.
- Add tests to `supabase/tests/security.test.ts` for every new permission rule. `npm run test:db` runs them against real Postgres (PGlite) with Supabase's roles and default grants emulated.

## Reporting security issues

Please do not open a public issue for vulnerabilities. Contact the maintainers privately first.

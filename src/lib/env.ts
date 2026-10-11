const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const env = {
  supabaseUrl: url,
  supabaseKey: key,
  repositoryUrl: (import.meta.env.VITE_REPOSITORY_URL ?? '').trim(),
  /** Without Supabase credentials the app runs on browser-only demo data. */
  isDemo: !url || !key,
} as const

// Post-build step: emit sitemap.xml (and a small SEO status file for admins).
import { generateSitemap } from './sitemap.mjs'

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!url || !key) {
  console.warn('[sitemap] Supabase env missing; writing static-only sitemap')
}

const result = await generateSitemap({ url, key, outDir: 'dist' })
console.log(`[sitemap] ${result.total} urls (${result.products} products, ${result.topics} topics, ${result.companies} companies, ${result.posts} posts)`)

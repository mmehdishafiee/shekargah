// Post-build step: emit sitemap.xml, feed.xml and llms.txt.
import { generateSitemap } from './sitemap.mjs'
import { generateFeed } from './feed.mjs'
import { generateLlms } from './llms.mjs'

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!url || !key) {
  console.warn('[seo] Supabase env missing; writing static-only sitemap, empty feed and llms.txt')
}

const sitemap = await generateSitemap({ url, key, outDir: 'dist' })
console.log(`[sitemap] ${sitemap.total} urls (${sitemap.products} products, ${sitemap.topics} topics, ${sitemap.companies} companies, ${sitemap.posts} posts)`)

const feed = await generateFeed({ url, key, outDir: 'dist' })
console.log(`[feed] ${feed.items} items`)

const llms = await generateLlms({ url, key, outDir: 'dist' })
console.log(`[llms] ${llms.pages} pages indexed`)
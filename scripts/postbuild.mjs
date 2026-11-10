// Post-build step: emit robots.txt, sitemap.xml, feed.xml and llms.txt.
import { existsSync, readFileSync } from 'node:fs'

import { generateSitemap } from './sitemap.mjs'
import { generateFeed } from './feed.mjs'
import { generateLlms } from './llms.mjs'
import { generateRobots } from './robots.mjs'
import { generateChangelog } from './changelog.mjs'
import { siteUrl } from './site.mjs'

/**
 * Vite reads `.env.local` for the client bundle, but this script runs in a plain
 * Node process. Pull the same file in so sitemap/feed/llms are complete for a
 * local build too; values already in the environment always win.
 */
function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const [, name, rawValue] = match
    if (process.env[name] !== undefined) continue
    process.env[name] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadEnvLocal()

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

if (!url || !key) {
  console.warn('[seo] Supabase env missing; writing static-only sitemap, empty feed and llms.txt')
}

console.log(`[site] ${siteUrl()}`)

const robots = await generateRobots({ outDir: 'dist' })
console.log(`[robots] ${robots.disallow} disallow rules, sitemap ${robots.sitemap}`)

const sitemap = await generateSitemap({ url, key, outDir: 'dist' })
console.log(`[sitemap] ${sitemap.total} urls (${sitemap.products} products, ${sitemap.topics} topics, ${sitemap.companies} companies, ${sitemap.posts} posts)`)

const feed = await generateFeed({ url, key, outDir: 'dist' })
console.log(`[feed] ${feed.items} items`)

const llms = await generateLlms({ url, key, outDir: 'dist' })
console.log(`[llms] ${llms.pages} pages indexed`)

const changelog = await generateChangelog({ outDir: 'dist' })
console.log(`[changelog] ${changelog.commits} commits`)


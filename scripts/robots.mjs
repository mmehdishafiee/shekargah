// Emits dist/robots.txt with the sitemap URL of the current domain, so moving
// the site to a new domain never leaves a stale `Sitemap:` line behind.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { siteUrl } from './site.mjs'

const DISALLOW = ['/admin', '/settings', '/dashboard', '/notifications', '/saved', '/feed', '/login', '/signup', '/forgot-password', '/reset-password']

export async function generateRobots({ outDir }) {
  const lines = ['User-agent: *', 'Allow: /', ...DISALLOW.map((path) => `Disallow: ${path}`), '', `Sitemap: ${siteUrl()}/sitemap.xml`, '']
  await writeFile(join(outDir, 'robots.txt'), lines.join('\n'), 'utf8')
  return { disallow: DISALLOW.length, sitemap: `${siteUrl()}/sitemap.xml` }
}
// Single source of truth for the public site URL used by build scripts.
//
// Reads `site.config.json` (committed) and lets `VITE_SITE_URL` override it so a
// preview build or a test can point the generated sitemap/feed elsewhere.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** @returns {string} e.g. "https://shekargaah.ir" (no trailing slash) */
export function siteUrl() {
  const fromEnv = (process.env.VITE_SITE_URL ?? '').trim()
  const raw = fromEnv || readConfig().siteUrl || ''
  const value = raw.trim().replace(/\/+$/, '')
  if (!value) throw new Error('siteUrl is empty: set siteUrl in site.config.json')
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/** @returns {{ siteUrl: string }} */
export function readConfig() {
  return JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'))
}

/** @param {string} url */
export function writeConfig(url) {
  const next = { ...readConfig(), siteUrl: url }
  writeFileSync(join(root, 'site.config.json'), `${JSON.stringify(next, null, 2)}\n`)
}
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

/** @returns {{ siteUrl: string, legacyHosts?: string[] }} */
export function readConfig() {
  return JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'))
}

function writeRaw(config) {
  writeFileSync(join(root, 'site.config.json'), `${JSON.stringify(config, null, 2)}\n`)
}

/** @param {string} url */
export function writeConfig(url) {
  writeRaw({ ...readConfig(), siteUrl: url })
}

/**
 * Records a host that should 301 to the canonical one.
 *
 * The list lives in `site.config.json` and is read by `functions/_middleware.ts`,
 * so a domain swap never has to touch source code. Re-adding a previously
 * removed domain to the Pages project is enough to serve it again; adding it
 * here is only for the redirect.
 *
 * @param {string} host e.g. "old.example.com"
 * @returns {string[]} the sorted list after the change
 */
export function addLegacyHost(host) {
  const config = readConfig()
  const hosts = new Set((config.legacyHosts ?? []).map((value) => String(value).trim().toLowerCase()))
  const value = String(host).trim().toLowerCase()
  if (value) hosts.add(value)
  const legacyHosts = [...hosts].sort()
  writeRaw({ ...config, legacyHosts })
  return legacyHosts
}
#!/usr/bin/env node
/**
 * Migrates the whole project to a new domain.
 *
 *   node scripts/set-domain.mjs shekargah.com
 *   node scripts/set-domain.mjs shekargah.com --remote
 *   node scripts/set-domain.mjs shekargah.com --remote --deploy
 *
 * `--remote` needs one (or both) of:
 *   CLOUDFLARE_API_TOKEN   with Zone:DNS:Edit + Pages:Edit for the account
 *   SUPABASE_ACCESS_TOKEN  an `sbp_...` personal access token
 *
 * `--deploy` rebuilds dist/ and publishes to the Pages production branch, and
 * redeploys the Telegram Worker.
 *
 * Everything that can be automated locally is automated here. Anything that
 * needs a dashboard (or a token we do not have) is printed at the end as an
 * exact, copy-pasteable step.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { siteUrl as currentSiteUrl, writeConfig } from './site.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? '36aaaa28451a891b7c046303bd2fa259'
const PAGES_PROJECT = 'shekargah'
const PAGES_DEV = `${PAGES_PROJECT}.pages.dev`
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'lxtxjgffxtgqtdrudynd'

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const positional = args.filter((arg) => !arg.startsWith('--'))
const deploy = flags.has('--deploy')
const remote = flags.has('--remote') || deploy

/* ------------------------------------------------------------------ helpers */

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function step(message) {
  console.log(`\n▸ ${message}`)
}

function ok(message) {
  console.log(`  ✓ ${message}`)
}

function warn(message) {
  console.log(`  ! ${message}`)
}

/** "Shekargah.COM/" → "shekargah.com" */
function normalizeDomain(raw) {
  const value = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '')

  if (!/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(value)) {
    fail(`«${raw}» شبیه یک دامنهٔ معتبر نیست.`) 
  }
  return value
}

function read(file) {
  return readFileSync(join(root, file), 'utf8')
}

function write(file, contents) {
  writeFileSync(join(root, file), contents)
}

function replaceInFile(file, search, replacement) {
  const before = read(file)
  if (!before.includes(search)) return false
  write(file, before.split(search).join(replacement))
  return true
}

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: 'inherit', env: process.env })
}

async function cf(path, init = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN set نشده است')
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    const detail = body.errors?.map((error) => `${error.code}: ${error.message}`).join('; ') ?? response.status
    throw new Error(detail)
  }
  return body.result
}

/* ------------------------------------------------------------------- checks */

if (positional.length === 0) {
  console.log(`
Usage: node scripts/set-domain.mjs <domain> [--remote] [--deploy]

  <domain>     دامنهٔ جدید، مثل shekargah.com
  --remote     انجام کارهای Cloudflare (DNS + Pages) و Supabase Auth با توکن
  --deploy     ساخت dist/ و انتشار روی Pages و دیپلوی مجدد Worker ربات

محیط لازم برای --remote:
  CLOUDFLARE_API_TOKEN   (Zone:DNS:Edit + Pages:Edit)
  SUPABASE_ACCESS_TOKEN  (sbp_...)

دامنهٔ فعلی: ${currentSiteUrl()}
`)
  process.exit(0)
}

const domain = normalizeDomain(positional[0])
const oldSiteUrl = currentSiteUrl()
const newSiteUrl = `https://${domain}`
const oldDomain = new URL(oldSiteUrl).hostname

if (oldDomain === domain && !flags.has('--force')) {
  fail(`دامنه همین حالا ${domain} است. برای اجرای مجدد --force بده.`)
}

console.log(`\n🔁 انتقال شکارگاه از ${oldSiteUrl} به ${newSiteUrl}\n`)

/* ------------------------------------------------------------ local changes */

step('ذخیرهٔ دامنهٔ جدید در site.config.json')
writeConfig(newSiteUrl)
ok('site.config.json → ' + newSiteUrl)

step('به‌روزرسانی Worker ربات تلگرام')
{
  const file = 'telegram-bot/wrangler.toml'
  const toml = read(file).replace(/(\nSITE_URL\s*=\s*")[^"]*(")/, `$1${newSiteUrl}$2`)
  write(file, toml)
  ok(`${file} → SITE_URL = "${newSiteUrl}"`)
}

step('به‌روزرسانی ریدایرکت ۳۰۱ دامنهٔ قدیمی')
{
  // Page Functions enforce the canonical host: Cloudflare Pages never matches a
  // hostname in `_redirects` (only paths), so the 301 has to live in a Function.
  const file = 'functions/_middleware.ts'
  const text = read(file)
  const next = text
    .replace(/const CANONICAL_HOST = '[^']*'/, `const CANONICAL_HOST = '${domain}'`)
    .replace(/const LEGACY_HOSTS = new Set\(\[[^\]]*\]\)/, `const LEGACY_HOSTS = new Set(['${oldDomain}', 'www.${oldDomain}'])`)
  write(file, next)
  ok(`${file} → ${oldDomain} ⇒ ${domain} (301)`)
  warn('دامنهٔ قدیمی باید به همین پروژهٔ Pages وصل بماند، وگرنه این ۳۰۱ اجرا نمی‌شود.')
}

step('به‌روزرسانی مستندات')
{
  const docs = ['README.md', 'docs/DEPLOYMENT.md', 'docs/GO-LIVE-FA.md', 'docs/SETUP-FA.md', 'docs/SECURITY.md', 'telegram-bot/README.md', 'CONTRIBUTING.md']
  let changed = 0
  for (const file of docs) {
    if (!existsSync(join(root, file))) continue
    if (replaceInFile(file, oldDomain, domain)) changed += 1
  }
  ok(`${changed} فایل مستندات به‌روز شد`)
}

/* ------------------------------------------------------------------- remote */

let cloudflareDone = false
let pagesDone = false
let supabaseDone = false

if (remote) {
  step('Cloudflare — zone و DNS')
  try {
    const zones = await cf(`/zones?name=${encodeURIComponent(domain)}`)
    const zone = zones?.[0]
    if (!zone) {
      warn(`دامنهٔ ${domain} در این حساب Cloudflare نیست. اول دامنه را به Cloudflare اضافه کن (nameservers) و بعد همین دستور را دوباره بزن.`)
    } else {
      ok(`zone پیدا شد: ${zone.id}`)
      const apex = domain.split('.').slice(-2).join('.')
      const recordName = domain === apex ? '@' : domain.slice(0, -(apex.length + 1))

      const existing = await cf(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(domain)}`)
      if (existing?.length) {
        await cf(`/zones/${zone.id}/dns_records/${existing[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: PAGES_DEV, proxied: true, type: 'CNAME' }),
        })
        ok(`CNAME ${domain} → ${PAGES_DEV} به‌روز شد`)
      } else {
        await cf(`/zones/${zone.id}/dns_records`, {
          method: 'POST',
          body: JSON.stringify({ type: 'CNAME', name: recordName, content: PAGES_DEV, proxied: true }),
        })
        ok(`CNAME ${domain} → ${PAGES_DEV} ساخته شد`)
      }
    }
    cloudflareDone = Boolean(zone)
  } catch (error) {
    warn(`DNS انجام نشد: ${error.message}`)
  }

  step('Cloudflare — اتصال دامنه به پروژهٔ Pages')
  try {
    const domains = await cf(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains`)
    if (domains?.some((entry) => entry.name === domain)) {
      ok(`${domain} از قبل وصل است`)
    } else {
      await cf(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains`, {
        method: 'POST',
        body: JSON.stringify({ name: domain }),
      })
      ok(`${domain} به پروژهٔ ${PAGES_PROJECT} وصل شد`)
    }
    pagesDone = true
  } catch (error) {
    warn(`اتصال Pages انجام نشد: ${error.message}`)
  }

  step('Supabase Auth — Site URL و Redirect URLs')
  try {
    const token = process.env.SUPABASE_ACCESS_TOKEN
    if (!token) throw new Error('SUPABASE_ACCESS_TOKEN set نشده است')
    const redirects = [
      `${newSiteUrl}/**`,
      `https://${PAGES_DEV}/**`,
      `https://*.${PAGES_DEV}/**`,
      `${oldSiteUrl}/**`,
      'http://localhost:5173/**',
    ]
    const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ site_url: newSiteUrl, uri_allow_list: redirects.join(',') }),
    })
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
    ok(`site_url = ${newSiteUrl}`)
    ok(`${redirects.length} redirect URL تنظیم شد`)
    supabaseDone = true
  } catch (error) {
    warn(`تنظیم Supabase انجام نشد: ${error.message}`)
  }
}

/* ------------------------------------------------------------------- deploy */

if (deploy) {
  step('ساخت خروجی با دامنهٔ جدید')
  run('npm run build')
  ok('dist/ ساخته شد — sitemap، feed، robots و index.html همه با دامنهٔ جدید')

  step('انتشار روی Cloudflare Pages (branch=main)')
  run(`npx wrangler pages deploy dist --project-name=${PAGES_PROJECT} --branch main --commit-dirty=true`)
  ok('سایت منتشر شد')

  step('دیپلوی مجدد Worker ربات')
  run('npm run deploy', join(root, 'telegram-bot'))
  ok('ربات منتشر شد')
}

/* ---------------------------------------------------------------- checklist */

const checks = []
checks.push(deploy ? '  ✓ ساخت و انتشار سایت' : '  ☐ npm run build && npx wrangler pages deploy dist --project-name=shekargah --branch main --commit-dirty=true')
checks.push(cloudflareDone ? '  ✓ DNS دامنه' : `  ☐ در Cloudflare: CNAME ${domain} → ${PAGES_DEV} (proxied)`)
checks.push(pagesDone ? '  ✓ اتصال دامنه به Pages' : `  ☐ در Pages → ${PAGES_PROJECT} → Custom domains: ${domain}`)
checks.push(supabaseDone ? '  ✓ Supabase Auth' : `  ☐ در Supabase → Authentication → URL Configuration:\n      Site URL: ${newSiteUrl}\n      Redirect URLs: ${newSiteUrl}/** , https://${PAGES_DEV}/** , https://*.${PAGES_DEV}/** , http://localhost:5173/**`)
checks.push(deploy ? '  ✓ دیپلوی ربات تلگرام' : '  ☐ دیپلوی ربات: cd telegram-bot && npm run deploy')
checks.push(`  ☐ چک نهایی: curl -sI ${newSiteUrl} | head -1  → باید 200 بدهد`)

console.log('\n──────────────────────────── خلاصه ────────────────────────────\n')
console.log(`دامنهٔ جدید: ${newSiteUrl}`)
console.log(`دامنهٔ قبلی: ${oldSiteUrl} (301 به دامنهٔ جدید)\n`)
console.log(checks.join('\n'))
console.log('\nاگر همهٔ تیک‌ها سبز شدند، دامنه کامل منتقل شده است.')
console.log('یادت باشد: پروژهٔ Pages، Supabase و Worker ربات دست‌نخورده می‌مانند؛ فقط دامنه عوض می‌شود.\n')

if (!deploy) {
  console.log('برای انجام همه‌چیز با یک دستور:')
  console.log(`  CLOUDFLARE_API_TOKEN=... SUPABASE_ACCESS_TOKEN=... node scripts/set-domain.mjs ${domain} --remote --deploy\n`)
}
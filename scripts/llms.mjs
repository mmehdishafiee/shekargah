// Generates dist/llms.txt — a compact, markdown index of the site for large
// language models (https://llmstxt.org). Built from the same public API as the
// sitemap; falls back to the static page list when the API is unreachable.

import { siteUrl } from './site.mjs'

const SITE = siteUrl()

const PAGES = [
  ['صفحه‌ی اصلی', '/', 'تازه‌ترین محصولات ایرانی با رأی کاربران.'],
  ['محصولات امروز', '/today', 'محصولاتی که امروز منتشر شده‌اند.'],
  ['جدول رتبه‌بندی', '/leaderboard', 'پررأی‌ترین محصولات روز، هفته، ماه و سال.'],
  ['داغ‌ترین‌ها', '/trending', 'محصولاتی که در روزهای اخیر بیشترین توجه را گرفته‌اند.'],
  ['موضوع‌ها', '/topics', 'همه‌ی دسته‌بندی‌ها و موضوع‌ها.'],
  ['مجموعه‌ها', '/collections', 'فهرست‌های موضوعی محصولات.'],
  ['شرکت‌ها', '/companies', 'شرکت‌هایی که محصولاتشان در شکارگاه ثبت شده.'],
  ['سازندگان', '/makers', 'سازندگان و شکارچیان برتر جامعه.'],
  ['وبلاگ', '/blog', 'نوشته‌ها درباره‌ی محصول، کشف و ساخت.'],
  ['درباره‌ی شکارگاه', '/about', 'شکارگاه چیست و چطور کار می‌کند.'],
  ['تغییرات شکارگاه', '/changelog', 'تاریخچه‌ی تغییرات و درخواست قابلیت تازه.'],
  ['راهنما', '/help', 'راهنمای استفاده، معرفی محصول و رأی دادن.'],
  ['سوالات متداول', '/faq', 'پاسخ پرسش‌های رایج.'],
  ['تماس با ما', '/contact', 'راه‌های ارتباط با تیم شکارگاه.'],
  ['حامی شکارگاه شوید', '/sponsor', 'حمایت از شکارگاه و معرفی برند شما.'],
]

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

async function rest(base, key, path) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return response.json()
}

export async function generateLlms({ url, key, outDir }) {
  const { writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const lines = [
    '# شکارگاه',
    '',
    '> شکارگاه یک پلتفرم فارسی برای کشف محصولات، استارتاپ‌ها، اپلیکیشن‌ها و پروژه‌های متن‌باز ایرانی است. کاربران محصول تازه معرفی می‌کنند، به بهترین‌ها رأی می‌دهند و هر محصول می‌تواند سازنده یا شکارچی داشته باشد.',
    '',
    '## صفحات اصلی',
    '',
  ]

  for (const [label, path, description] of PAGES) {
    lines.push(`- [${label}](${SITE}${path}): ${description}`)
  }

  if (url && key) {
    try {
      const products = await rest(
        url,
        key,
        'products?select=slug,name,tagline&status=eq.published&order=votes_count.desc&limit=100',
      )
      lines.push('', '## محصولات', '')
      for (const product of products) {
        const tagline = clean(product.tagline)
        lines.push(`- [${clean(product.name)}](${SITE}/products/${encodeURIComponent(product.slug)})${tagline ? `: ${tagline}` : ''}`)
      }
    } catch (error) {
      console.warn(`[llms] products skipped: ${error.message}`)
    }
  }

  lines.push(
    '',
    '## درباره‌ی داده‌ها',
    '',
    '- همه‌ی محصولات توسط کاربران معرفی می‌شوند و پیش از انتشار بررسی می‌شوند.',
    '- رأی‌ها و نقدها متعلق به کاربران است و در شمارش رتبه‌بندی استفاده می‌شود.',
    `- خوراک تازه‌ها: ${SITE}/feed.xml`,
    `- نقشه‌ی سایت: ${SITE}/sitemap.xml`,
    '',
  )

  await writeFile(join(outDir, 'llms.txt'), lines.join('\n'), 'utf8')
  return { pages: PAGES.length }
}
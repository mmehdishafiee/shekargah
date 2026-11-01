// Generates dist/feed.xml (RSS 2.0) from the live public API so feed readers
// can follow new products and blog posts. Runs after `vite build`; when the API
// is unreachable it still writes a valid (empty) channel.

const SITE = 'https://shekargah.mmehdi.ir'
const TITLE = 'شکارگاه'
const DESCRIPTION = 'محصولات، استارتاپ‌ها و ابزارهای تازه‌ی سازندگان ایرانی.'

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char])
}

async function rest(base, key, path) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return response.json()
}

async function rpc(base, key, fn, args = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!response.ok) throw new Error(`rpc ${fn} -> ${response.status}`)
  return response.json()
}

function toRfc822(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString()
}

function item({ title, link, description, date, guid }) {
  return [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(guid ?? link)}</guid>`,
    `      <pubDate>${toRfc822(date)}</pubDate>`,
    `      <description>${escapeXml(description)}</description>`,
    '    </item>',
  ].join('\n')
}

export async function generateFeed({ url, key, outDir }) {
  const { writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const items = []

  if (url && key) {
    try {
      const products = await rest(
        url,
        key,
        'products?select=slug,name,tagline,published_at&status=eq.published&order=published_at.desc&limit=40',
      )
      for (const product of products) {
        items.push({
          title: product.name,
          link: `${SITE}/products/${encodeURIComponent(product.slug)}`,
          description: product.tagline ?? '',
          date: product.published_at,
        })
      }
    } catch (error) {
      console.warn(`[feed] products skipped: ${error.message}`)
    }

    try {
      const posts = await rpc(url, key, 'list_posts', { p_limit: 20, p_offset: 0 })
      for (const post of posts) {
        items.push({
          title: post.title,
          link: `${SITE}/blog/${encodeURIComponent(post.slug)}`,
          description: post.excerpt ?? post.description ?? '',
          date: post.published_at,
        })
      }
    } catch (error) {
      console.warn(`[feed] posts skipped: ${error.message}`)
    }
  }

  items.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(TITLE)}</title>`,
    `    <link>${SITE}/</link>`,
    `    <description>${escapeXml(DESCRIPTION)}</description>`,
    '    <language>fa</language>',
    `    <lastBuildDate>${toRfc822(items[0]?.date)}</lastBuildDate>`,
    `    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />`,
    ...items.map(item),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  await writeFile(join(outDir, 'feed.xml'), xml, 'utf8')
  return { items: items.length }
}
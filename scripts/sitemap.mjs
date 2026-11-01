// Generates dist/sitemap.xml from the live public API so search engines get a
// real list of products, topics, companies and blog posts after every build.
//
// Runs as part of `npm run build`; if the API is unreachable it still emits the
// static routes so a transient network problem never breaks the build.

const SITE = 'https://shekargah.mmehdi.ir'

const STATIC_ROUTES = ['/', '/today', '/trending', '/leaderboard', '/topics', '/makers', '/companies', '/collections', '/blog', '/about']

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char])
}

async function rest(base, key, path) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return response.json()
}

async function fetchRpc(base, key, fn, args = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!response.ok) throw new Error(`rpc ${fn} -> ${response.status}`)
  return response.json()
}

export async function generateSitemap({ url, key, outDir }) {
  const { writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const entries = new Map()
  const add = (path, lastmod, changefreq, priority) => {
    if (!entries.has(path)) entries.set(path, { lastmod: lastmod ?? new Date().toISOString().slice(0, 10), changefreq, priority })
  }

  for (const route of STATIC_ROUTES) add(route, null, route === '/' ? 'daily' : 'weekly', route === '/' ? '1.0' : '0.7')

  let counts = { products: 0, topics: 0, companies: 0, posts: 0 }

  try {
    const products = await rest(url, key, 'products?select=slug,published_at&status=eq.published&limit=2000')
    for (const product of products) {
      add(`/products/${encodeURIComponent(product.slug)}`, product.published_at?.slice(0, 10), 'weekly', '0.8')
    }
    counts.products = products.length

    const topics = await fetchRpc(url, key, 'list_topics')
    for (const topic of topics) add(`/?category=${encodeURIComponent(topic.slug)}`, null, 'weekly', '0.6')
    counts.topics = topics.length

    const companies = await fetchRpc(url, key, 'list_companies', { p_limit: 50, p_offset: 0 })
    for (const company of companies) add(`/companies/${encodeURIComponent(company.slug)}`, null, 'weekly', '0.5')
    counts.companies = companies.length

    const posts = await fetchRpc(url, key, 'list_posts', { p_limit: 50, p_offset: 0 })
    for (const post of posts) add(`/blog/${encodeURIComponent(post.slug)}`, post.published_at?.slice(0, 10), 'monthly', '0.6')
    counts.posts = posts.length
  } catch (error) {
    console.warn(`[sitemap] partial generation: ${error.message}`)
  }

  const body = [...entries.entries()]
    .map(([path, meta]) => {
      const loc = `${SITE}${path.startsWith('/') ? path : `/${path}`}`
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${meta.lastmod}</lastmod>`,
        `    <changefreq>${meta.changefreq}</changefreq>`,
        `    <priority>${meta.priority}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  await writeFile(join(outDir, 'sitemap.xml'), xml, 'utf8')
  return { total: entries.size, ...counts }
}

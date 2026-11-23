import { useEffect } from 'react'
import { siteUrl } from './env'

const SITE = 'شکارگاه'
const DEFAULT_DESCRIPTION =
  'شکارگاه جایی برای کشف استارتاپها، اپلیکیشنها، پروژههای متنباز و ابزارهای تازهی ایرانی است.'

export const SITE_URL = siteUrl

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

/**
 * Injects JSON-LD structured data for the current page. The previous block is
 * removed first so navigating between routes never stacks stale schemas.
 */
export function setJsonLd(data: unknown, id = 'page-schema') {
  document.getElementById(id)?.remove()
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.id = id
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

export interface DocumentMeta {
  title?: string
  description?: string
  /** Path-only or absolute canonical URL for this route. */
  path?: string
  image?: string | null
  type?: 'website' | 'article' | 'product'
  /** Schema.org object describing this page. */
  schema?: unknown
  robots?: string
}

/** Updates title, description, canonical, Open Graph and structured data. */
export function useDocumentMeta(title?: string, description?: string, options: Omit<DocumentMeta, 'title' | 'description'> = {}) {
  const { path, image, type = 'website', schema, robots } = options
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | کشف محصولات تازه‌ی ایرانی`
    const desc = description ?? DEFAULT_DESCRIPTION
    const url = path ? `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}` : SITE_URL

    document.title = fullTitle
    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:type', type === 'product' ? 'website' : type)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:site_name', SITE)
    setMeta('property', 'og:locale', 'fa_IR')
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', desc)
    if (image) {
      setMeta('property', 'og:image', image)
      setMeta('name', 'twitter:image', image)
    }
    if (robots) setMeta('name', 'robots', robots)
    else document.head.querySelector('meta[name="robots"]')?.remove()

    setCanonical(url)
    if (schema) setJsonLd(schema)
    else document.getElementById('page-schema')?.remove()
  }, [title, description, path, image, type, schema, robots])
}

/** Rich-results schema for a product page. */
export function productSchema(input: {
  name: string
  description: string
  url: string
  category?: string | null
  ratingAverage?: number
  ratingCount?: number
  logo?: string | null
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: input.category ?? 'WebApplication',
    operatingSystem: 'Web',
    inLanguage: 'fa-IR',
  }
  if (input.logo) schema.image = input.logo
  if (input.ratingCount && input.ratingCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.ratingAverage ?? 0,
      reviewCount: input.ratingCount,
      bestRating: 5,
      worstRating: 1,
    }
  }
  return schema
}

/** WebSite + SearchAction schema, injected once on the home route. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE,
    url: SITE_URL,
    inLanguage: 'fa-IR',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** BlogPosting schema for a blog article. */
export function articleSchema(input: { title: string; description: string; slug: string; publishedAt: string | null; author?: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: `${SITE_URL}/blog/${encodeURIComponent(input.slug)}`,
    datePublished: input.publishedAt ?? undefined,
    inLanguage: 'fa-IR',
    author: { '@type': 'Person', name: input.author ?? SITE },
    publisher: { '@type': 'Organization', name: SITE, url: SITE_URL },
  }
}
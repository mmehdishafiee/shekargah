/** Replace Arabic code points that look like Persian letters with the Persian ones. */
export function normalizeFa(value: string): string {
  return value.replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک')
}

/** Mirrors public.slugify() in the database so demo mode produces the same slugs. */
export function slugify(value: string): string {
  return normalizeFa(value)
    .toLowerCase()
    .replace(/[^a-z0-9ء-يپچژکگی۰-۹]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** First visible letter, used for monogram logos and avatars. */
export function initial(value: string): string {
  const match = value.trim().match(/[\p{L}\p{N}]/u)
  return match ? match[0].toUpperCase() : '؟'
}

/** Deterministic 0–359 hue from a string, for monogram backgrounds. */
export function hueFor(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return hash % 360
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Referral parameters attached to the outbound "visit site" links, so makers
 * can see in their own analytics that the visit came from Shekargah.
 */
const REFERRAL_PARAMS = {
  utm_source: 'shekargaah',
  utm_medium: 'referral',
  utm_campaign: 'product_page',
}

/**
 * Add our referral parameters to an outbound URL. Existing parameters are kept
 * (including any utm_* the maker set themselves) and a `#fragment` stays at the
 * end. `content` distinguishes the individual product (its slug).
 */
export function withReferralUtm(url: string, content?: string): string {
  const hashAt = url.indexOf('#')
  const withoutHash = hashAt >= 0 ? url.slice(0, hashAt) : url
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const queryAt = withoutHash.indexOf('?')
  const base = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash
  const params = new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '')

  for (const [key, value] of Object.entries(REFERRAL_PARAMS)) {
    if (!params.has(key)) params.set(key, value)
  }
  if (content && !params.has('utm_content')) params.set('utm_content', content)

  const query = params.toString()
  return query ? `${base}?${query}${hash}` : `${base}${hash}`
}

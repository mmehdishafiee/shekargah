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

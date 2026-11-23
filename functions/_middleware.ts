/**
 * Canonical-host enforcement.
 *
 * `_redirects` can only match a *path*, never a hostname, so a host-scoped 301
 * has to live in a Pages Function — this one runs for every request on every
 * custom domain attached to the project.
 *
 * Both the canonical host and the hosts that redirect to it come from
 * `site.config.json`, the project's single source of truth for the domain. That
 * keeps adding, removing or restoring a domain a configuration change rather
 * than a source change:
 *
 *   - to **serve** the site on another host, attach it to the Pages project and
 *     leave `legacyHosts` alone;
 *   - to **301** a host to the canonical one, add it to `legacyHosts`.
 *
 * `npm run domain -- <new-domain>` maintains both entries for you.
 */
import siteConfig from '../site.config.json'

/** Turns `example.com`, `www.example.com/` or a full URL into a bare hostname. */
function hostnameOf(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase()
}

const CANONICAL_HOST = hostnameOf(siteConfig.siteUrl)

const LEGACY_HOSTS = new Set(
  ((siteConfig as { legacyHosts?: string[] }).legacyHosts ?? []).map(hostnameOf).filter(Boolean),
)

interface MiddlewareContext {
  request: Request
  next(): Promise<Response>
}

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  const url = new URL(context.request.url)

  if (LEGACY_HOSTS.has(url.hostname.toLowerCase())) {
    return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301)
  }

  return context.next()
}
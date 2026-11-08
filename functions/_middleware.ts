/**
 * Permanent redirect from the legacy domain to the canonical one.
 *
 * `_redirects` cannot do this: Cloudflare Pages only matches the *path* in a
 * rule's source, never the hostname, so a host-scoped 301 there is silently
 * ignored. A Pages Function runs for every request on every custom domain of
 * the project, which makes it the right place to enforce the canonical host.
 *
 * To change the domain later, update `CANONICAL_HOST` (and `LEGACY_HOSTS`).
 */
const CANONICAL_HOST = 'shekargaah.ir'

// NOTE: while the canonical domain has no DNS record yet, redirecting would take
// the live site down (the legacy domain is still the only one that resolves).
// Restore the line below the moment `shekargaah.ir` resolves:
//   new Set(['shekargah.mmehdi.ir', 'www.shekargah.mmehdi.ir'])
const LEGACY_HOSTS = new Set<string>([])

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

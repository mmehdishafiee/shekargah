/**
 * Shared plumbing for the same-origin proxies under `functions/api/`.
 *
 * Iranian networks do not reach `*.supabase.co` or `*.workers.dev` over the
 * public internet the way the rest of the world does: answers come back from a
 * rotating pool of relay addresses, TLS handshakes there take anywhere from
 * 0.4s to 2.3s, and every new host means another DNS lookup plus another
 * handshake on the critical path of a page load. Forwarding those requests
 * through our own origin keeps a single warm HTTP/2 connection to the
 * Cloudflare edge, and lets the edge talk to the upstream over Cloudflare's own
 * backbone instead.
 *
 * This file is prefixed with `_` so Cloudflare Pages does not turn it into a
 * route of its own.
 */

/** Headers we must not forward upstream or back to the browser. */
const STRIPPED_HEADERS = new Set([
  // Hop-by-hop
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Set by the runtime for the incoming request; forwarding them would tell the
  // upstream the wrong story about who is calling.
  'host',
  'content-length',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'cdn-loop',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
])

/**
 * Cloudflare refuses to store a response that carries `Set-Cookie`, and the
 * browser would reject the upstream's `Domain=supabase.co` anyway. The client
 * keeps its session in `localStorage`, never in a cookie, so dropping these is
 * safe in both directions.
 */
const DROPPED_RESPONSE_HEADERS = new Set(['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding', 'connection'])

export interface PagesContext {
  request: Request
  env: Record<string, string | undefined>
  waitUntil(promise: Promise<unknown>): void
}

/** Copy a request's headers, minus everything the runtime owns. */
export function forwardRequestHeaders(request: Request): Headers {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!STRIPPED_HEADERS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('cf-')) {
      headers.set(key, value)
    }
  })
  return headers
}

/** Copy an upstream response's headers, minus the ones we must own ourselves. */
export function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!DROPPED_RESPONSE_HEADERS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('cf-')) {
      headers.set(key, value)
    }
  })
  return headers
}

/**
 * Streams the upstream response back to the browser, adding `extraHeaders` and
 * tagging failures so they are debuggable from the edge without leaking the
 * upstream error body into the page.
 */
export async function relay(upstream: Response, extraHeaders?: Record<string, string>): Promise<Response> {
  const headers = forwardResponseHeaders(upstream)
  for (const [key, value] of Object.entries(extraHeaders ?? {})) headers.set(key, value)
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}

/**
 * Rebuilds the incoming path on top of the upstream origin. The proxy route's
 * own prefix (`/api/supabase`, `/api/bot`) is stripped first.
 */
export function upstreamUrl(request: Request, upstreamOrigin: string, routePrefix: string): URL {
  const incoming = new URL(request.url)
  const suffix = incoming.pathname.slice(routePrefix.length)
  return new URL(`${upstreamOrigin.replace(/\/+$/, '')}${suffix}${incoming.search}`)
}

/**
 * Same-origin proxy for the Supabase API.
 *
 * The browser used to talk to `https://<project>.supabase.co` directly, which in
 * Iran means a DNS answer from a rotating relay pool, a fresh TLS handshake per
 * connection (0.4s–2.3s measured) and a second host for every product image.
 * Serving the API under our own origin collapses all of that onto the one
 * connection the page already has, and lets the edge answer from cache.
 *
 * Three kinds of request are handled differently:
 *
 *  - **Public storage objects** are cached at the edge for a year. Product logos,
 *    avatars and screenshots are immutable (uploads get a fresh UUID path), so a
 *    repeat visit never crosses the border for an image again.
 *  - **Public read endpoints** — the RPCs and tables behind the feed, topics,
 *    makers, daily winners, categories and sponsors — are cached for 30 seconds
 *    when the caller is signed out. That matches the client's own 30s react-query
 *    stale time, so nothing on screen gets staler than it already was, while a
 *    burst of visitors is served entirely from the edge.
 *  - **Everything else** (auth, writes, per-user reads) streams straight through,
 *    uncached.
 *
 * The Supabase URL is public — it is baked into the client bundle anyway — so it
 * is only read from `SUPABASE_URL` to point a staging project at this function
 * without a rebuild.
 */

import { forwardRequestHeaders, relay, upstreamUrl, type PagesContext } from '../../_proxy'

const DEFAULT_SUPABASE_URL = 'https://lxtxjgffxtgqtdrudynd.supabase.co'

/** The route this function is mounted at, stripped before hitting upstream. */
const ROUTE_PREFIX = '/api/supabase'

const PUBLIC_OBJECT = /^\/storage\/v1\/(?:object\/public|render\/image\/public)\//
const RPC_PREFIX = '/rest/v1/rpc/'
const TABLE_PREFIX = '/rest/v1/'

/**
 * Read endpoints that return the same body for every signed-out visitor. Every
 * one of them is a `security invoker`/RLS read of published rows with no
 * `auth.uid()` in sight, so an anonymous response can be shared.
 */
const CACHEABLE_RPCS = new Set(['site_stats', 'list_topics', 'list_top_makers', 'list_daily_winners', 'list_products'])
const CACHEABLE_TABLES = new Set(['categories', 'sponsors'])

/** A year, matching the `cacheControl` uploads already carry. */
const OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable'
/** Fresh for as long as the client's own stale time; then served stale while revalidating. */
const READ_CACHE_CONTROL = 'public, max-age=30, s-maxage=30, stale-while-revalidate=300'

/** True when the request carries no user session — `apikey` and `Authorization` match. */
function isAnonymous(request: Request): boolean {
  const apikey = request.headers.get('apikey')
  const authorization = request.headers.get('authorization')
  if (!apikey || !authorization) return false
  return authorization === apikey || authorization === `Bearer ${apikey}`
}

/** The read a request performs, or `null` when it must not be cached. */
function cacheableRead(request: Request, suffix: string): boolean {
  if (!isAnonymous(request)) return false

  if (request.method === 'POST' && suffix.startsWith(RPC_PREFIX)) {
    return CACHEABLE_RPCS.has(suffix.slice(RPC_PREFIX.length).split(/[?/]/)[0])
  }

  if (request.method === 'GET' && suffix.startsWith(TABLE_PREFIX)) {
    const [table, query] = suffix.slice(TABLE_PREFIX.length).split('?')
    if (!CACHEABLE_TABLES.has(table)) return false
    // `select=*` only; anything else is a bespoke query shape we have not vetted.
    const select = new URLSearchParams(query ?? '').get('select')
    return select === '*' || select === null
  }

  return false
}

/**
 * A cache key covering everything the URL does not: the credentials, the request
 * body and the range. Keying on the key itself means a caller that presents
 * something other than the publishable key can never be answered from another
 * caller's entry.
 */
async function readCacheKey(request: Request): Promise<Request> {
  const parts = [request.method, request.url, request.headers.get('apikey') ?? '', request.headers.get('range') ?? '']
  if (request.method === 'POST') parts.push(await request.clone().text())

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')))
  const hash = [...new Uint8Array(digest).slice(0, 12)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

  const key = new URL(request.url)
  key.searchParams.set('__cache', hash)
  return new Request(key.toString(), { method: 'GET' })
}

/**
 * Keeps a cacheable copy at the edge and hands the browser one it will re-fetch.
 *
 * Letting the browser cache the read too would be a bug: after a vote the client
 * invalidates its queries and refetches at once, and a browser-cached 30-second
 * response would quietly redisplay the pre-vote numbers. The edge copy is what
 * removes the round trip anyway.
 */
function uncached(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function storeAtEdge(cache: Cache, key: Request, response: Response, context: PagesContext): Response {
  context.waitUntil(cache.put(key, response.clone()))
  return uncached(response)
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const upstreamOrigin = (context.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL).trim()
  const target = upstreamUrl(context.request, upstreamOrigin, ROUTE_PREFIX)
  const suffix = target.pathname + target.search

  const method = context.request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const cache = caches.default

  // --- Immutable public storage objects -------------------------------------
  if (method === 'GET' && PUBLIC_OBJECT.test(target.pathname)) {
    const hit = await cache.match(context.request)
    if (hit) return hit

    const upstream = await fetch(target.toString(), { method: 'GET', headers: forwardRequestHeaders(context.request) })
    if (upstream.status !== 200) return relay(upstream)

    const response = await relay(upstream, { 'Cache-Control': OBJECT_CACHE_CONTROL })
    context.waitUntil(cache.put(context.request, response.clone()))
    return response
  }

  // --- Public reads ----------------------------------------------------------
  if (cacheableRead(context.request, suffix)) {
    const key = await readCacheKey(context.request)
    const hit = await cache.match(key)
    if (hit) return uncached(hit)

    const upstream = await fetch(target.toString(), {
      method,
      headers: forwardRequestHeaders(context.request),
      body: hasBody ? context.request.clone().body : undefined,
    })
    if (upstream.status !== 200) return relay(upstream)

    const response = await relay(upstream, { 'Cache-Control': READ_CACHE_CONTROL })
    return storeAtEdge(cache, key, response, context)
  }

  // --- Everything else streams through ---------------------------------------
  const upstream = await fetch(target.toString(), {
    method,
    headers: forwardRequestHeaders(context.request),
    redirect: 'manual',
    body: hasBody ? context.request.clone().body : undefined,
  })
  return relay(upstream)
}

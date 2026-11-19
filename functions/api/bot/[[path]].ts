/**
 * Same-origin proxy for the Telegram login worker.
 *
 * The worker lives on `*.workers.dev`, a hostname Iranian networks handle no
 * better than `*.supabase.co` — and one many users cannot reach at all. Routing
 * the single `/auth/exchange` call through our own origin means the login button
 * works wherever the site itself works.
 *
 * Unlike the Supabase proxy there is nothing to cache here: every request is a
 * one-shot credential exchange.
 */

import { forwardRequestHeaders, relay, upstreamUrl, type PagesContext } from '../../_proxy'

const DEFAULT_BOT_URL = 'https://shekargah-bot.lumg.workers.dev'

/** The route this function is mounted at, stripped before hitting upstream. */
const ROUTE_PREFIX = '/api/bot'

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const upstreamOrigin = (context.env.TELEGRAM_BOT_URL ?? DEFAULT_BOT_URL).trim()
  const target = upstreamUrl(context.request, upstreamOrigin, ROUTE_PREFIX)

  const method = context.request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'

  const upstream = await fetch(target.toString(), {
    method,
    headers: forwardRequestHeaders(context.request),
    body: hasBody ? context.request.clone().body : undefined,
  })

  return relay(upstream, { 'Cache-Control': 'no-store' })
}

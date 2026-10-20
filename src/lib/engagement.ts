import type { LeaderboardPeriod } from '@/data/types'

const DAY_MS = 24 * 60 * 60 * 1000
export const TRENDING_WINDOW_MS = 48 * 60 * 60 * 1000

/** Start of a Tehran calendar day in UTC milliseconds. */
export function tehranDayStart(now: Date = new Date()): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return new Date(`${date}T00:00:00+03:30`)
}

export function tehranDateLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function leaderboardWindowStart(period: LeaderboardPeriod, now: Date = new Date()): Date {
  const start = tehranDayStart(now)
  return period === 'weekly' ? new Date(start.getTime() - 6 * DAY_MS) : start
}

/** True when `timestamp` falls on the given Tehran calendar day. */
export function isOnTehranDay(timestamp: string, date: string): boolean {
  return tehranDateLabel(new Date(timestamp)) === date
}

const VIEWER_KEY_STORAGE = 'shekargah:viewer:v1'

/** Stable client id used for view de-duplication, like a lightweight session. */
export function viewerKey(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    const existing = window.localStorage.getItem(VIEWER_KEY_STORAGE)
    if (existing && existing.length >= 8) return existing
    const next = crypto.randomUUID()
    window.localStorage.setItem(VIEWER_KEY_STORAGE, next)
    return next
  } catch {
    return 'anonymous'
  }
}

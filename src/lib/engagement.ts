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

/** How many days each leaderboard period covers, counted back from its anchor day. */
export const LEADERBOARD_DAYS: Record<LeaderboardPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
}

/**
 * The half-open Tehran-time window a leaderboard period covers. The window
 * *ends* on `anchor` (default: today in Tehran), so `/leaderboard/daily/2026-10-30`
 * covers exactly that day and `/leaderboard/weekly/2026-10-30` the seven days
 * leading up to it.
 */
export function leaderboardWindow(
  period: LeaderboardPeriod,
  anchor?: string | null,
  now: Date = new Date(),
): { startDay: string; endDay: string; startIso: string; endIso: string } {
  const endDay = anchor ?? tehranDateLabel(now)
  const endStart = new Date(`${endDay}T00:00:00+03:30`)
  const start = new Date(endStart.getTime() - (LEADERBOARD_DAYS[period] - 1) * DAY_MS)
  const end = new Date(endStart.getTime() + DAY_MS)
  return {
    startDay: tehranDateLabel(start),
    endDay,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
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

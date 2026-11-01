const numberFormat = new Intl.NumberFormat('fa-IR')
const dateFormat = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })
const relativeFormat = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return 'همین حالا'
}

const dayFormat = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const shortDayFormat = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })

/** Calendar-day label in the Persian (Jalali) calendar, e.g. «جمعه ۸ آبان ۱۴۰۵». */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/** Same as formatDay but without the weekday. */
export function formatShortDay(iso: string): string {
  return shortDayFormat.format(new Date(iso))
}

/**
 * Formats a plain `yyyy-mm-dd` string (as used by query params and the RPC
 * dates) into a Jalali label. Never shows a Gregorian date to the user.
 */
export function formatIsoDay(isoDate: string): string {
  return dayFormat.format(new Date(`${isoDate}T12:00:00+03:30`))
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} مگابایت`
  return `${formatNumber(Math.round(bytes / 1024))} کیلوبایت`
}

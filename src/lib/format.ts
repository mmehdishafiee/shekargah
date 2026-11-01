const numberFormat = new Intl.NumberFormat('fa-IR')
const partFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const dateOnlyFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const relativeFormat = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

function parts(date: Date, formatter: Intl.DateTimeFormat) {
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
}

/** Persian (Jalali) date in the natural reading order: «یکشنبه ۱۰ آبان ۱۴۰۵». */
function persianDate(date: Date, withWeekday: boolean): string {
  const value = parts(date, withWeekday ? partFormat : dateOnlyFormat)
  const head = withWeekday && value.weekday ? `${value.weekday} ` : ''
  return `${head}${value.day} ${value.month} ${value.year}`
}

export function formatDate(iso: string): string {
  return persianDate(new Date(iso), false)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return `${persianDate(date, false)}، ساعت ${timeFormat.format(date)}`
}

/** Calendar-day label in the Persian calendar, e.g. «جمعه ۸ آبان ۱۴۰۵». */
export function formatDay(iso: string): string {
  return persianDate(new Date(iso), true)
}

export function formatShortDay(iso: string): string {
  return persianDate(new Date(iso), false)
}

/**
 * Formats a plain `yyyy-mm-dd` string (as used by query params and RPC dates)
 * into a Jalali label. Never shows a Gregorian date to the user.
 */
export function formatIsoDay(isoDate: string): string {
  return persianDate(new Date(`${isoDate}T12:00:00+03:30`), true)
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

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} مگابایت`
  return `${formatNumber(Math.round(bytes / 1024))} کیلوبایت`
}

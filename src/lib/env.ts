import siteConfig from '../../site.config.json'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** یک دامنه را به شکل «https://host» نرمال میکند. */
export function normalizeSiteUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, '')
  if (!value) return value
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/**
 * نشانی عمومی سایت. تک‌منبع حقیقت `site.config.json` است؛
 * `VITE_SITE_URL` آن را برای پیش‌نمایش یا تست بازنویسی می‌کند.
 */
export const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL ?? siteConfig.siteUrl)

const telegramBotUrl = (import.meta.env.VITE_TELEGRAM_BOT_URL ?? '').trim().replace(/\/+$/, '')

/**
 * نشانیهای بیرونی را در نسخهی نهایی به مسیر هممبدأ برمیگرداند.
 *
 * شبکهی ایران درخواستهای مستقیم به `*.supabase.co` و `*.workers.dev` را از
 * مسیرهای واسطِ کند و پرنوسان عبور میدهد؛ هر میزبان جدا یعنی یک جستوجوی DNS و
 * یک دستدادن TLS تازه روی مسیر بحرانی بارگذاری صفحه. با پروکسی هممبدأ
 * (`functions/api/`) مرورگر فقط با همان اتصال گرمی حرف میزند که صفحه را آورده،
 * و لبهی کلادفلر خودش از طریق شبکهی خودش با سرور بالادست حرف میزند.
 *
 * با `VITE_SUPABASE_PROXY=off` میشود این رفتار را خاموش کرد.
 */
function sameOrigin(path: string, direct: string): string {
  const proxyPath = (import.meta.env.VITE_SUPABASE_PROXY_PATH ?? path).trim()
  const enabled =
    import.meta.env.PROD && import.meta.env.VITE_SUPABASE_PROXY !== 'off' && typeof window !== 'undefined'
  return enabled ? new URL(proxyPath, window.location.origin).href : direct
}

/**
 * کلید `localStorage` نشست، که Supabase آن را از روی میزبانِ نشانی کلاینت میسازد.
 *
 * حالا که نسخهی نهایی با دامنهی خودمان حرف میزند، کلید مشتقشده عوض میشد و
 * همهی کاربرانِ واردشده بیصدا از حساب خارج میشدند. با تثبیت همان کلیدی که
 * نشانی مستقیم پروژه میساخت، نشستها از این تغییر جان سالم به در میبرند.
 */
function sessionStorageKey(direct: string): string | undefined {
  try {
    return `sb-${new URL(direct).hostname.split('.')[0]}-auth-token`
  } catch {
    return undefined
  }
}

export const env = {
  supabaseUrl: sameOrigin('/api/supabase', url),
  supabaseKey: key,
  supabaseSessionKey: sessionStorageKey(url),
  siteUrl,
  repositoryUrl: (import.meta.env.VITE_REPOSITORY_URL ?? '').trim(),
  /** آدرس Worker ربات تلگرام (ورود با تلگرام). خالی = این روش ورود پنهان است. */
  telegramBotUrl: telegramBotUrl ? sameOrigin('/api/bot', telegramBotUrl) : '',
  /** نام کاربری ربات بدون @ */
  telegramBotUsername: (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, ''),
  isConfigured: Boolean(url && key),
} as const

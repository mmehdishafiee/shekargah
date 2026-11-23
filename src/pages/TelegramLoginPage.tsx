import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Send } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { env } from '@/lib/env'
import { errorMessage } from '@/lib/errors'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Logo } from '@/components/brand/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Notice, PageLoader, Spinner } from '@/components/ui/Feedback'
import { buttonClass, cardClass, inputClass } from '@/components/ui/styles'
import { useToast } from '@/components/ui/toast'

/** استخراج کد از ورودی کاربر (کد خالی، یا لینک کامل). */
function extractCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const match = /[?&]code=([^&\s]+)/.exec(trimmed)
  if (match?.[1]) return decodeURIComponent(match[1])

  return trimmed.replace(/^code:/i, '')
}

const botLink = env.telegramBotUsername ? `https://t.me/${env.telegramBotUsername}?start=login` : null

/**
 * ورود با تلگرام.
 *
 * دو حالت دارد:
 *   * `?code=…` از دکمه‌ی ربات → کد را با worker عوض می‌کند و وارد می‌شود
 *   * بدون کد → راهنما + امکان چسباندن لینک/کد
 */
export function TelegramLoginPage() {
  useDocumentMeta('ورود با تلگرام', undefined, { path: '/login/telegram', robots: 'noindex' })
  const api = useApi()
  const navigate = useNavigate()
  const toast = useToast()
  const { session, loading } = useAuth()
  const [params] = useSearchParams()

  const code = params.get('code') ?? ''
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'done'>(code ? 'checking' : 'idle')
  const [error, setError] = useState<unknown>(null)
  const [manual, setManual] = useState('')
  const started = useRef(false)

  const exchange = async (value: string) => {
    const candidate = extractCode(value)
    if (!candidate) {
      setError(new Error('empty code'))
      setStatus('error')
      return
    }

    setStatus('checking')
    setError(null)

    try {
      await api.signInWithTelegram(candidate)
      setStatus('done')
      toast.success('خوش آمدی!')
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught)
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!code || started.current) return
    started.current = true
    void exchange(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once per code
  }, [code])

  if (loading) return <PageLoader />

  const submitManual = (event: FormEvent) => {
    event.preventDefault()
    void exchange(manual)
  }

  const openBot = botLink

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <div className="mb-6 text-center">
        <Link to="/" className="inline-flex rounded-lg" aria-label="شکارگاه">
          <Logo />
        </Link>
      </div>

      <div className={`${cardClass} p-6 sm:p-8`}>
        <h1 className="text-xl font-extrabold">ورود با تلگرام</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-muted">
          حساب تلگرامت به حساب شکارگاه وصل می‌شود؛ بدون رمز و بدون ایمیل.
        </p>

        {status === 'checking' && (
          <div className="mt-6 flex items-center gap-3 text-sm text-ink-muted">
            <Spinner size={18} />
            در حال بررسی کد ورود…
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 space-y-3">
            <Notice tone="danger" title="ورود انجام نشد">
              {typeof error === 'object' && error !== null && 'code' in error && error.code === 'invalid_input'
                ? 'این لینک منقضی شده یا قبلاً استفاده شده است. یک لینک تازه از ربات بگیر.'
                : errorMessage(error)}
            </Notice>
            {openBot && (
              <a href={openBot} className={buttonClass('secondary', 'md', 'w-full')}>
                <Send size={16} aria-hidden />
                گرفتن لینک تازه از ربات
              </a>
            )}
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <div className="mt-6 space-y-4">
            {openBot ? (
              <a href={openBot} className={buttonClass('primary', 'md', 'w-full')}>
                <Send size={16} aria-hidden />
                باز کردن ربات تلگرام
              </a>
            ) : (
              <Notice tone="warning" title="ربات تنظیم نشده">
                آدرس ربات تلگرام در تنظیمات سایت نیست.
              </Notice>
            )}

            <p className="text-[13px] leading-6 text-ink-muted">
              در ربات دکمه‌ی «🔐 ورود به سایت با تلگرام» را بزن؛ به سایت برمی‌گردی و خودکار وارد می‌شوی.
            </p>

            <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              یا کد ورود را بچسبان
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={submitManual} className="space-y-3">
              <input
                className={inputClass}
                dir="ltr"
                placeholder="کد یا لینک ورود"
                value={manual}
                onChange={(event) => setManual(event.target.value)}
              />
              <Button type="submit" variant="secondary" className="w-full" disabled={!manual.trim()}>
                ورود
              </Button>
            </form>
          </div>
        )}

        {status === 'done' && session && (
          <div className="mt-6">
            <Notice tone="success" title="وارد شدی">
              حالا می‌توانی رأی بدهی و محصول معرفی کنی.
            </Notice>
            <ButtonLink to="/" className="mt-4 w-full">
              رفتن به خانه
            </ButtonLink>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          بازگشت به صفحه‌ی ورود
        </Link>
      </p>
    </div>
  )
}
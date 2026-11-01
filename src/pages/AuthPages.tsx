import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Check, MailCheck } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { errorMessage } from '@/lib/errors'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { compact, hasErrors, validateDisplayName, validateEmail, validatePassword } from '@/lib/validation'
import { Logo } from '@/components/brand/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

const PERKS = [
  'هر روز محصول تازه‌ی سازندگان ایرانی را ببین',
  'به بهترین‌ها رأی بده و نظر بنویس',
  'محصول خودت را معرفی کن، به‌عنوان سازنده یا شکارچی',
]

/** Shared shell for every auth screen: brand story on one side, form on the other. */
function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-8 py-6 sm:py-10 lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden lg:block">
        <div className="relative overflow-hidden rounded-card border border-line bg-linear-to-br from-brand-100 via-brand-50 to-surface p-8">
          <Link to="/" className="inline-flex rounded-lg" aria-label="شکارگاه">
            <Logo />
          </Link>
          <h2 className="mt-8 text-[26px] font-extrabold leading-snug">
            محصول‌های تازه‌ی ایرانی را کشف کن، رأی بده و خودت هم معرفی کن.
          </h2>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-ink-muted">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <Check size={16} strokeWidth={2.25} className="mt-1.5 shrink-0 text-brand-700" aria-hidden />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-7 text-center lg:hidden">
          <Link to="/" className="inline-flex rounded-lg" aria-label="شکارگاه">
            <Logo />
          </Link>
        </div>

        <div className={`${cardClass} p-6 sm:p-8`}>
          <h1 className="text-xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-6 text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  )
}

const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-1.96c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  )
}

/** Social sign-in buttons, shown above the email form on the login screen. */
function OAuthButtons({ onPick, busy }: { onPick: (provider: 'google' | 'github') => void; busy: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button type="button" variant="secondary" loading={busy} icon={<GoogleIcon />} onClick={() => onPick('google')}>
          ورود با گوگل
        </Button>
        <Button type="button" variant="secondary" loading={busy} icon={<GitHubIcon />} onClick={() => onPick('github')}>
          ورود با گیت‌هاب
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        یا با ایمیل
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  )
}

function useRedirectTarget() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function LoginPage() {
  useDocumentMeta('ورود', 'به شکارگاه وارد شو تا رأی بدهی، نقد بنویسی و محصول معرفی کنی.', { path: '/login' })
  const api = useApi()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PageLoader />
  if (session && !busy) return <Navigate to={target} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = compact({ email: validateEmail(email), password: password ? undefined : 'رمز عبور را وارد کنید.' })
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      await api.signIn({ email, password })
      toast.success('خوش آمدی!')
      navigate(target, { replace: true })
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  const submitOAuth = async (provider: 'google' | 'github') => {
    setBusy(true)
    setError(null)
    try {
      sessionStorage.setItem('shekargah:auth-target', target)
      await api.signInWithOAuth(provider, `${window.location.origin}/`)
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="ورود به شکارگاه"
      subtitle="برای رأی دادن، نوشتن نقد و معرفی محصول وارد حسابت شو."
      footer={
        <>
          حساب نداری؟{' '}
          <Link to="/signup" state={{ from: target }} className={linkClass}>
            ثبت‌نام کن
          </Link>
        </>
      }
    >
      <OAuthButtons onPick={submitOAuth} busy={busy} />

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="ایمیل" error={errors.email}>
          {(props) => (
            <TextInput {...props} type="email" dir="ltr" className="text-start" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          )}
        </Field>
        <Field label="رمز عبور" error={errors.password}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              dir="ltr"
              className="text-start"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[13px] text-ink-muted hover:text-ink">
            رمزت را فراموش کرده‌ای؟
          </Link>
        </div>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ورود
        </Button>
      </form>
    </AuthShell>
  )
}

export function SignupPage() {
  useDocumentMeta('ثبت‌نام', 'حساب شکارگاه بساز و محصولت را معرفی کن یا محصول‌های تازه را شکار کن.', { path: '/signup' })
  const api = useApi()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const toast = useToast()
  const [values, setValues] = useState({ displayName: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)

  if (loading) return <PageLoader />
  if (session && !busy) return <Navigate to={target} replace />

  if (confirmationSentTo) {
    return (
      <AuthShell title="ایمیلت را تأیید کن">
        <div className="flex gap-3 text-sm leading-7">
          <MailCheck size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success-700" aria-hidden />
          <p>
            لینک تأیید به <bdi className="ltr font-semibold">{confirmationSentTo}</bdi> فرستاده شد. بعد از باز کردن لینک می‌توانی وارد شوی.
            اگر ایمیل را نمی‌بینی، پوشه‌ی هرزنامه را هم نگاه کن.
          </p>
        </div>
        <ButtonLink to="/login" variant="secondary" className="mt-6 w-full">
          رفتن به صفحه‌ی ورود
        </ButtonLink>
      </AuthShell>
    )
  }

  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = compact({
      displayName: validateDisplayName(values.displayName),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    })
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      const { needsConfirmation } = await api.signUp(values)
      if (needsConfirmation) {
        setConfirmationSentTo(values.email.trim())
        setBusy(false)
      } else {
        toast.success('حسابت ساخته شد. خوش آمدی!')
        navigate(target, { replace: true })
      }
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  const submitOAuth = async (provider: 'google' | 'github') => {
    setBusy(true)
    setError(null)
    try {
      sessionStorage.setItem('shekargah:auth-target', target)
      await api.signInWithOAuth(provider, `${window.location.origin}/`)
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="ساخت حساب"
      subtitle="با حساب شکارگاه می‌توانی محصول معرفی کنی، محصول کشف کنی و رأی بدهی."
      footer={
        <>
          حساب داری؟{' '}
          <Link to="/login" state={{ from: target }} className={linkClass}>
            وارد شو
          </Link>
        </>
      }
    >
      <OAuthButtons onPick={submitOAuth} busy={busy} />

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="نام نمایشی" hint="این نام کنار محصولات و نقدهایت دیده می‌شود." error={errors.displayName}>
          {(props) => (
            <TextInput {...props} dir="auto" autoComplete="name" value={values.displayName} onChange={(event) => set('displayName', event.target.value)} />
          )}
        </Field>
        <Field label="ایمیل" error={errors.email}>
          {(props) => (
            <TextInput {...props} type="email" dir="ltr" className="text-start" autoComplete="email" value={values.email} onChange={(event) => set('email', event.target.value)} />
          )}
        </Field>
        <Field label="رمز عبور" hint="دست‌کم ۸ نویسه." error={errors.password}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              dir="ltr"
              className="text-start"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
            />
          )}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ساخت حساب
        </Button>
        <p className="text-center text-[12px] leading-6 text-ink-faint">
          با ساخت حساب، <Link to="/about" className={linkClass}>قوانین شکارگاه</Link> را می‌پذیری.
        </p>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  useDocumentMeta('بازیابی رمز عبور', undefined, { path: '/forgot-password', robots: 'noindex' })
  const api = useApi()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateEmail(email)
    setFieldError(found)
    if (found) return
    setBusy(true)
    setError(null)
    try {
      await api.requestPasswordReset(email)
      setSent(true)
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="بازیابی رمز عبور"
      subtitle="ایمیل حسابت را وارد کن تا لینک انتخاب رمز تازه برایت فرستاده شود."
      footer={
        <Link to="/login" className={linkClass}>
          بازگشت به ورود
        </Link>
      }
    >
      {sent ? (
        <Notice tone="success" title="درخواست ثبت شد">
          اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی تا چند دقیقه‌ی دیگر می‌رسد.
        </Notice>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="ایمیل" error={fieldError}>
            {(props) => <TextInput {...props} type="email" dir="ltr" className="text-start" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
          </Field>
          {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
          <Button type="submit" loading={busy} className="w-full">
            ارسال لینک بازیابی
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  useDocumentMeta('انتخاب رمز تازه', undefined, { path: '/reset-password', robots: 'noindex' })
  const api = useApi()
  const { session, loading, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PageLoader />
  if (!session) {
    return (
      <AuthShell title="لینک بازیابی معتبر نیست">
        <p className="text-sm leading-7 text-ink-muted">این لینک منقضی شده یا قبلاً استفاده شده است. یک لینک تازه درخواست کن.</p>
        <ButtonLink to="/forgot-password" className="mt-6 w-full">
          درخواست لینک تازه
        </ButtonLink>
      </AuthShell>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = compact({
      password: validatePassword(password),
      repeat: password === repeat ? undefined : 'تکرار رمز با رمز اصلی یکی نیست.',
    })
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      await api.updatePassword(password)
      clearPasswordRecovery()
      toast.success('رمز عبورت تغییر کرد.')
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  return (
    <AuthShell title="انتخاب رمز تازه">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="رمز تازه" hint="دست‌کم ۸ نویسه." error={errors.password}>
          {(props) => (
            <TextInput {...props} type="password" dir="ltr" className="text-start" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          )}
        </Field>
        <Field label="تکرار رمز تازه" error={errors.repeat}>
          {(props) => (
            <TextInput {...props} type="password" dir="ltr" className="text-start" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />
          )}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ذخیره‌ی رمز تازه
        </Button>
      </form>
    </AuthShell>
  )
}

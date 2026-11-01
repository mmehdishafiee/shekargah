import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { MailCheck } from 'lucide-react'
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

/** Shared shell for every auth screen: centred card, brand mark, quiet footer. */
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
    <div className="mx-auto flex w-full max-w-[26rem] flex-col py-6 sm:py-12">
      <div className="mb-7 text-center">
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
  )
}

const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline'

/** Social sign-in buttons, shown above the email form on the login screen. */
function OAuthButtons({ onPick, busy }: { onPick: (provider: 'google' | 'github') => void; busy: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" loading={busy} onClick={() => onPick('google')}>
          ورود با گوگل
        </Button>
        <Button type="button" variant="secondary" loading={busy} onClick={() => onPick('github')}>
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

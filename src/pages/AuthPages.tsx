import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { MailCheck } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL } from '@/data/demoSeed'
import { errorMessage } from '@/lib/errors'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { compact, hasErrors, validateDisplayName, validateEmail, validatePassword } from '@/lib/validation'
import { LogoMark } from '@/components/brand/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[26rem] py-4 sm:py-8">
      <div className={`${cardClass} p-6 sm:p-8`}>
        <LogoMark size={40} />
        <h1 className="mt-5 text-xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-5 text-center text-sm text-ink-muted">{footer}</p>}
    </div>
  )
}

const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline'

function useRedirectTarget() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function LoginPage() {
  useDocumentMeta('ورود')
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

  return (
    <AuthCard
      title="ورود به شکارگاه"
      subtitle="برای رأی دادن، نوشتن نظر و معرفی محصول وارد حسابت شو."
      footer={
        <>
          حساب نداری؟{' '}
          <Link to="/signup" state={{ from: target }} className={linkClass}>
            ثبت‌نام کن
          </Link>
        </>
      }
    >
      {api.mode === 'demo' && (
        <div className="mb-5">
          <Notice title="ورود در حالت نمایشی">
            هر رمزی پذیرفته می‌شود. برای دیدن پنل مدیریت با <bdi className="ltr font-semibold">{DEMO_ADMIN_EMAIL}</bdi> و برای حساب
            عادی با <bdi className="ltr font-semibold">{DEMO_USER_EMAIL}</bdi> وارد شو.
          </Notice>
        </div>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="ایمیل" error={errors.email}>
          {(props) => (
            <TextInput {...props} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="رمز عبور" error={errors.password}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-ink-muted hover:text-ink">
            رمزت را فراموش کرده‌ای؟
          </Link>
        </div>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ورود
        </Button>
      </form>
    </AuthCard>
  )
}

export function SignupPage() {
  useDocumentMeta('ثبت‌نام')
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
      <AuthCard title="ایمیلت را تأیید کن">
        <div className="flex gap-3 text-sm">
          <MailCheck size={22} strokeWidth={1.75} className="shrink-0 text-success-700" aria-hidden />
          <p>
            لینک تأیید به <bdi className="ltr font-semibold">{confirmationSentTo}</bdi> فرستاده شد. بعد از باز کردن لینک، می‌توانی وارد شوی.
            اگر ایمیل را نمی‌بینی، پوشه‌ی هرزنامه را هم نگاه کن.
          </p>
        </div>
        <ButtonLink to="/login" variant="secondary" className="mt-6 w-full">
          رفتن به صفحه‌ی ورود
        </ButtonLink>
      </AuthCard>
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

  return (
    <AuthCard
      title="ساخت حساب"
      subtitle="با حساب شکارگاه می‌توانی محصول معرفی کنی، رأی بدهی و نظر بنویسی."
      footer={
        <>
          حساب داری؟{' '}
          <Link to="/login" state={{ from: target }} className={linkClass}>
            وارد شو
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="نام نمایشی" hint="این نام کنار محصولات و نظرهایت دیده می‌شود." error={errors.displayName}>
          {(props) => <TextInput {...props} dir="auto" autoComplete="name" value={values.displayName} onChange={(e) => set('displayName', e.target.value)} />}
        </Field>
        <Field label="ایمیل" error={errors.email}>
          {(props) => <TextInput {...props} type="email" dir="ltr" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="رمز عبور" hint="دست‌کم ۸ نویسه." error={errors.password}>
          {(props) => (
            <TextInput {...props} type="password" dir="ltr" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} />
          )}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ساخت حساب
        </Button>
      </form>
    </AuthCard>
  )
}

export function ForgotPasswordPage() {
  useDocumentMeta('بازیابی رمز عبور')
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
    <AuthCard
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
          {api.mode === 'demo' && ' در حالت نمایشی ایمیلی فرستاده نمی‌شود.'}
        </Notice>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="ایمیل" error={fieldError}>
            {(props) => <TextInput {...props} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
          <Button type="submit" loading={busy} className="w-full">
            ارسال لینک بازیابی
          </Button>
        </form>
      )}
    </AuthCard>
  )
}

export function ResetPasswordPage() {
  useDocumentMeta('انتخاب رمز تازه')
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
      <AuthCard title="لینک بازیابی معتبر نیست">
        <p className="text-sm text-ink-muted">این لینک منقضی شده یا قبلاً استفاده شده است. یک لینک تازه درخواست کن.</p>
        <ButtonLink to="/forgot-password" className="mt-6 w-full">
          درخواست لینک تازه
        </ButtonLink>
      </AuthCard>
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
    <AuthCard title="انتخاب رمز تازه">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="رمز تازه" hint="دست‌کم ۸ نویسه." error={errors.password}>
          {(props) => <TextInput {...props} type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="تکرار رمز تازه" error={errors.repeat}>
          {(props) => <TextInput {...props} type="password" dir="ltr" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <Button type="submit" loading={busy} className="w-full">
          ذخیره‌ی رمز تازه
        </Button>
      </form>
    </AuthCard>
  )
}

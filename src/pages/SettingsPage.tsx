import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import type { Profile } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { useObjectUrl } from '@/lib/useObjectUrl'
import {
  IMAGE_TYPES,
  LIMITS,
  compact,
  hasErrors,
  validateDisplayName,
  validateImage,
  validatePassword,
  validateUsername,
} from '@/lib/validation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

export function SettingsPage() {
  useDocumentMeta('تنظیمات حساب')
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!profile) {
    return (
      <Notice tone="danger" title="پروفایل بارگذاری نشد">
        صفحه را دوباره باز کن. اگر مشکل ادامه داشت از صفحه‌ی تماس با ما اطلاع بده.
      </Notice>
    )
  }
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-extrabold">تنظیمات حساب</h1>
      <ProfileForm profile={profile} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const [values, setValues] = useState({
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    xUsername: profile.xUsername ?? '',
    telegramUsername: profile.telegramUsername ?? '',
    linkedinUsername: profile.linkedinUsername ?? '',
    githubUsername: profile.githubUsername ?? '',
  })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const preview = useObjectUrl(avatar)

  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = compact({
      displayName: validateDisplayName(values.displayName),
      username: validateUsername(values.username),
      bio: values.bio.trim().length > LIMITS.bio.max ? 'معرفی نباید بیشتر از ۲۸۰ نویسه باشد.' : undefined,
      avatar: validateImage(avatar, LIMITS.avatarBytes),
    })
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      await api.updateProfile(profile.id, { ...values, avatar, removeAvatar })
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setAvatar(null)
      setRemoveAvatar(false)
      toast.success('پروفایلت ذخیره شد.')
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  const shownAvatar = preview ?? (removeAvatar ? null : profile.avatarUrl)

  return (
    <form onSubmit={submit} noValidate className={`${cardClass} space-y-6 p-5 sm:p-7`}>
      <h2 className="text-lg font-bold">پروفایل عمومی</h2>

      <Field label="تصویر پروفایل" optional hint={`PNG، JPG یا WebP تا ${formatBytes(LIMITS.avatarBytes)}.`} error={errors.avatar}>
        {(props) => (
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={values.displayName || profile.displayName} seed={profile.id} url={shownAvatar} size={64} />
            <label className="inline-flex h-9 cursor-pointer items-center rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600">
              انتخاب تصویر
              <input
                {...props}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => {
                  setAvatar(e.target.files?.[0] ?? null)
                  setRemoveAvatar(false)
                  e.target.value = ''
                }}
              />
            </label>
            {(shownAvatar || avatar) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAvatar(null)
                  setRemoveAvatar(true)
                }}
              >
                حذف تصویر
              </Button>
            )}
          </div>
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="نام نمایشی" error={errors.displayName}>
          {(props) => <TextInput {...props} dir="auto" value={values.displayName} onChange={(e) => set('displayName', e.target.value)} />}
        </Field>
        <Field label="نام کاربری" hint="حروف کوچک انگلیسی، عدد و _ . در نشانی پروفایلت استفاده می‌شود." error={errors.username}>
          {(props) => (
            <TextInput
              {...props}
              dir="ltr"
              autoCapitalize="none"
              spellCheck={false}
              value={values.username}
              onChange={(e) => set('username', e.target.value.toLowerCase())}
              className="text-start"
            />
          )}
        </Field>
      </div>

      <Field label="معرفی کوتاه (بیوگرافی)" optional error={errors.bio} counter={{ value: values.bio, max: LIMITS.bio.max }}>
        {(props) => (
          <TextArea
            {...props}
            dir="auto"
            rows={3}
            value={values.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="چند خط درباره‌ی خودت، محصولاتت یا علاقه‌هایت."
          />
        )}
      </Field>

      <fieldset className="space-y-4 rounded-lg border border-line/70 p-4">
        <legend className="px-1.5 text-sm font-bold">پیوندهای عمومی</legend>
        <p className="text-[13px] text-ink-muted">اختیاری. فقط چیزی را پر کن که می‌خواهی در پروفایل عمومی‌ات دیده شود.</p>
        <Field label="وب‌سایت" optional error={errors.websiteUrl}>
          {(props) => (
            <TextInput {...props} dir="ltr" type="url" className="text-start" placeholder="https://" value={values.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ایکس" optional hint="بدون @">
            {(props) => <TextInput {...props} dir="ltr" className="text-start" value={values.xUsername} onChange={(e) => set('xUsername', e.target.value)} />}
          </Field>
          <Field label="تلگرام" optional hint="بدون @">
            {(props) => <TextInput {...props} dir="ltr" className="text-start" value={values.telegramUsername} onChange={(e) => set('telegramUsername', e.target.value)} />}
          </Field>
          <Field label="لینکدین" optional hint="بخش انتهایی نشانی پروفایل">
            {(props) => <TextInput {...props} dir="ltr" className="text-start" value={values.linkedinUsername} onChange={(e) => set('linkedinUsername', e.target.value)} />}
          </Field>
          <Field label="گیت‌هاب" optional hint="نام کاربری">
            {(props) => <TextInput {...props} dir="ltr" className="text-start" value={values.githubUsername} onChange={(e) => set('githubUsername', e.target.value)} />}
          </Field>
        </div>
      </fieldset>

      {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          ذخیره‌ی پروفایل
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const api = useApi()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validatePassword(password)
    setFieldError(found)
    if (found) return
    setBusy(true)
    setError(null)
    try {
      await api.updatePassword(password)
      setPassword('')
      toast.success('رمز عبورت تغییر کرد.')
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={`${cardClass} space-y-6 p-5 sm:p-7`}>
      <h2 className="text-lg font-bold">تغییر رمز عبور</h2>
      <Field label="رمز تازه" hint="دست‌کم ۸ نویسه." error={fieldError}>
        {(props) => (
          <TextInput {...props} type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={busy}>
          تغییر رمز
        </Button>
      </div>
    </form>
  )
}

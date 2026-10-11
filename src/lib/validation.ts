import { formatBytes, formatNumber } from './format'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export const LIMITS = {
  productName: { min: 2, max: 60 },
  tagline: { min: 10, max: 120 },
  description: { min: 30, max: 3000 },
  url: { max: 300 },
  comment: { min: 1, max: 1000 },
  displayName: { min: 2, max: 50 },
  bio: { max: 280 },
  password: { min: 8, max: 72 },
  reportDetails: { max: 500 },
  moderationNote: { max: 500 },
  categoryName: { min: 2, max: 40 },
  categoryDescription: { max: 200 },
  logoBytes: 1024 * 1024,
  avatarBytes: 512 * 1024,
} as const

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

function length(value: string, label: string, min: number, max: number): string | undefined {
  const size = value.trim().length
  if (size === 0) return `${label} را وارد کنید.`
  if (size < min) return `${label} باید دست‌کم ${formatNumber(min)} نویسه باشد.`
  if (size > max) return `${label} نباید بیشتر از ${formatNumber(max)} نویسه باشد.`
  return undefined
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') && !/\s/.test(value.trim())
  } catch {
    return false
  }
}

export function validateImage(file: File | null, maxBytes: number): string | undefined {
  if (!file) return undefined
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'فقط تصویر PNG، JPG یا WebP قابل قبول است.'
  if (file.size > maxBytes) return `حجم تصویر نباید بیشتر از ${formatBytes(maxBytes)} باشد.`
  return undefined
}

export interface ProductFormValues {
  name: string
  tagline: string
  description: string
  websiteUrl: string
  categoryId: string
  logo: File | null
}

export function validateProduct(values: ProductFormValues): FieldErrors<keyof ProductFormValues> {
  const errors: FieldErrors<keyof ProductFormValues> = {}
  errors.name = length(values.name, 'نام محصول', LIMITS.productName.min, LIMITS.productName.max)
  errors.tagline = length(values.tagline, 'معرفی کوتاه', LIMITS.tagline.min, LIMITS.tagline.max)
  errors.description = length(values.description, 'توضیحات', LIMITS.description.min, LIMITS.description.max)
  if (!values.websiteUrl.trim()) errors.websiteUrl = 'نشانی وب‌سایت را وارد کنید.'
  else if (values.websiteUrl.trim().length > LIMITS.url.max) errors.websiteUrl = 'نشانی وب‌سایت بیش از حد طولانی است.'
  else if (!isHttpUrl(values.websiteUrl)) errors.websiteUrl = 'نشانی باید کامل و با https:// یا http:// شروع شود.'
  if (!values.categoryId) errors.categoryId = 'یک دسته‌بندی انتخاب کنید.'
  errors.logo = validateImage(values.logo, LIMITS.logoBytes)
  return compact(errors)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'ایمیل را وارد کنید.'
  if (!EMAIL.test(email.trim())) return 'ایمیل معتبر نیست.'
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'رمز عبور را وارد کنید.'
  if (password.length < LIMITS.password.min) return `رمز عبور باید دست‌کم ${formatNumber(LIMITS.password.min)} نویسه باشد.`
  if (password.length > LIMITS.password.max) return `رمز عبور نباید بیشتر از ${formatNumber(LIMITS.password.max)} نویسه باشد.`
  return undefined
}

export function validateDisplayName(name: string): string | undefined {
  return length(name, 'نام نمایشی', LIMITS.displayName.min, LIMITS.displayName.max)
}

export function validateUsername(username: string): string | undefined {
  if (!username.trim()) return 'نام کاربری را وارد کنید.'
  if (!/^[a-z0-9_]{3,30}$/.test(username.trim()))
    return 'نام کاربری باید ۳ تا ۳۰ نویسه و فقط شامل حروف کوچک انگلیسی، عدد و _ باشد.'
  return undefined
}

export function validateComment(body: string): string | undefined {
  if (!body.trim()) return 'متن نظر را بنویسید.'
  if (body.trim().length > LIMITS.comment.max) return `نظر نباید بیشتر از ${formatNumber(LIMITS.comment.max)} نویسه باشد.`
  return undefined
}

export function compact<T extends Record<string, string | undefined>>(errors: T): T {
  for (const key of Object.keys(errors)) if (errors[key] === undefined) delete errors[key]
  return errors
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}

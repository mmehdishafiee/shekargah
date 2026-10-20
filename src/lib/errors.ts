export type ApiErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_taken'
  | 'weak_password'
  | 'username_taken'
  | 'not_authenticated'
  | 'not_authorized'
  | 'not_found'
  | 'too_many_pending'
  | 'rate_limited'
  | 'inactive_category'
  | 'category_in_use'
  | 'duplicate'
  | 'invalid_transition'
  | 'note_required'
  | 'invalid_input'
  | 'too_many_tags'
  | 'unknown_tag'
  | 'upload_failed'
  | 'network'
  | 'unknown'

const MESSAGES: Record<ApiErrorCode, string> = {
  invalid_credentials: 'ایمیل یا رمز عبور درست نیست.',
  email_not_confirmed: 'ایمیلت هنوز تأیید نشده است. لینک تأیید را در صندوق ایمیلت باز کن.',
  email_taken: 'با این ایمیل قبلاً حساب ساخته شده است. وارد شو یا رمزت را بازیابی کن.',
  weak_password: 'رمز عبور ضعیف است. رمز طولانی‌تر و متنوع‌تری انتخاب کن.',
  username_taken: 'این نام کاربری قبلاً انتخاب شده است.',
  not_authenticated: 'برای این کار باید وارد حسابت شوی.',
  not_authorized: 'اجازه‌ی انجام این کار را نداری.',
  not_found: 'موردی که دنبالش بودی پیدا نشد.',
  too_many_pending: 'سه محصول در انتظار بررسی داری. بعد از بررسی آن‌ها می‌توانی محصول تازه‌ای ثبت کنی.',
  rate_limited: 'درخواست‌هایت زیاد بوده است. چند دقیقه صبر کن و دوباره امتحان کن.',
  inactive_category: 'این دسته‌بندی دیگر فعال نیست. دسته‌ی دیگری انتخاب کن.',
  category_in_use: 'این دسته محصول دارد و حذف‌شدنی نیست. به‌جای حذف، غیرفعالش کن.',
  duplicate: 'این کار قبلاً انجام شده است.',
  invalid_transition: 'وضعیت این محصول تغییر کرده است. صفحه را تازه کن.',
  note_required: 'دلیل را بنویس تا برای سازنده نمایش داده شود.',
  invalid_input: 'اطلاعات واردشده معتبر نیست. فیلدها را بررسی کن.',
  too_many_tags: 'حداکثر پنج برچسب برای هر محصول مجاز است.',
  unknown_tag: 'یکی از برچسب‌های انتخاب‌شده معتبر نیست.',
  upload_failed: 'بارگذاری تصویر انجام نشد. نوع و حجم فایل را بررسی کن و دوباره امتحان کن.',
  network: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کن و دوباره امتحان کن.',
  unknown: 'خطای غیرمنتظره‌ای رخ داد. دوباره امتحان کن.',
}

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'ApiError'
    this.code = code
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code]
  if (error instanceof TypeError && /fetch/i.test(error.message)) return MESSAGES.network
  return MESSAGES.unknown
}

export function isApiError(error: unknown, code: ApiErrorCode): boolean {
  return error instanceof ApiError && error.code === code
}

import type { ReportReason } from '@/data/types'

export const REPORT_REASONS: Record<ReportReason, string> = {
  spam: 'هرزنامه یا تبلیغ ناخواسته',
  inappropriate: 'محتوای توهین‌آمیز یا نامناسب',
  misleading: 'اطلاعات گمراه‌کننده یا لینک نادرست',
  copyright: 'نقض حق نشر یا جعل هویت',
  other: 'دلیل دیگر',
}

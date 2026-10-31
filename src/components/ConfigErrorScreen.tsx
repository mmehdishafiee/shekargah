import { LogoMark } from '@/components/brand/Logo'
import { Notice } from '@/components/ui/Feedback'

export function ConfigErrorScreen({ error }: { error: unknown }) {
  return (
    <div dir="rtl" className="grid min-h-dvh place-items-center bg-sunken px-4 text-center">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 shadow-card">
        <LogoMark size={48} />
        <h1 className="mt-5 text-xl font-extrabold">اتصال سایت تنظیم نشده است</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          این نسخه نمی‌تواند به داده‌های واقعی وصل شود. تنظیمات سرویس را بررسی کنید و صفحه را دوباره بارگذاری کنید.
        </p>
        <div className="mt-5 text-start">
          <Notice tone="danger">{error instanceof Error ? error.message : 'پیکربندی backend ناقص است.'}</Notice>
        </div>
      </div>
    </div>
  )
}

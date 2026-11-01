import { Link } from 'react-router'
import { ArrowRight, Compass, Search } from 'lucide-react'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/styles'

const SUGGESTIONS: { to: string; label: string; hint: string }[] = [
  { to: '/', label: 'صفحه‌ی اصلی', hint: 'تازه‌ترین محصولات امروز' },
  { to: '/leaderboard', label: 'جدول رتبه‌بندی', hint: 'پررأی‌ترین محصولات' },
  { to: '/topics', label: 'موضوع‌ها', hint: 'گشتن بر اساس دسته‌بندی' },
  { to: '/collections', label: 'مجموعه‌ها', hint: 'فهرست‌های موضوعی' },
  { to: '/help', label: 'راهنما', hint: 'چطور از شکارگاه استفاده کنم' },
  { to: '/contact', label: 'تماس با ما', hint: 'گزارش یا پرسش' },
]

export function NotFoundPage() {
  useDocumentMeta('صفحه پیدا نشد', 'این صفحه وجود ندارد یا جابه‌جا شده است.', { robots: 'noindex, follow' })

  return (
    <section className="mx-auto max-w-2xl py-8 text-center sm:py-16">
      <p className="text-[64px] font-black leading-none text-brand-600 sm:text-[88px]" aria-hidden>
        ۴۰۴
      </p>
      <h1 className="mt-3 flex items-center justify-center gap-2 text-2xl font-extrabold">
        <Compass size={22} strokeWidth={1.75} aria-hidden />
        این صفحه پیدا نشد
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-muted">
        ممکن است نشانی را اشتباه وارد کرده باشی یا این صفحه جابه‌جا شده باشد. از میان‌برهای زیر ادامه بده.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink to="/">رفتن به صفحه‌ی اصلی</ButtonLink>
        <ButtonLink to="/today" variant="secondary" icon={<Search size={16} strokeWidth={1.75} aria-hidden />}>
          محصولات امروز
        </ButtonLink>
      </div>

      <div className={`${cardClass} mt-8 p-2 text-start`}>
        <ul className="divide-y divide-line/70">
          {SUGGESTIONS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-sunken">
                <span>
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="block text-xs text-ink-muted">{item.hint}</span>
                </span>
                <ArrowRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
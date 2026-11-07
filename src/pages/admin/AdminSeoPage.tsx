import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Globe, Search, XCircle } from 'lucide-react'
import { useApi } from '@/data/api'
import { usePosts, useSiteStats, useTopics } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { SITE_URL, useDocumentMeta } from '@/lib/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

interface Check {
  label: string
  detail: string
  ok: boolean
}

/** Read-only SEO dashboard: what is in place and what still needs attention. */
export function AdminSeoPage() {
  useDocumentMeta('سئو')
  const api = useApi()
  const stats = useSiteStats()
  const topics = useTopics()
  const posts = usePosts()

  const companies = useQuery({
    queryKey: ['seo-company-count'],
    queryFn: async () => {
      const page = await api.listCompanies(0)
      return page.total
    },
  })

  const sitemap = useQuery({
    queryKey: ['seo-sitemap'],
    queryFn: async () => {
      const response = await fetch('/sitemap.xml', { cache: 'no-store' })
      if (!response.ok) return { ok: false, urls: 0 }
      const text = await response.text()
      return { ok: true, urls: (text.match(/<loc>/g) ?? []).length }
    },
  })

  const robots = useQuery({
    queryKey: ['seo-robots'],
    queryFn: async () => {
      const response = await fetch('/robots.txt', { cache: 'no-store' })
      const text = await response.text()
      return { ok: response.ok && text.includes('Sitemap:'), text }
    },
  })

  const products = stats.data?.products ?? 0
  const postCount = posts.data?.pages[0]?.total ?? 0
  const topicCount = topics.data?.length ?? 0
  const companyCount = companies.data ?? 0

  const checks: Check[] = [
    { label: 'عنوان و توضیحات متا', detail: 'در همه‌ی صفحه‌ها به‌صورت پویا تنظیم می‌شود.', ok: true },
    { label: 'نشانی کانونیکال', detail: 'برای هر مسیر یک canonical یکتا صادر می‌شود.', ok: true },
    { label: 'داده‌ی ساخت‌یافته (Schema)', detail: 'WebSite + SearchAction در خانه، SoftwareApplication در محصول، BlogPosting در وبلاگ.', ok: true },
    { label: 'کارت‌های اشتراک‌گذاری', detail: 'Open Graph و Twitter Card با تصویر محصول.', ok: true },
    { label: 'زبان و راست‌چین', detail: 'lang="fa" و dir="rtl" روی سند.', ok: true },
    { label: 'صفحه‌های خصوصی noindex', detail: 'محصول منتشرنشده و نتیجه‌های جست‌وجو ایندکس نمی‌شوند.', ok: true },
    { label: 'نقشه‌ی سایت', detail: sitemap.isPending ? 'در حال بررسی…' : sitemap.isError ? 'بررسی ناموفق بود؛ دوباره تلاش کن.' : `${formatNumber(sitemap.data?.urls ?? 0)} آدرس در sitemap.xml`, ok: !sitemap.isError && sitemap.data?.ok === true && (sitemap.data?.urls ?? 0) > 10 },
    { label: 'robots.txt و معرفی نقشه', detail: robots.isPending ? 'در حال بررسی…' : robots.isError ? 'بررسی ناموفق بود؛ دوباره تلاش کن.' : robots.data?.ok ? 'مسیرهای خصوصی مسدود و sitemap معرفی شده است.' : 'فایل robots.txt کامل نیست.', ok: !robots.isError && robots.data?.ok === true },
  ]

  const total = products + postCount + topicCount + companyCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Search size={22} strokeWidth={2} aria-hidden />
          سئو
        </h1>
        <p className="mt-1 text-sm text-ink-muted">وضعیت پایه‌ی سئوی سایت و صفحه‌هایی که برای موتورهای جست‌وجو آماده‌اند.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['محصول منتشرشده', products],
          ['نوشته‌ی وبلاگ', postCount],
          ['موضوع', topicCount],
          ['شرکت', companyCount],
        ].map(([label, value]) => (
          <div key={String(label)} className={`${cardClass} p-4`}>
            <p className="text-xl font-extrabold tabular-nums">{formatNumber(Number(value))}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-ink-muted">
        در مجموع حدود <span className="font-semibold text-ink">{formatNumber(total)}</span> صفحه‌ی قابل ایندکس.
      </p>

      <div className={`${cardClass} p-5`}>
        <h2 className="text-base font-bold">بررسی‌ها</h2>
        <ul className="mt-4 space-y-3">
          {checks.map((check) => (
            <li key={check.label} className="flex gap-3">
              <span className={`mt-0.5 shrink-0 ${check.ok ? 'text-success-700' : 'text-danger-600'}`}>
                {check.ok ? <CheckCircle2 size={18} strokeWidth={2} aria-hidden /> : <XCircle size={18} strokeWidth={2} aria-hidden />}
              </span>
              <span>
                <span className="block text-sm font-semibold">{check.label}</span>
                <span className="block text-[13px] text-ink-muted">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`${cardClass} space-y-3 p-5`}>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Globe size={17} strokeWidth={1.75} aria-hidden />
          فایل‌های عمومی
        </h2>
        <div className="flex flex-wrap gap-3">
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-sunken">
            sitemap.xml
            <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
          </a>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-sunken">
            robots.txt
            <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
          </a>
          <ButtonLink to="/admin/blog" variant="secondary">
            مدیریت نوشته‌ها
          </ButtonLink>
        </div>
        <p className="text-[12px] text-ink-muted">
          دامنه‌ی اصلی سایت: <span className="ltr font-medium">{SITE_URL}</span>
        </p>
      </div>

      {stats.isPending && <PageLoader />}
    </div>
  )
}
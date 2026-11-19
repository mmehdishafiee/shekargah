import { useState } from 'react'
import { Download, Mail } from 'lucide-react'
import { useNewsletterSubscribers } from '@/data/queries'
import { formatDate, formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

/** Newsletter list + CSV export for an external sender. */
export function AdminNewsletterPage() {
  useDocumentMeta('خبرنامه')
  const toast = useToast()
  const feed = useNewsletterSubscribers()
  const items = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    if (items.length === 0) return
    setExporting(true)
    try {
      const rows = [['email', 'source', 'subscribed_at'], ...items.map((item) => [item.email, item.source ?? '', item.createdAt])]
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `shekargah-newsletter-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('فایل CSV دانلود شد.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">خبرنامه</h1>
          <p className="mt-1 text-sm text-ink-muted">
            فهرست ایمیل‌های ثبت‌شده برای ارسال با ابزار خودت. {total > 0 && `${formatNumber(total)} نفر.`}
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<Download size={16} strokeWidth={1.75} />}
          loading={exporting}
          disabled={items.length === 0}
          onClick={() => void exportCsv()}
        >
          دانلود CSV
        </Button>
      </div>

      <p className="rounded-control border border-line bg-sunken/60 px-4 py-3 text-[13px] leading-6 text-ink-muted">
        برای دانلود کامل، از دکمهٔ «موارد بیشتر» استفاده کن تا همهٔ ایمیل‌ها بارگذاری شوند؛ فایل CSV از همان فهرست ساخته می‌شود.
      </p>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <PageLoader />
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Mail size={22} strokeWidth={1.75} />} title="هنوز کسی عضو خبرنامه نشده" />
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <li key={item.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4">
                <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm">
                  {item.email}
                </span>
                <span className="text-xs text-ink-faint">{item.source ?? '—'}</span>
                <span className="text-xs text-ink-faint">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {feed.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
            موارد بیشتر
          </Button>
        </div>
      )}
    </div>
  )
}
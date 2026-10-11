import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck, X } from 'lucide-react'
import { useApi } from '@/data/api'
import { useReports } from '@/data/queries'
import type { Report } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatNumber } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { REPORT_REASONS } from '@/components/product/reportReasons'
import { StatusBadge } from '@/components/product/StatusBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

const STATUS_LABEL = { open: 'باز', resolved: 'رسیدگی‌شده', dismissed: 'ردشده' } as const

export function AdminReportsPage() {
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const reports = useReports(filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          برای حذف نظر به صفحه‌ی محصول بروید؛ برای لغو انتشار محصول از زبانه‌ی «منتشرشده» استفاده کنید.
        </p>
        <div role="group" aria-label="فیلتر گزارش‌ها" className="flex shrink-0 rounded-full bg-sunken p-1 text-sm">
          {(['open', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3.5 py-1 font-semibold ${filter === value ? 'bg-surface shadow-card' : 'text-ink-muted hover:text-ink'}`}
            >
              {value === 'open' ? 'باز' : 'همه'}
            </button>
          ))}
        </div>
      </div>

      {reports.isPending ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner label="در حال بارگذاری گزارش‌ها" />
        </div>
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
      ) : reports.data.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<ShieldCheck size={22} strokeWidth={1.75} />} title={filter === 'open' ? 'گزارش بازی وجود ندارد' : 'هنوز گزارشی ثبت نشده'} />
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{formatNumber(reports.data.length)} گزارش</p>
          <ul className="space-y-3">
            {reports.data.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ReportCard({ report }: { report: Report }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState<'resolved' | 'dismissed' | null>(null)

  const resolve = async (status: 'resolved' | 'dismissed') => {
    setBusy(status)
    try {
      await api.resolveReport(report.id, status)
      toast.success(status === 'resolved' ? 'گزارش رسیدگی‌شده علامت خورد.' : 'گزارش رد شد.')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
        <span className="font-semibold text-ink">{REPORT_REASONS[report.reason]}</span>
        <span>{formatDateTime(report.createdAt)}</span>
        {report.reporter && (
          <span>
            گزارش‌دهنده:{' '}
            <Link to={profilePath(report.reporter.username)} className="font-medium text-ink hover:underline">
              {report.reporter.displayName}
            </Link>
          </span>
        )}
        {report.status !== 'open' && <span>وضعیت: {STATUS_LABEL[report.status]}</span>}
      </div>

      <div className="mt-3 rounded-lg bg-sunken/70 px-4 py-3 text-sm">
        {report.product ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted">محصول:</span>
            <Link to={productPath(report.product.slug)} className="font-semibold hover:underline">
              {report.product.name}
            </Link>
            <StatusBadge status={report.product.status} />
          </div>
        ) : report.comment ? (
          <div>
            <p className="text-ink-muted">
              نظر
              {report.comment.product && (
                <>
                  {' '}
                  روی{' '}
                  <Link to={productPath(report.comment.product.slug)} className="font-semibold text-ink hover:underline">
                    {report.comment.product.name}
                  </Link>
                </>
              )}
              :
            </p>
            <p dir="auto" className="mt-1 line-clamp-3 whitespace-pre-line">
              {report.comment.body}
            </p>
          </div>
        ) : (
          <p className="text-ink-muted">محتوای گزارش‌شده حذف شده است.</p>
        )}
        {report.details && (
          <p dir="auto" className="mt-2 border-t border-line/70 pt-2">
            {report.details}
          </p>
        )}
      </div>

      {report.status === 'open' && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" icon={<X size={16} strokeWidth={1.75} />} loading={busy === 'dismissed'} disabled={Boolean(busy)} onClick={() => resolve('dismissed')}>
            رد گزارش
          </Button>
          <Button size="sm" icon={<Check size={16} strokeWidth={2} />} loading={busy === 'resolved'} disabled={Boolean(busy)} onClick={() => resolve('resolved')}>
            رسیدگی شد
          </Button>
        </div>
      )}
    </li>
  )
}

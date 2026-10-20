import { useSearchParams } from 'react-router'
import { Trophy } from 'lucide-react'
import { useLeaderboard, useMyVotes } from '@/data/queries'
import type { LeaderboardPeriod } from '@/data/types'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const PERIODS: { value: LeaderboardPeriod; label: string; caption: string }[] = [
  { value: 'daily', label: 'امروز', caption: 'رأی‌های امروز به وقت تهران' },
  { value: 'weekly', label: 'هفته', caption: 'رأی‌های هفت روز گذشته' },
]

export function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const period: LeaderboardPeriod = params.get('period') === 'weekly' ? 'weekly' : 'daily'
  const feed = useLeaderboard(period)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))
  const active = PERIODS.find((item) => item.value === period)!
  useDocumentMeta(`جدول رتبه‌بندی ${active.label}`)

  const setPeriod = (value: LeaderboardPeriod) => {
    const next = new URLSearchParams(params)
    if (value === 'weekly') next.set('period', value)
    else next.delete('period')
    setParams(next)
  }

  return (
    <section aria-labelledby="leaderboard-heading" className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="leaderboard-heading" className="text-2xl font-extrabold">
            جدول رتبه‌بندی
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{active.caption} — بر اساس رأی کاربران، نه مجموع کل رأی‌ها.</p>
        </div>
        <div role="group" aria-label="بازه" className="flex rounded-full bg-sunken p-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                period === item.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true" aria-label="در حال بارگذاری جدول">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} title="جدول بارگذاری نشد" />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Trophy size={22} strokeWidth={1.75} />}
            title="هنوز رأی تازه‌ای ثبت نشده"
            description="وقتی کاربران به محصول‌ها رأی بدهند، این جدول پر می‌شود."
          />
        ) : (
          <ol aria-label="جدول رتبه‌بندی" className="transition-opacity">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} rank={product.rank} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {feed.hasNextPage && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
            نمایش بیشتر
          </Button>
          <p className="text-xs text-ink-muted">
            {formatNumber(products.length)} از {formatNumber(total)} محصول
          </p>
        </div>
      )}
    </section>
  )
}

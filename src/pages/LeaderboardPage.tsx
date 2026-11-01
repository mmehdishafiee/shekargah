import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Trophy } from 'lucide-react'
import { useLeaderboard, useMySavedIds, useMyVotes } from '@/data/queries'
import type { LeaderboardPeriod } from '@/data/types'
import { formatIsoDay, formatNumber } from '@/lib/format'
import { tehranDateLabel } from '@/lib/engagement'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const PERIODS: { value: LeaderboardPeriod; label: string; noun: string; days: number }[] = [
  { value: 'daily', label: 'روز', noun: 'این روز', days: 1 },
  { value: 'weekly', label: 'هفته', noun: '۷ روز منتهی به این روز', days: 7 },
  { value: 'monthly', label: 'ماه', noun: '۳۰ روز منتهی به این روز', days: 30 },
  { value: 'yearly', label: 'سال', noun: 'یک سال منتهی به این روز', days: 365 },
]

const ISO = /^\d{4}-\d{2}-\d{2}$/

function isPeriod(value: string | undefined): value is LeaderboardPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly'
}

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00+03:30`)
  date.setUTCDate(date.getUTCDate() + days)
  return tehranDateLabel(date)
}

function isValidDay(iso: string | undefined): iso is string {
  if (!iso || !ISO.test(iso)) return false
  return !Number.isNaN(new Date(`${iso}T12:00:00+03:30`).getTime())
}

export function LeaderboardPage() {
  const { period: periodParam, date: dateParam } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const today = tehranDateLabel()

  // Legacy `?period=` links (and the bare /leaderboard route) still work.
  const legacy = searchParams.get('period')
  const period: LeaderboardPeriod = isPeriod(periodParam) ? periodParam : isPeriod(legacy ?? undefined) ? (legacy as LeaderboardPeriod) : 'daily'
  const anchor = isValidDay(dateParam) ? dateParam : null
  const active = PERIODS.find((item) => item.value === period)!

  const feed = useLeaderboard(period, anchor)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))
  const saved = useMySavedIds(products.map((p) => p.id))

  const dayLabel = formatIsoDay(anchor ?? today)
  const isLatest = !anchor || anchor === today
  const title = `جدول رتبه‌بندی ${active.label}${anchor ? ` — ${dayLabel}` : ''}`
  useDocumentMeta(title, `بهترین محصولات بر اساس رأی کاربران برای ${active.noun}.`, {
    path: `/leaderboard/${period}${anchor ? `/${anchor}` : ''}`,
  })

  const go = (nextPeriod: LeaderboardPeriod, nextAnchor: string | null) => {
    navigate(`/leaderboard/${nextPeriod}${nextAnchor ? `/${nextAnchor}` : ''}`)
  }

  const shift = (direction: 1 | -1) => {
    const base = anchor ?? today
    go(period, shiftDay(base, direction * active.days))
  }

  return (
    <section aria-labelledby="leaderboard-heading" className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="leaderboard-heading" className="text-2xl font-extrabold">
            جدول رتبه‌بندی
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {anchor ? (
              <>
                بر اساس رأی‌های {active.noun} —{' '}
                <time dateTime={anchor} className="font-semibold text-ink">
                  {dayLabel}
                </time>
              </>
            ) : (
              <>بر اساس رأی‌های امروز به وقت تهران — نه مجموع کل رأی‌ها.</>
            )}
          </p>
        </div>

        <div role="group" aria-label="بازه" className="flex rounded-full bg-sunken p-1">
          {PERIODS.map((item) => (
            <Link
              key={item.value}
              to={`/leaderboard/${item.value}`}
              aria-current={period === item.value ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                period === item.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="بازه‌ی قبل">
            قبل
          </Button>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} disabled={isLatest} aria-label="بازه‌ی بعد">
            بعد
          </Button>
          <Button variant="ghost" size="sm" onClick={() => go(period, null)} disabled={isLatest}>
            آخرین
          </Button>
        </div>
        {anchor && (
          <p className="text-xs text-ink-muted">
            بازه: {formatIsoDay(shiftDay(anchor, -(active.days - 1)))} تا {dayLabel}
          </p>
        )}
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
            title="در این بازه رأی تازه‌ای ثبت نشده"
            description="وقتی کاربران به محصول‌ها رأی بدهند، این جدول پر می‌شود."
          />
        ) : (
          <ol aria-label="جدول رتبه‌بندی" className="transition-opacity">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} rank={product.rank} />
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
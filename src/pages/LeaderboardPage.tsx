import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Trophy } from 'lucide-react'
import { useLeaderboard, useMySavedIds, useMyVotes } from '@/data/queries'
import type { LeaderboardPeriod } from '@/data/types'
import { LEADERBOARD_DAYS, tehranDateLabel } from '@/lib/engagement'
import { formatIsoDay, formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const PERIODS: { value: LeaderboardPeriod; label: string; title: string; noun: string }[] = [
  { value: 'daily', label: 'روزانه', title: 'روزانه', noun: 'این روز' },
  { value: 'weekly', label: 'هفتگی', title: 'هفتگی', noun: '۷ روز منتهی به این روز' },
  { value: 'monthly', label: 'ماهانه', title: 'ماهانه', noun: '۳۰ روز منتهی به این روز' },
  { value: 'yearly', label: 'سالانه', title: 'سالانه', noun: 'یک سال منتهی به این روز' },
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
  const days = LEADERBOARD_DAYS[period]

  const feed = useLeaderboard(period, anchor)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))
  const saved = useMySavedIds(products.map((p) => p.id))

  // Without a date the API serves the latest period that still has products, so
  // the window in the heading comes from the data, not from the clock.
  const resolved = feed.data?.pages[0]
  const endDay = anchor ?? resolved?.endDay ?? today
  const startDay = resolved?.startDay ?? shiftDay(endDay, -(days - 1))
  const dayLabel = formatIsoDay(endDay)
  const rangeLabel = days === 1 ? dayLabel : `${formatIsoDay(startDay)} تا ${dayLabel}`
  const isLatest = endDay === today
  const isFallback = !anchor && endDay !== today

  const metaTitle = days === 1 ? `جدول رتبه‌بندی ${active.title} — ${dayLabel}` : `جدول رتبه‌بندی ${active.title} — ${rangeLabel}`
  useDocumentMeta(metaTitle, `محصولات منتشرشده و پررأی‌ترین محصولات ${active.noun}.`, {
    path: `/leaderboard/${period}${endDay === today ? '' : `/${endDay}`}`,
  })

  const go = (nextPeriod: LeaderboardPeriod, nextAnchor: string | null) => {
    navigate(`/leaderboard/${nextPeriod}${nextAnchor ? `/${nextAnchor}` : ''}`)
  }

  const shift = (direction: 1 | -1) => {
    go(period, shiftDay(endDay, direction * days))
  }

  return (
    <section aria-labelledby="leaderboard-heading" className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="leaderboard-heading" className="text-2xl font-extrabold">
            جدول رتبه‌بندی {active.title}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            محصولاتی که در {active.noun} منتشر شده‌اند یا رأی گرفته‌اند — به ترتیب رأی‌های همین بازه، نه مجموع کل رأی‌ها.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <time dateTime={endDay} className="text-lg font-bold">
            {rangeLabel}
          </time>
          <span className="text-sm text-ink-muted" aria-live="polite">
            {feed.isPending ? 'در حال شمردن…' : `${formatNumber(total)} محصول`}
          </span>
          {isFallback && !feed.isPending && total > 0 && (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-muted">آخرین بازه‌ی دارای محصول</span>
          )}
        </p>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label={`${active.label} قبل`}>
            قبل
          </Button>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} disabled={isLatest} aria-label={`${active.label} بعد`}>
            بعد
          </Button>
          <Button variant="ghost" size="sm" onClick={() => go(period, null)} disabled={isLatest}>
            آخرین
          </Button>
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
            title={days === 1 ? 'در این روز محصولی منتشر یا رأی داده نشده' : 'در این بازه محصولی منتشر یا رأی داده نشده'}
            description="با دکمه‌های «قبل» و «بعد» بازه‌های دیگر را ببینید یا به آخرین بازه برگردید."
          />
        ) : (
          <ol aria-label="جدول رتبه‌بندی" className="transition-opacity">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow
                  product={product}
                  voted={votes.data?.has(product.id) ?? false}
                  saved={saved.data?.has(product.id) ?? false}
                  rank={product.rank}
                  score={product.score}
                  scoreLabel={days === 1 ? 'رأی در این روز' : 'رأی در این بازه'}
                />
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
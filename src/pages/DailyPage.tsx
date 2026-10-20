import { useSearchParams } from 'react-router'
import { PackageSearch } from 'lucide-react'
import { useDailyProducts, useMyVotes } from '@/data/queries'
import { tehranDateLabel } from '@/lib/engagement'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

export function DailyPage() {
  const [params, setParams] = useSearchParams()
  const today = tehranDateLabel()
  const date = params.get('date')?.trim() || today
  const isToday = date === today

  const feed = useDailyProducts(isToday ? null : date)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))

  useDocumentMeta(isToday ? 'محصولات امروز' : `محصولات ${date}`)

  const setDate = (value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== today) next.set('date', value)
    else next.delete('date')
    setParams(next)
  }

  const shiftDate = (days: number) => {
    const current = new Date(`${date}T12:00:00+03:30`)
    current.setUTCDate(current.getUTCDate() + days)
    const next = tehranDateLabel(current)
    setDate(next === today ? null : next)
  }

  return (
    <section aria-labelledby="daily-heading" className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="daily-heading" className="text-2xl font-extrabold">
            {isToday ? 'محصولات امروز' : `محصولات ${date}`}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isToday ? 'تازه‌ترین محصولاتی که امروز در شکارگاه منتشر شدند.' : 'محصولاتی که در این روز منتشر شدند.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shiftDate(-1)}>
            روز قبل
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDate(null)} disabled={isToday}>
            امروز
          </Button>
          <Button variant="secondary" size="sm" onClick={() => shiftDate(1)} disabled={isToday}>
            روز بعد
          </Button>
        </div>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true" aria-label="در حال بارگذاری محصولات">
            {Array.from({ length: 5 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} title="فهرست محصولات بارگذاری نشد" />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={22} strokeWidth={1.75} />}
            title={isToday ? 'امروز هنوز محصولی منتشر نشده' : 'در این روز محصولی منتشر نشده'}
            action={<ButtonLink to="/submit">معرفی محصول</ButtonLink>}
          />
        ) : (
          <ol aria-label="محصولات امروز" className="transition-opacity">
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
            نمایش محصولات بیشتر
          </Button>
          <p className="text-xs text-ink-muted">
            {formatNumber(products.length)} از {formatNumber(total)} محصول
          </p>
        </div>
      )}
    </section>
  )
}

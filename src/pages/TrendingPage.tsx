import { Flame } from 'lucide-react'
import { useMyVotes, useTrending } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

export function TrendingPage() {
  const feed = useTrending()
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))
  useDocumentMeta('داغ‌ترین‌ها')

  return (
    <section aria-labelledby="trending-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="trending-heading" className="text-2xl font-extrabold">
          داغ‌ترین‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          محصولاتی که در چند روز گذشته بیشترین رشد تعامل را داشتند، نه فقط بیشترین رأی کل.
        </p>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true" aria-label="در حال بارگذاری داغ‌ترین‌ها">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} title="فهرست داغ‌ترین‌ها بارگذاری نشد" />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Flame size={22} strokeWidth={1.75} />}
            title="فعلاً چیزی در حال داغ شدن نیست"
            description="محصول‌هایی که تازه رأی و نظر می‌گیرند اینجا دیده می‌شوند."
          />
        ) : (
          <ol aria-label="داغ‌ترین‌ها" className="transition-opacity">
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

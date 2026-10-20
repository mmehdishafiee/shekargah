import { Bookmark } from 'lucide-react'
import { useMyVotes, useSavedProducts } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

export function SavedPage() {
  const feed = useSavedProducts()
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const votes = useMyVotes(products.map((p) => p.id))
  useDocumentMeta('ذخیره‌شده‌های من')

  return (
    <section aria-labelledby="saved-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="saved-heading" className="text-2xl font-extrabold">
          ذخیره‌شده‌های من
        </h1>
        <p className="mt-1 text-sm text-ink-muted">محصولاتی که برای دیدن دوباره کنار گذاشتی، فقط برای خودت دیده می‌شود.</p>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true" aria-label="در حال بارگذاری ذخیره‌شده‌ها">
            {Array.from({ length: 4 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} title="ذخیره‌شده‌ها بارگذاری نشد" />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Bookmark size={22} strokeWidth={1.75} />}
            title="هنوز چیزی ذخیره نکرده‌ای"
            description="روی محصول‌های تازه کلیک کن و آن‌ها را برای بعد ذخیره کن."
            action={<ButtonLink to="/">دیدن محصولات</ButtonLink>}
          />
        ) : (
          <ol aria-label="ذخیره‌شده‌ها" className="transition-opacity">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} />
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
            {formatNumber(products.length)} محصول ذخیره‌شده
          </p>
        </div>
      )}
    </section>
  )
}

import { Sparkles } from 'lucide-react'
import { usePersonalFeed, useMySavedIds, useMyVotes } from '@/data/queries'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

/** "فید شما": products from makers and topics this visitor already engaged with. */
export function PersonalFeedPage() {
  useDocumentMeta('فید شما')
  const feed = usePersonalFeed()
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const votes = useMyVotes(products.map((product) => product.id))
  const saved = useMySavedIds(products.map((product) => product.id))

  return (
    <section aria-labelledby="feed-heading" className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 id="feed-heading" className="flex items-center gap-2 text-2xl font-extrabold">
          <Sparkles size={20} strokeWidth={2} className="text-brand-600" aria-hidden />
          فید شما
        </h1>
        <p className="mt-1 text-sm text-ink-muted">بر اساس سازندگان و موضوع‌هایی که به آن‌ها رأی داده‌ای.</p>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <ProductRowSkeleton key={index} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} strokeWidth={1.75} />}
            title="فیدت هنوز خالی است"
            description="چند محصول را رأی بده تا اینجا پیشنهادهای مرتبط ببینی."
            action={<ButtonLink to="/">دیدن محصولات</ButtonLink>}
          />
        ) : (
          <ol aria-label="فید شخصی">
            {products.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {feed.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
            موارد بیشتر
          </Button>
        </div>
      )}
    </section>
  )
}
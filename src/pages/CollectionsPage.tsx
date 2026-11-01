import { Link, useParams } from 'react-router'
import { Layers } from 'lucide-react'
import { useCollectionProducts, useCollections, useMySavedIds, useMyVotes } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

export function CollectionsPage() {
  useDocumentMeta('مجموعه‌ها')
  const collections = useCollections()

  return (
    <section aria-labelledby="collections-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="collections-heading" className="text-2xl font-extrabold">
          مجموعه‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">فهرست‌های دستچین‌شده از محصولات، برای پیدا کردن سریع‌تر.</p>
      </div>

      {collections.isPending ? (
        <PageLoader />
      ) : collections.isError ? (
        <ErrorState error={collections.error} onRetry={() => collections.refetch()} />
      ) : (collections.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Layers size={22} strokeWidth={1.75} />} title="هنوز مجموعه‌ای ساخته نشده" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(collections.data ?? []).map((collection) => (
            <li key={collection.slug}>
              <Link to={`/collections/${encodeURIComponent(collection.slug)}`} className={`${cardClass} block h-full p-5 transition-colors hover:border-line-strong`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{collection.name}</span>
                  <span className="text-xs tabular-nums text-ink-muted">{formatNumber(collection.productCount)} محصول</span>
                </span>
                {collection.description && <span className="mt-1 block text-[13px] leading-6 text-ink-muted">{collection.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function CollectionPage() {
  const { slug = '' } = useParams()
  const feed = useCollectionProducts(slug)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const votes = useMyVotes(products.map((p) => p.id))
  const saved = useMySavedIds(products.map((p) => p.id))
  const collections = useCollections()
  const meta = collections.data?.find((collection) => collection.slug === slug)
  useDocumentMeta(meta?.name ?? 'مجموعه')

  return (
    <section aria-labelledby="collection-heading" className="mx-auto max-w-3xl space-y-5">
      <div>
        <ButtonLink to="/collections" variant="ghost" size="sm" className="mb-2">
          همه‌ی مجموعه‌ها
        </ButtonLink>
        <h1 id="collection-heading" className="text-2xl font-extrabold">
          {meta?.name ?? 'مجموعه'}
        </h1>
        {meta?.description && <p className="mt-1 text-sm text-ink-muted">{meta.description}</p>}
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState icon={<Layers size={22} strokeWidth={1.75} />} title="این مجموعه خالی است" />
        ) : (
          <ol aria-label="محصولات مجموعه">
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
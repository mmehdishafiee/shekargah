import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bookmark, Layers, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import {
  useCollection,
  useCollectionItems,
  useCollectionProducts,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useMyCollections,
  useMySavedIds,
  useMyVotes,
  useSavedCollections,
} from '@/data/queries'
import type { ProductSummary, UserCollection } from '@/data/types'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { CollectionCard } from '@/components/collection/CollectionCard'
import { SaveCollectionButton } from '@/components/collection/SaveCollectionButton'
import { ProductRow } from '@/components/product/ProductRow'
import { ProductLogo } from '@/components/product/ProductLogo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, PageLoader, ProductRowSkeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass, inputClass } from '@/components/ui/styles'

function CreateCollectionForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateCollection()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | undefined>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return setError('نام مجموعه باید دست‌کم ۲ نویسه باشد.')
    if (trimmed.length > 60) return setError('نام مجموعه حداکثر ۶۰ نویسه است.')
    setError(undefined)
    try {
      const slug = await create.mutateAsync({ name: trimmed, description: description.trim() || null, isPublic: true })
      toast.success('مجموعه ساخته شد. حالا محصول اضافه کن.')
      navigate(`/collections/${encodeURIComponent(slug)}`)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <form onSubmit={submit} className={`${cardClass} space-y-3 p-5`}>
      <h2 className="text-base font-bold">مجموعه‌ی تازه بساز</h2>
      <p className="text-[13px] leading-6 text-ink-muted">
        مثلاً «بهترین ابزارهای مشاهده‌ی قیمت». مجموعه یک لینک عمومی دارد و در پروفایلت نمایش داده می‌شود.
      </p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="نام مجموعه"
        maxLength={60}
        className={inputClass}
        aria-label="نام مجموعه"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="توضیح کوتاه (اختیاری)"
        maxLength={300}
        rows={2}
        className={`${inputClass} py-2`}
        aria-label="توضیح مجموعه"
      />
      {error && <p className="text-xs text-danger-700">{error}</p>}
      <Button type="submit" size="sm" loading={create.isPending} icon={<Plus size={16} strokeWidth={1.75} aria-hidden />}>
        ساخت مجموعه
      </Button>
    </form>
  )
}

function MyCollectionRow({ collection }: { collection: UserCollection }) {
  const toast = useToast()
  const remove = useDeleteCollection(collection.slug)
  const [confirming, setConfirming] = useState(false)

  const onDelete = async () => {
    await remove.mutateAsync(collection.id)
    toast.success('مجموعه حذف شد.')
  }

  return (
    <li className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <CollectionCard collection={collection} showOwner={false} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 size={15} strokeWidth={1.75} />}
        aria-label={`حذف ${collection.name}`}
        onClick={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف مجموعه"
        description={`«${collection.name}» و فهرست محصولاتش حذف می‌شود. محصول‌ها خودشان پاک نمی‌شوند.`}
        confirmLabel="حذف"
        tone="danger"
        onConfirm={onDelete}
      />
    </li>
  )
}

export function CollectionsPage() {
  useDocumentMeta('مجموعه‌ها')
  const { session } = useAuth()
  const collections = useCollections()
  const mine = useMyCollections()
  const saved = useSavedCollections()

  return (
    <section aria-labelledby="collections-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="collections-heading" className="text-2xl font-extrabold">
          مجموعه‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">فهرست‌های دستچین‌شده از محصولات، برای پیدا کردن سریع‌تر.</p>
      </div>

      {session && <CreateCollectionForm />}

      {session && (mine.data ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">مجموعه‌های من</h2>
          <ul className="space-y-3">
            {(mine.data ?? []).map((collection) => (
              <MyCollectionRow key={collection.id} collection={collection} />
            ))}
          </ul>
        </div>
      )}

      {session && (saved.data ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Bookmark size={18} strokeWidth={1.75} aria-hidden />
            مجموعه‌های ذخیره‌شده
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(saved.data ?? []).map((collection) => (
              <li key={collection.id}>
                <CollectionCard collection={collection} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-bold">همه‌ی مجموعه‌ها</h2>
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
                <Link
                  to={`/collections/${encodeURIComponent(collection.slug)}`}
                  className={`${cardClass} block h-full p-5 transition-colors hover:border-line-strong`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{collection.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatNumber(collection.productCount)} محصول</span>
                  </span>
                  {collection.description && (
                    <span className="mt-1 block text-[13px] leading-6 text-ink-muted">{collection.description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function AddProductsPanel({ collectionId, slug }: { collectionId: string; slug: string }) {
  const api = useApi()
  const { add } = useCollectionItems(collectionId, slug)
  const [term, setTerm] = useState('')
  const search = useQuery({
    queryKey: ['collection-search', term],
    queryFn: () => api.listProducts({ search: term, sort: 'popular', page: 0 }),
    enabled: term.trim().length >= 2,
  })

  const results: ProductSummary[] = search.data?.items ?? []

  return (
    <div className={`${cardClass} p-5`}>
      <h2 className="text-base font-bold">افزودن محصول</h2>
      <div className="relative mt-3">
        <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="نام محصول را جست‌وجو کن…"
          className={`${inputClass} ps-9`}
          aria-label="جست‌وجوی محصول برای افزودن"
        />
      </div>
      {term.trim().length >= 2 && (
        <div className="mt-3">
          {search.isPending ? (
            <p className="text-sm text-ink-muted">در حال جست‌وجو…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-ink-muted">محصولی پیدا نشد.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {results.slice(0, 8).map((product) => (
                <li key={product.id} className="flex items-center gap-3 py-2.5">
                  <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span>
                  <Button variant="secondary" size="sm" loading={add.isPending} onClick={() => add.mutate(product.id)}>
                    افزودن
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {add.isError && <p className="mt-2 text-xs text-danger-700">{errorMessage(add.error)}</p>}
    </div>
  )
}

export function CollectionPage() {
  const { slug = '' } = useParams()
  const { session } = useAuth()
  const feed = useCollectionProducts(slug)
  const meta = useCollection(slug)
  const { remove } = useCollectionItems(meta.data?.id, slug)
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const votes = useMyVotes(products.map((p) => p.id))
  const saved = useMySavedIds(products.map((p) => p.id))
  useDocumentMeta(meta.data?.name ?? 'مجموعه', meta.data?.description ?? undefined)

  const collection = meta.data

  return (
    <section aria-labelledby="collection-heading" className="mx-auto max-w-3xl space-y-5">
      <div>
        <ButtonLink to="/collections" variant="ghost" size="sm" className="mb-2">
          همه‌ی مجموعه‌ها
        </ButtonLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="collection-heading" className="text-2xl font-extrabold">
              {collection?.name ?? 'مجموعه'}
            </h1>
            {collection?.description && <p className="mt-1 text-sm leading-7 text-ink-muted">{collection.description}</p>}
            {collection?.owner && (
              <p className="mt-2 text-[13px] text-ink-muted">
                ساخته‌ی{' '}
                <Link to={`/u/${encodeURIComponent(collection.owner.username)}`} className="font-semibold text-brand-700 hover:underline">
                  {collection.owner.displayName}
                </Link>
                {' · '}
                {formatNumber(collection.productCount)} محصول · {formatNumber(collection.saveCount)} ذخیره
              </p>
            )}
          </div>
          {collection && session && <SaveCollectionButton collection={collection} />}
        </div>
      </div>

      {collection?.isOwner && <AddProductsPanel collectionId={collection.id} slug={slug} />}

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
          <EmptyState
            icon={<Layers size={22} strokeWidth={1.75} />}
            title="این مجموعه خالی است"
            description={collection?.isOwner ? 'از کادر بالا محصول اضافه کن.' : undefined}
          />
        ) : (
          <ol aria-label="محصولات مجموعه">
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} />
                </div>
                {collection?.isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X size={15} strokeWidth={1.75} />}
                    aria-label={`حذف ${product.name} از مجموعه`}
                    onClick={() => remove.mutate(product.id)}
                  />
                )}
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
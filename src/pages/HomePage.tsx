import { useSearchParams } from 'react-router'
import { PackageSearch, Plus } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useCategories, useMyVotes, useProductFeed } from '@/data/queries'
import type { SortOrder } from '@/data/types'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductRow } from '@/components/product/ProductRow'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'popular', label: 'محبوب‌ترین' },
  { value: 'newest', label: 'تازه‌ترین' },
]

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
    active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
  }`

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const sort: SortOrder = params.get('sort') === 'newest' ? 'newest' : 'popular'
  const category = params.get('category') ?? ''
  const search = params.get('q')?.trim() ?? ''

  const categories = useCategories()
  const feed = useProductFeed({ sort, category: category || undefined, search: search || undefined })
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const votes = useMyVotes(products.map((p) => p.id))

  const activeCategory = categories.data?.find((c) => c.slug === category)
  const heading = search ? `نتیجه‌های «${search}»` : (activeCategory?.name ?? 'کشف محصولات تازه')
  useDocumentMeta(search ? `جست‌وجوی «${search}»` : activeCategory?.name, activeCategory?.description ?? undefined)

  const update = (key: 'sort' | 'category' | 'q', value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
  const clearFilters = () => setParams(sort === 'newest' ? { sort } : {})

  return (
    <div className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-labelledby="feed-heading" className="min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="feed-heading" className="text-2xl font-extrabold leading-tight">
              {heading}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {search || activeCategory
                ? feed.isSuccess && `${formatNumber(total)} محصول`
                : 'استارتاپ‌ها، اپلیکیشن‌ها و پروژه‌های متن‌باز تازه را ببین و به بهترین‌ها رأی بده.'}
            </p>
          </div>
          <div role="group" aria-label="مرتب‌سازی" className="flex rounded-full bg-sunken p-1">
            {SORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={sort === option.value}
                onClick={() => update('sort', option.value === 'popular' ? null : option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  sort === option.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="دسته‌بندی‌ها" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <button type="button" aria-pressed={!category} onClick={() => update('category', null)} className={chipClass(!category)}>
            همه
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.slug}
              onClick={() => update('category', category === c.slug ? null : c.slug)}
              className={chipClass(category === c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {search && (
          <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
            <span>
              جست‌وجو برای <bdi className="font-semibold text-ink">«{search}»</bdi>
            </span>
            <button type="button" onClick={() => update('q', null)} className="font-semibold text-brand-700 hover:underline">
              پاک کردن
            </button>
          </div>
        )}

        <div className={`${cardClass} p-1.5 sm:p-2`}>
          {feed.isPending ? (
            <div aria-busy="true" aria-label="در حال بارگذاری محصولات">
              {Array.from({ length: 6 }, (_, i) => (
                <ProductRowSkeleton key={i} />
              ))}
            </div>
          ) : feed.isError && products.length === 0 ? (
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} title="فهرست محصولات بارگذاری نشد" />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={22} strokeWidth={1.75} />}
              title={search ? 'محصولی پیدا نشد' : 'هنوز محصولی در این دسته منتشر نشده'}
              description={
                search ? 'عبارت دیگری را امتحان کن یا فیلترها را بردار.' : 'اگر محصولی در این دسته می‌شناسی، معرفی‌اش کن.'
              }
              action={
                search || category ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    برداشتن فیلترها
                  </Button>
                ) : (
                  <ButtonLink to="/submit">معرفی محصول</ButtonLink>
                )
              }
            />
          ) : (
            <ol aria-label="فهرست محصولات" className={`transition-opacity ${feed.isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={feed.isFetching}>
              {products.map((product, index) => (
                <li key={product.id}>
                  <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} rank={sort === 'popular' ? index + 1 : undefined} />
                </li>
              ))}
            </ol>
          )}
        </div>

        {feed.hasNextPage && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button variant="secondary" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
              نمایش محصولات بیشتر
            </Button>
            <p className="text-xs text-ink-muted">
              {formatNumber(products.length)} از {formatNumber(total)} محصول
            </p>
          </div>
        )}
      </section>

      <Sidebar />
    </div>
  )
}

function Sidebar() {
  const { session } = useAuth()
  return (
    <aside className="mt-8 space-y-4 lg:mt-[4.25rem]">
      <div className={`${cardClass} p-5`}>
        <h2 className="text-base font-bold">محصولی ساخته‌ای؟</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          محصولت را معرفی کن تا بعد از بررسی، در شکارگاه دیده شود و رأی بگیرد. ثبت محصول رایگان است.
        </p>
        <ButtonLink to={session ? '/submit' : '/signup'} className="mt-4 w-full" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>
          معرفی محصول
        </ButtonLink>
      </div>
      <div className="rounded-card border border-line/70 p-5">
        <h2 className="text-sm font-bold">مسیر انتشار یک محصول</h2>
        <ol className="mt-3 space-y-3 text-sm text-ink-muted">
          {[
            ['ثبت', 'سازنده نام، توضیح، لینک و دسته‌بندی را ثبت می‌کند.'],
            ['بررسی', 'مدیران درستی اطلاعات و رعایت قوانین را بررسی می‌کنند.'],
            ['انتشار', 'محصول در فهرست قرار می‌گیرد و کاربران به آن رأی می‌دهند.'],
          ].map(([title, text], index) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {formatNumber(index + 1)}
              </span>
              <span>
                <span className="font-semibold text-ink">{title}: </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}

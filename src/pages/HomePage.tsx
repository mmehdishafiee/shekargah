import { Link, useSearchParams } from 'react-router'
import { PackageSearch, Plus } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useCategories, useDailyWinners, useMySavedIds, useMyVotes, useProductFeed, useSiteStats, useSponsors, useTopics, useTopMakers } from '@/data/queries'
import type { ProductSummary, SortOrder } from '@/data/types'
import { formatDay, formatIsoDay, formatNumber } from '@/lib/format'
import { tehranDateLabel } from '@/lib/engagement'
import { useDocumentMeta, websiteSchema } from '@/lib/useDocumentMeta'
import { profilePath } from '@/lib/paths'
import { ProductRow } from '@/components/product/ProductRow'
import { Avatar } from '@/components/ui/Avatar'
import { NewsletterSignup } from '@/components/layout/NewsletterSignup'
import { SponsorCard } from '@/components/product/SponsorCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'popular', label: 'محبوب‌ترین' },
  { value: 'newest', label: 'تازه‌ترین' },
]

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
    active ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
  }`

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const sort: SortOrder = params.get('sort') === 'newest' ? 'newest' : 'popular'
  const category = params.get('category') ?? ''
  const search = params.get('q')?.trim() ?? ''
  const tag = params.get('tag')?.trim() ?? ''

  const categories = useCategories()
  const feed = useProductFeed({ sort, category: category || undefined, search: search || undefined, tags: tag ? [tag] : undefined })
  const products = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  // The home page shows the daily winners *and* the feed, so the vote/save
  // state must be fetched for both sets of products.
  const winners = useDailyWinners(7, 5)
  const winnerIds = (winners.data ?? []).flatMap((group) => group.items.map((item) => item.id))
  const stateIds = [...new Set([...products.map((p) => p.id), ...winnerIds])]
  const votes = useMyVotes(stateIds)
  const saved = useMySavedIds(stateIds)
  const sponsors = useSponsors()
  const stats = useSiteStats()
  const hotTopics = useTopics()
  const topMakers = useTopMakers()
  // The default home view is the day-by-day winners list, like a daily digest.
  const isBrowsing = Boolean(search) || Boolean(category) || Boolean(tag)

  const activeCategory = categories.data?.find((c) => c.slug === category)
  const heading = search
    ? `نتیجه‌های «${search}»`
    : tag
      ? `محصولات با برچسب «${tag}»`
      : (activeCategory?.name ?? 'کشف محصولات تازه')
  useDocumentMeta(search ? `جست‌وجوی «${search}»` : activeCategory?.name, activeCategory?.description ?? undefined, {
    path: '/',
    schema: search ? undefined : websiteSchema(),
    robots: search ? 'noindex, follow' : undefined,
  })

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
            {!search && !activeCategory && (
              <p className="mt-1 text-[13px] text-ink-faint">
                {formatIsoDay(tehranDateLabel())}
                {stats.data && (
                  <>
                    {' · '}
                    {formatNumber(stats.data.products)} محصول، {formatNumber(stats.data.makers)} سازنده و{' '}
                    {formatNumber(stats.data.votes)} رأی
                  </>
                )}
              </p>
            )}
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

        {!isBrowsing && (
          <DailyWinners
            groups={winners.data ?? []}
            loading={winners.isPending}
            error={winners.error}
            onRetry={() => winners.refetch()}
            votes={votes.data}
            saved={saved.data}
          />
        )}

        {isBrowsing && (
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
                search || category || tag ? (
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
                  <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} rank={sort === 'popular' ? index + 1 : undefined} />
                </li>
              ))}
            </ol>
          )}
        </div>

        )}

        {isBrowsing && feed.hasNextPage && (
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

      <Sidebar
        sponsors={sponsors.data ?? []}
        stats={stats.data ?? null}
        topics={(hotTopics.data ?? []).filter((topic) => topic.productCount > 0).slice(0, 8)}
        makers={(topMakers.data?.pages[0]?.items ?? []).slice(0, 5)}
      />
    </div>
  )
}

/** The home page's core surface: each recent day with its top products. */
function DailyWinners({
  groups,
  loading,
  error,
  onRetry,
  votes,
  saved,
}: {
  groups: { day: string; items: (ProductSummary & { rank: number })[] }[]
  loading: boolean
  error: unknown
  onRetry: () => void
  votes: Set<string> | undefined
  saved: Set<string> | undefined
}) {
  if (loading) {
    return (
      <div className={`${cardClass} p-1.5 sm:p-2`} aria-busy="true" aria-label="در حال بارگذاری محصولات">
        {Array.from({ length: 6 }, (_, index) => (
          <ProductRowSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cardClass}>
        <ErrorState error={error} onRetry={onRetry} title="فهرست محصولات بارگذاری نشد" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState
          icon={<PackageSearch size={22} strokeWidth={1.75} />}
          title="هنوز محصولی منتشر نشده"
          description="اگر محصولی می‌شناسی، معرفی‌اش کن تا اولی باشی."
          action={<ButtonLink to="/submit">معرفی محصول</ButtonLink>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {groups.map((group, groupIndex) => (
        <section key={group.day} aria-labelledby={`day-${group.day}`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`day-${group.day}`} className="text-lg font-extrabold">
              {groupIndex === 0 ? 'محصولات امروز' : `برترین‌های ${formatDay(group.day)}`}
            </h2>
            <p className="text-[13px] text-ink-muted">{formatDay(group.day)}</p>
          </div>
          <div className={`${cardClass} p-1.5 sm:p-2`}>
            <ol aria-label={`محصولات ${formatDay(group.day)}`}>
              {group.items.map((product) => (
                <li key={product.id}>
                  <ProductRow product={product} voted={votes?.has(product.id) ?? false} saved={saved?.has(product.id) ?? false} rank={product.rank} />
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  )
}

function Sidebar({
  sponsors,
  stats,
  topics,
  makers,
}: {
  sponsors: { id: string; name: string; tagline: string | null; url: string; logoUrl: string | null }[]
  stats: { products: number; makers: number; votes: number } | null
  topics: { slug: string; name: string; productCount: number }[]
  makers: { id: string; username: string; displayName: string; avatarUrl: string | null; productCount: number; votesTotal: number }[]
}) {
  const { session } = useAuth()
  return (
    <aside className="mt-8 space-y-4 lg:mt-[4.25rem]">
      <div className={`${cardClass} p-5`}>
        <NewsletterSignup />
      </div>
      <div className={`${cardClass} p-5`}>
        <h2 className="text-base font-bold">محصولی ساخته‌ای؟</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          محصولت را معرفی کن تا بعد از بررسی، در شکارگاه دیده شود و رأی بگیرد. اگر آن را نساخته‌ای ولی کشف کرده‌ای،
          به‌عنوان شکارچی ثبتش کن.
        </p>
        {stats && (
          <p className="mt-2 text-[13px] text-ink-faint">
            {formatNumber(stats.products)} محصول، {formatNumber(stats.makers)} سازنده و {formatNumber(stats.votes)} رأی تا امروز.
          </p>
        )}
        <ButtonLink to={session ? '/submit' : '/signup'} className="mt-4 w-full" icon={<Plus size={18} strokeWidth={2} aria-hidden />}>
          {session ? 'معرفی محصول' : 'ساخت حساب و معرفی محصول'}
        </ButtonLink>
      </div>

      {topics.length > 0 && (
        <div className={`${cardClass} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">موضوع‌های داغ</h2>
            <Link to="/topics" className="text-[13px] font-semibold text-brand-700 hover:underline">
              همه
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li key={topic.slug}>
                <Link
                  to={`/?category=${encodeURIComponent(topic.slug)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] transition-colors hover:border-line-strong"
                >
                  <span>{topic.name}</span>
                  <span className="tabular-nums text-ink-muted">{formatNumber(topic.productCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {makers.length > 0 && (
        <div className={`${cardClass} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">سازندگان برتر</h2>
            <Link to="/makers" className="text-[13px] font-semibold text-brand-700 hover:underline">
              همه
            </Link>
          </div>
          <ul className="mt-3 space-y-2.5">
            {makers.map((maker) => (
              <li key={maker.id}>
                <Link to={profilePath(maker.username)} className="flex items-center gap-2.5 rounded-lg hover:opacity-80">
                  <Avatar name={maker.displayName} seed={maker.id} url={maker.avatarUrl} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{maker.displayName}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {formatNumber(maker.productCount)} محصول · {formatNumber(maker.votesTotal)} رأی
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
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
    {sponsors.length > 0 && (
        <div className="space-y-3">
          <h2 className="px-1 text-sm font-bold">حامیان شکارگاه</h2>
          {sponsors.map((sponsor) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      )}
    </aside>
  )
}

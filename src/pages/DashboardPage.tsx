import { Link } from 'react-router'
import { Bell, Bookmark, Inbox, Package, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useMakerProducts, useSavedProducts, useUnreadNotifications } from '@/data/queries'
import { formatDate, formatNumber } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductLogo } from '@/components/product/ProductLogo'
import { StatusBadge } from '@/components/product/StatusBadge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

/** Personal overview: my submissions, saves and unread activity. */
export function DashboardPage() {
  useDocumentMeta('داشبورد من')
  const { profile } = useAuth()
  const products = useMakerProducts(profile?.id)
  const saved = useSavedProducts()
  const unread = useUnreadNotifications()

  if (!profile) return <PageLoader />

  const published = products.data?.filter((product) => product.status === 'published') ?? []
  const pending = products.data?.filter((product) => product.status === 'pending') ?? []
  const votesReceived = published.reduce((total, product) => total + product.votesCount, 0)
  const savedItems = saved.data?.pages.flatMap((page: { items: { id: string; slug: string; name: string; logoUrl: string | null }[] }) => page.items) ?? []

  return (
    <section aria-labelledby="dashboard-heading" className="mx-auto max-w-4xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="dashboard-heading" className="text-2xl font-extrabold">
            داشبورد من
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            خوش آمدی {profile.displayName}. نمای کلی محصولات، ذخیره‌ها و اعلان‌هایت.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to={profilePath(profile.username)} variant="secondary" size="sm">
            پروفایل عمومی
          </ButtonLink>
          <ButtonLink to="/submit" size="sm">
            معرفی محصول
          </ButtonLink>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Package size={18} strokeWidth={1.75} />} label="محصولات منتشرشده" value={published.length} to="/dashboard" />
        <StatCard icon={<ThumbsUp size={18} strokeWidth={1.75} />} label="رأی دریافت‌شده" value={votesReceived} to="/leaderboard" />
        <StatCard icon={<Bookmark size={18} strokeWidth={1.75} />} label="ذخیره‌شده‌ها" value={savedItems.length} to="/saved" />
        <StatCard icon={<Bell size={18} strokeWidth={1.75} />} label="اعلان خوانده‌نشده" value={unread.data ?? 0} to="/notifications" />
      </div>

      <div>
        <h2 className="text-lg font-bold">ارسال‌های من</h2>
        <div className={`${cardClass} mt-3 p-1.5 sm:p-2`}>
          {products.isPending ? (
            <PageLoader />
          ) : (products.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Package size={22} strokeWidth={1.75} />}
              title="هنوز محصولی معرفی نکرده‌ای"
              action={<ButtonLink to="/submit">معرفی اولین محصول</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {(products.data ?? []).map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-3 py-3">
                  <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={productPath(product.slug)} className="truncate font-bold hover:underline">
                        {product.name}
                      </Link>
                      <StatusBadge status={product.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-muted">{product.tagline}</p>
                  </div>
                  <span className="shrink-0 text-[13px] text-ink-muted">
                    {product.status === 'published' ? `${formatNumber(product.votesCount)} رأی` : formatDate(product.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pending.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Inbox size={14} strokeWidth={1.75} aria-hidden />
            {formatNumber(pending.length)} محصول در صف بررسی است.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold">ذخیره‌شده‌ها</h2>
        <div className={`${cardClass} mt-3 p-1.5 sm:p-2`}>
          {savedItems.length === 0 ? (
            <EmptyState icon={<Bookmark size={22} strokeWidth={1.75} />} title="چیزی ذخیره نکرده‌ای" description="محصول‌ها را ذخیره کن تا بعداً راحت پیدایشان کنی." />
          ) : (
            <ul className="divide-y divide-line/70">
              {savedItems.slice(0, 5).map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-3 py-3">
                  <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={40} />
                  <Link to={productPath(product.slug)} className="min-w-0 flex-1 truncate font-bold hover:underline">
                    {product.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className={`${cardClass} flex items-center gap-3 p-4 transition-colors hover:border-line-strong`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xl font-extrabold tabular-nums">{formatNumber(value)}</span>
        <span className="block truncate text-[13px] text-ink-muted">{label}</span>
      </span>
    </Link>
  )
}
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AtSign, Briefcase, CalendarDays, Code2, Globe, Layers, MessageSquare, MessageSquareQuote, Package, Send, Settings, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import {
  useFollowCounts,
  useMakerProducts,
  useMySavedIds,
  useMyVotes,
  useProfileByUsername,
  useProfileCollections,
  useProfileComments,
  useProfileReviews,
} from '@/data/queries'
import type { Product, ProfileComment, ProfileReview } from '@/data/types'
import { formatDate, formatNumber } from '@/lib/format'
import { productPath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductLogo } from '@/components/product/ProductLogo'
import { ProductRow } from '@/components/product/ProductRow'
import { StatusBadge } from '@/components/product/StatusBadge'
import { RatingStars } from '@/components/product/RatingStars'
import { FollowButton } from '@/components/profile/FollowButton'
import { CollectionCard } from '@/components/collection/CollectionCard'
import { Avatar } from '@/components/ui/Avatar'
import { BidiText } from '@/components/ui/BidiText'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

type Tab = 'all' | 'made' | 'hunted' | 'comments' | 'reviews'

/** Social links a member chose to publish. */
function ProfileLinks({ profile }: { profile: { websiteUrl: string | null; xUsername: string | null; telegramUsername: string | null; linkedinUsername: string | null; githubUsername: string | null } }) {
  const links = [
    profile.websiteUrl && { href: profile.websiteUrl, label: 'وبسایت', icon: Globe, text: null },
    profile.xUsername && { href: `https://x.com/${profile.xUsername}`, label: 'ایکس', icon: AtSign, text: `@${profile.xUsername}` },
    profile.telegramUsername && { href: `https://t.me/${profile.telegramUsername}`, label: 'تلگرام', icon: Send, text: `@${profile.telegramUsername}` },
    profile.linkedinUsername && { href: `https://www.linkedin.com/in/${profile.linkedinUsername}`, label: 'لینکدین', icon: Briefcase, text: profile.linkedinUsername },
    profile.githubUsername && { href: `https://github.com/${profile.githubUsername}`, label: 'گیت‌هاب', icon: Code2, text: profile.githubUsername },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe; text: string | null }[]

  if (links.length === 0) return null

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer nofollow me"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <link.icon size={13} strokeWidth={1.75} aria-hidden />
            <span className="ltr">{link.text ?? link.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-sunken px-3 py-2 text-center">
      <span className="block text-lg font-extrabold leading-tight text-ink">{value}</span>
      <span className="block text-[12px] text-ink-muted">{label}</span>
    </div>
  )
}

/** A product link shared by the comment and review rows. */
function ActivityProductLink({ product }: { product: { slug: string; name: string } }) {
  return (
    <Link to={productPath(product.slug)} className="text-sm font-bold hover:underline">
      {product.name}
    </Link>
  )
}

function ProfileCommentRow({ comment }: { comment: ProfileComment }) {
  if (!comment.product) return null
  return (
    <li className="px-4 py-3.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
        <MessageSquare size={14} strokeWidth={1.75} aria-hidden />
        <span>روی</span>
        <ActivityProductLink product={comment.product} />
        <span className="text-ink-faint">·</span>
        <span>{formatDate(comment.createdAt)}</span>
      </p>
      <BidiText className="mt-1.5 break-words text-[15px] leading-7" text={comment.body} />
    </li>
  )
}

function ProfileReviewRow({ review }: { review: ProfileReview }) {
  if (!review.product) return null
  return (
    <li className="px-4 py-3.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
        <MessageSquareQuote size={14} strokeWidth={1.75} aria-hidden />
        <span>نقد</span>
        <ActivityProductLink product={review.product} />
        <RatingStars value={review.rating} size={13} />
        <span className="text-ink-faint">·</span>
        <span>{formatDate(review.createdAt)}</span>
      </p>
      {review.body && <BidiText className="mt-1.5 break-words text-[15px] leading-7" text={review.body} />}
    </li>
  )
}

export function ProfilePage() {
  const { username = '' } = useParams()
  const profile = useProfileByUsername(username)
  const { session } = useAuth()
  const products = useMakerProducts(profile.data?.id)
  const followCounts = useFollowCounts(profile.data?.id)
  const collections = useProfileCollections(profile.data?.id)
  const profileComments = useProfileComments(profile.data?.id)
  const profileReviews = useProfileReviews(profile.data?.id)
  const published = products.data?.filter((p) => p.status === 'published') ?? []
  const unpublished = products.data?.filter((p) => p.status !== 'published') ?? []
  // A member can both build products and discover other people's, so the two
  // are counted and labelled separately.
  const hunted = published.filter((p) => p.creditRole === 'hunter')
  const made = published.filter((p) => p.creditRole === 'maker')
  const totalVotes = published.reduce((sum, p) => sum + p.votesCount, 0)
  const [tab, setTab] = useState<Tab>('all')
  const shown = tab === 'made' ? made : tab === 'hunted' ? hunted : published
  const votes = useMyVotes(published.map((p) => p.id))
  const saved = useMySavedIds(published.map((p) => p.id))
  useDocumentMeta(profile.data?.displayName ?? (profile.isSuccess ? 'کاربر پیدا نشد' : undefined), profile.data?.bio ?? undefined)

  if (profile.isPending) return <PageLoader />
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  if (!profile.data) {
    return (
      <EmptyState
        icon={<UserX size={22} strokeWidth={1.75} />}
        title="کاربری با این نام پیدا نشد"
        action={<ButtonLink to="/">بازگشت به صفحه‌ی اصلی</ButtonLink>}
      />
    )
  }

  const user = profile.data
  const isSelf = session?.userId === user.id

  const HEADINGS: Record<Tab, string> = {
    all: 'محصولات',
    made: 'محصولات ساختهشده',
    hunted: 'محصولات شکارشده',
    comments: 'کامنتها',
    reviews: 'نقدها',
  }
  const EMPTY: Record<Tab, string> = {
    all: 'هنوز محصول منتشرشدهای ندارد',
    made: 'هنوز محصولی نساخته است',
    hunted: 'هنوز محصولی شکار نکرده است',
    comments: 'هنوز کامنتی ننوشته است',
    reviews: 'هنوز نقدی ننوشته است',
  }
  const comments = (profileComments.data ?? []).filter((comment) => comment.product)
  const reviews = (profileReviews.data ?? []).filter((review) => review.product)

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: 'محصولات', count: published.length },
    { value: 'made', label: 'ساخته', count: made.length },
    { value: 'hunted', label: 'شکار', count: hunted.length },
    { value: 'comments', label: 'کامنتها', count: comments.length },
    { value: 'reviews', label: 'نقدها', count: reviews.length },
  ]

  const activityCount = published.length + comments.length + reviews.length
  const showActivityTabs = activityCount > 0 || profileComments.isSuccess || profileReviews.isSuccess

  const activityEmpty = (
    <EmptyState
      icon={
        tab === 'comments' ? <MessageSquare size={22} strokeWidth={1.75} /> : tab === 'reviews' ? <MessageSquareQuote size={22} strokeWidth={1.75} /> : <Package size={22} strokeWidth={1.75} />
      }
      title={EMPTY[tab]}
      action={isSelf && (tab === 'all' || tab === 'made' || tab === 'hunted') ? <ButtonLink to="/submit">معرفی محصول</ButtonLink> : undefined}
    />
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className={`${cardClass} overflow-hidden`}>
        <div className="h-28 bg-linear-to-l from-brand-100 via-brand-50 to-surface" aria-hidden />
        <div className="p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="w-fit rounded-full bg-surface p-1 shadow-card ring-1 ring-line">
              <Avatar name={user.displayName} seed={user.id} url={user.avatarUrl} size={88} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
                {user.displayName}
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-bold text-brand-700">
                    <ShieldCheck size={13} strokeWidth={2} aria-hidden />
                    مدیر
                  </span>
                )}
              </h1>
              <p className="ltr mt-0.5 text-start text-sm text-ink-muted">@{user.username}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                <span>
                  <b className="font-bold text-ink">{formatNumber(followCounts.data?.followers ?? 0)}</b> دنبال‌کننده
                </span>
                <span>
                  <b className="font-bold text-ink">{formatNumber(followCounts.data?.following ?? 0)}</b> دنبال‌شده
                </span>
              </p>
            </div>
            {isSelf ? (
              <ButtonLink to="/settings" variant="secondary" size="sm" icon={<Settings size={16} strokeWidth={1.75} aria-hidden />}>
                ویرایش پروفایل
              </ButtonLink>
            ) : (
              <FollowButton profileId={user.id} username={user.username} />
            )}
          </div>

          {user.bio && <p className="bidi mt-4 max-w-prose whitespace-pre-line text-[15px] leading-7">{user.bio}</p>}
          <ProfileLinks profile={user} />

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line/70 pt-4 sm:max-w-md">
            <ProfileStat label="ساخته" value={formatNumber(made.length)} />
            <ProfileStat label="شکار" value={formatNumber(hunted.length)} />
            <ProfileStat label="رأی گرفته" value={formatNumber(totalVotes)} />
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <CalendarDays size={15} strokeWidth={1.75} aria-hidden />
            عضو از {formatDate(user.createdAt)}
          </p>
        </div>
      </header>

      {(collections.data ?? []).length > 0 || (isSelf && collections.isSuccess) ? (
        <section aria-labelledby="collections-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="collections-heading" className="text-lg font-bold">
              مجموعه‌ها
              {collections.isSuccess && <span className="ms-1.5 font-medium text-ink-muted">({formatNumber(collections.data.length)})</span>}
            </h2>
            {isSelf && (
              <ButtonLink to="/collections" size="sm" variant="secondary" icon={<Layers size={15} strokeWidth={1.75} aria-hidden />}>
                ساخت مجموعه
              </ButtonLink>
            )}
          </div>
          {(collections.data ?? []).length === 0 ? (
            <div className={`${cardClass} mt-4`}>
              <EmptyState
                icon={<Layers size={22} strokeWidth={1.75} />}
                title="هنوز مجموعه‌ای نساخته"
                description="لیست‌هایی مثل «بهترین ابزارهای مشاهده‌ی قیمت» بساز و با بقیه به اشتراک بگذار."
                action={isSelf ? <ButtonLink to="/collections">ساخت مجموعه</ButtonLink> : undefined}
              />
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {(collections.data ?? []).map((collection) => (
                <li key={collection.id}>
                  <CollectionCard collection={collection} showOwner={false} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {isSelf && unpublished.length > 0 && (
        <section aria-labelledby="private-heading">
          <h2 id="private-heading" className="text-lg font-bold">
            ارسال‌های منتشرنشده
          </h2>
          <p className="mt-1 text-sm text-ink-muted">این بخش فقط برای خودت نمایش داده می‌شود.</p>
          <ul className={`${cardClass} mt-4 divide-y divide-line/70`}>
            {unpublished.map((product) => (
              <PrivateSubmission key={product.id} product={product} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="activity-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="activity-heading" className="text-lg font-bold">
            {HEADINGS[tab]}
            <span className="ms-1.5 font-medium text-ink-muted">
              ({formatNumber(tab === 'comments' ? comments.length : tab === 'reviews' ? reviews.length : shown.length)})
            </span>
          </h2>
          {isSelf && (
            <ButtonLink to="/submit" size="sm" variant="secondary">
              معرفی محصول
            </ButtonLink>
          )}
        </div>
        {showActivityTabs && (
          <div role="group" aria-label="نوع فعالیت" className="mt-3 flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1 [scrollbar-width:none]">
            {TABS.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label} {formatNumber(count)}
              </button>
            ))}
          </div>
        )}
        <div className={`${cardClass} mt-4 ${tab === 'comments' || tab === 'reviews' ? '' : 'p-1.5 sm:p-2'}`}>
          {tab === 'comments' ? (
            profileComments.isPending ? (
              <div className="flex justify-center py-10 text-ink-muted">
                <Spinner label="در حال بارگذاری کامنتها" />
              </div>
            ) : profileComments.isError ? (
              <ErrorState error={profileComments.error} onRetry={() => profileComments.refetch()} />
            ) : comments.length === 0 ? (
              activityEmpty
            ) : (
              <ul className="divide-y divide-line/70">
                {comments.map((comment) => (
                  <ProfileCommentRow key={comment.id} comment={comment} />
                ))}
              </ul>
            )
          ) : tab === 'reviews' ? (
            profileReviews.isPending ? (
              <div className="flex justify-center py-10 text-ink-muted">
                <Spinner label="در حال بارگذاری نقدها" />
              </div>
            ) : profileReviews.isError ? (
              <ErrorState error={profileReviews.error} onRetry={() => profileReviews.refetch()} />
            ) : reviews.length === 0 ? (
              activityEmpty
            ) : (
              <ul className="divide-y divide-line/70">
                {reviews.map((review) => (
                  <ProfileReviewRow key={review.id} review={review} />
                ))}
              </ul>
            )
          ) : products.isPending ? (
            <div className="flex justify-center py-10 text-ink-muted">
              <Spinner label="در حال بارگذاری محصولات" />
            </div>
          ) : products.isError ? (
            <ErrorState error={products.error} onRetry={() => products.refetch()} />
          ) : shown.length === 0 ? (
            activityEmpty
          ) : (
            <ul>
              {shown.map((product) => (
                <li key={product.id}>
                  <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function PrivateSubmission({ product }: { product: Product }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    await api.deleteProduct(product.id)
    toast.success('ارسال حذف شد.')
    await queryClient.invalidateQueries({ queryKey: ['maker-products'] })
  }

  return (
    <li className="flex items-start gap-4 p-4">
      <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={productPath(product.slug)} className="font-bold hover:underline">
            {product.name}
          </Link>
          <StatusBadge status={product.status} />
        </div>
        <p className="bidi mt-0.5 truncate text-sm text-ink-muted">{product.tagline}</p>
        <p className="mt-1 text-xs text-ink-muted">ثبت‌شده در {formatDate(product.createdAt)}</p>
        {product.status === 'rejected' && product.moderationNote && (
          <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
            دلیل مدیران: <span dir="auto">{product.moderationNote}</span>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 size={15} strokeWidth={1.75} />}
        onClick={() => setConfirming(true)}
        aria-label={`حذف ${product.name}`}
      >
        <span className="hidden sm:inline">حذف</span>
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف ارسال"
        description={`«${product.name}» برای همیشه حذف می‌شود.`}
        confirmLabel="حذف"
        tone="danger"
        onConfirm={remove}
      />
    </li>
  )
}
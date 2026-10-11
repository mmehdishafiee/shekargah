import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CalendarDays, ExternalLink, Flag, Globe, PackageX, Tag } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useMyVotes, useProduct } from '@/data/queries'
import type { Product } from '@/data/types'
import { formatDate } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { hostnameOf } from '@/lib/text'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { CommentSection } from '@/components/product/CommentSection'
import { ProductLogo } from '@/components/product/ProductLogo'
import { ReportDialog } from '@/components/product/ReportDialog'
import { VoteButton } from '@/components/product/VoteButton'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { buttonClass, cardClass } from '@/components/ui/styles'

export function ProductPage() {
  const { slug = '' } = useParams()
  const product = useProduct(slug)

  if (product.isPending) return <PageLoader />
  if (product.isError) return <ErrorState error={product.error} onRetry={() => product.refetch()} />
  if (!product.data) return <ProductNotFound />
  return <ProductDetails product={product.data} />
}

function ProductNotFound() {
  useDocumentMeta('محصول پیدا نشد')
  return (
    <EmptyState
      icon={<PackageX size={22} strokeWidth={1.75} />}
      title="این محصول پیدا نشد"
      description="ممکن است نشانی اشتباه باشد، محصول هنوز منتشر نشده باشد یا از فهرست برداشته شده باشد."
      action={<ButtonLink to="/">دیدن محصولات دیگر</ButtonLink>}
    />
  )
}

function ProductDetails({ product }: { product: Product }) {
  const { session } = useAuth()
  const votes = useMyVotes([product.id])
  const [reporting, setReporting] = useState(false)
  const isPublished = product.status === 'published'
  const isMaker = session?.userId === product.maker.id
  useDocumentMeta(product.name, product.tagline)

  return (
    <div className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0 space-y-6">
        {product.status === 'pending' && (
          <Notice tone="warning" title="در انتظار بررسی">
            این محصول هنوز منتشر نشده است و فقط {isMaker ? 'تو' : 'سازنده'} و مدیران آن را می‌بینید.
          </Notice>
        )}
        {product.status === 'rejected' && (
          <Notice tone="danger" title="این محصول منتشر نشده است">
            {product.moderationNote ? (
              <>
                دلیل مدیران: <span dir="auto">{product.moderationNote}</span>
              </>
            ) : (
              'مدیران این محصول را تأیید نکرده‌اند.'
            )}
          </Notice>
        )}

        <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight sm:text-[28px]">{product.name}</h1>
            <p className="mt-1.5 text-base text-ink-muted sm:text-lg">{product.tagline}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={product.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={buttonClass('secondary', 'md', 'h-11 px-5')}
              >
                <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
                رفتن به وب‌سایت
              </a>
              {isPublished && (
                <VoteButton
                  variant="wide"
                  productId={product.id}
                  productName={product.name}
                  slug={product.slug}
                  votesCount={product.votesCount}
                  voted={votes.data?.has(product.id) ?? false}
                />
              )}
            </div>
          </div>
        </header>

        <section aria-label="توضیحات محصول" className={`${cardClass} p-5 sm:p-6`}>
          <p dir="auto" className="whitespace-pre-line break-words text-[15px] leading-8">
            {product.description}
          </p>
        </section>

        <div className={`${cardClass} p-5 sm:p-6`}>
          <CommentSection productId={product.id} slug={product.slug} open={isPublished} />
        </div>
      </article>

      <aside className="mt-6 space-y-4 lg:mt-0">
        <div className={`${cardClass} p-5`}>
          <h2 className="text-sm font-bold text-ink-muted">سازنده</h2>
          <Link to={profilePath(product.maker.username)} className="mt-3 flex items-center gap-3 rounded-lg hover:opacity-80">
            <Avatar name={product.maker.displayName} seed={product.maker.id} url={product.maker.avatarUrl} size={44} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{product.maker.displayName}</span>
              <span className="ltr block truncate text-start text-xs text-ink-muted">@{product.maker.username}</span>
            </span>
          </Link>
        </div>

        <dl className={`${cardClass} space-y-3.5 p-5 text-sm`}>
          {product.category && (
            <div className="flex items-center gap-3">
              <dt className="flex items-center gap-2 text-ink-muted">
                <Tag size={16} strokeWidth={1.75} aria-hidden />
                دسته‌بندی
              </dt>
              <dd className="ms-auto">
                <Link to={`/?category=${product.category.slug}`} className="font-medium hover:text-brand-700">
                  {product.category.name}
                </Link>
              </dd>
            </div>
          )}
          <div className="flex items-center gap-3">
            <dt className="flex items-center gap-2 text-ink-muted">
              <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
              {product.publishedAt ? 'تاریخ انتشار' : 'تاریخ ثبت'}
            </dt>
            <dd className="ms-auto font-medium">{formatDate(product.publishedAt ?? product.createdAt)}</dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="flex items-center gap-2 text-ink-muted">
              <Globe size={16} strokeWidth={1.75} aria-hidden />
              وب‌سایت
            </dt>
            <dd className="ms-auto min-w-0">
              <a href={product.websiteUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="ltr block truncate font-medium hover:text-brand-700">
                {hostnameOf(product.websiteUrl)}
              </a>
            </dd>
          </div>
        </dl>

        {session && isPublished && !isMaker && (
          <Button variant="ghost" size="sm" icon={<Flag size={15} strokeWidth={1.75} />} onClick={() => setReporting(true)}>
            گزارش این محصول
          </Button>
        )}
        <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ productId: product.id }} />
      </aside>
    </div>
  )
}

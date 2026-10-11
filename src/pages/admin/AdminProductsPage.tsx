import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Inbox, Undo2, X } from 'lucide-react'
import { useApi } from '@/data/api'
import { useAdminProducts } from '@/data/queries'
import type { ModerationAction, Product, ProductStatus } from '@/data/types'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { hostnameOf } from '@/lib/text'
import { LIMITS } from '@/lib/validation'
import { ProductLogo } from '@/components/product/ProductLogo'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

const EMPTY_TEXT: Record<ProductStatus, string> = {
  pending: 'صف بررسی خالی است.',
  published: 'هنوز محصولی منتشر نشده است.',
  rejected: 'محصول ردشده‌ای وجود ندارد.',
}

export function AdminProductsPage({ status }: { status: ProductStatus }) {
  const products = useAdminProducts(status)
  const items = products.data?.pages.flatMap((page) => page.items) ?? []
  const total = products.data?.pages[0]?.total ?? 0

  if (products.isPending) {
    return (
      <div className={`${cardClass} p-2`}>
        {Array.from({ length: 3 }, (_, i) => (
          <ProductRowSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (products.isError) return <ErrorState error={products.error} onRetry={() => products.refetch()} />
  if (items.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState icon={<Inbox size={22} strokeWidth={1.75} />} title={EMPTY_TEXT[status]} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{formatNumber(total)} محصول</p>
      <ul className="space-y-3">
        {items.map((product) => (
          <ModerationCard key={product.id} product={product} />
        ))}
      </ul>
      {products.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => products.fetchNextPage()} loading={products.isFetchingNextPage}>
            موارد بیشتر
          </Button>
        </div>
      )}
    </div>
  )
}

const DIALOGS: Record<ModerationAction, { title: string; confirm: string; tone: 'primary' | 'danger'; reason?: string }> = {
  approve: { title: 'تأیید و انتشار', confirm: 'انتشار محصول', tone: 'primary' },
  reject: { title: 'رد محصول', confirm: 'رد محصول', tone: 'danger', reason: 'دلیل رد (برای سازنده نمایش داده می‌شود)' },
  unpublish: { title: 'لغو انتشار', confirm: 'لغو انتشار', tone: 'danger', reason: 'دلیل لغو انتشار (برای سازنده نمایش داده می‌شود)' },
}

function ModerationCard({ product }: { product: Product }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [action, setAction] = useState<ModerationAction | null>(null)

  const run = async (note: string) => {
    if (!action) return
    await api.moderateProduct(product.id, action, note || undefined)
    toast.success(
      action === 'approve' ? `«${product.name}» منتشر شد.` : action === 'reject' ? `«${product.name}» رد شد.` : `انتشار «${product.name}» لغو شد.`,
    )
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
      queryClient.invalidateQueries({ queryKey: ['product', product.slug] }),
      queryClient.invalidateQueries({ queryKey: ['maker-products'] }),
    ])
  }

  const dialog = action ? DIALOGS[action] : null

  return (
    <li className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-start gap-4">
        <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link to={productPath(product.slug)} className="text-base font-bold hover:underline">
              {product.name}
            </Link>
            {product.category && <span className="text-[13px] text-ink-muted">{product.category.name}</span>}
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">{product.tagline}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            <span>
              سازنده:{' '}
              <Link to={profilePath(product.maker.username)} className="font-medium text-ink hover:underline">
                {product.maker.displayName}
              </Link>
            </span>
            <span>ثبت: {formatDate(product.createdAt)}</span>
            {product.status === 'published' && <span>رأی: {formatNumber(product.votesCount)}</span>}
            <a href={product.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="ltr inline-flex items-center gap-1 font-medium text-ink hover:underline">
              {hostnameOf(product.websiteUrl)}
              <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
            </a>
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-lg bg-sunken/70 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink-muted">توضیحات کامل</summary>
        <p dir="auto" className="mt-2 whitespace-pre-line break-words leading-7">
          {product.description}
        </p>
      </details>

      {product.moderatedAt && (
        <p className="mt-3 text-[13px] text-ink-muted">
          آخرین اقدام: {product.moderatorName ?? 'مدیر'}، {formatDateTime(product.moderatedAt)}
          {product.moderationNote && (
            <>
              ، دلیل: <span dir="auto">{product.moderationNote}</span>
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {product.status === 'pending' && (
          <>
            <Button variant="secondary" size="sm" icon={<X size={16} strokeWidth={1.75} />} onClick={() => setAction('reject')}>
              رد
            </Button>
            <Button size="sm" icon={<Check size={16} strokeWidth={2} />} onClick={() => setAction('approve')}>
              تأیید و انتشار
            </Button>
          </>
        )}
        {product.status === 'published' && (
          <Button variant="secondary" size="sm" icon={<Undo2 size={16} strokeWidth={1.75} />} onClick={() => setAction('unpublish')}>
            لغو انتشار
          </Button>
        )}
        {product.status === 'rejected' && (
          <Button variant="secondary" size="sm" icon={<Check size={16} strokeWidth={2} />} onClick={() => setAction('approve')}>
            تأیید و انتشار
          </Button>
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          open
          onClose={() => setAction(null)}
          title={dialog.title}
          description={`«${product.name}»`}
          confirmLabel={dialog.confirm}
          tone={dialog.tone}
          reason={dialog.reason ? { label: dialog.reason, required: true, max: LIMITS.moderationNote.max } : undefined}
          onConfirm={run}
        />
      )}
    </li>
  )
}

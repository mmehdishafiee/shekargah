import { Link } from 'react-router'
import { MessageCircle } from 'lucide-react'
import type { ProductSummary } from '@/data/types'
import { formatNumber } from '@/lib/format'
import { productPath } from '@/lib/paths'
import { ProductLogo } from './ProductLogo'
import { TagChips } from './TagChips'
import { ViewCount } from './ViewCount'
import { VoteButton } from './VoteButton'

interface ProductRowProps {
  product: ProductSummary
  voted: boolean
  rank?: number
}

export function ProductRow({ product, voted, rank }: ProductRowProps) {
  return (
    <article className="group relative flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-sunken/70 sm:px-4">
      <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} />
      <div className="min-w-0 flex-1">
        <h3 className="flex items-baseline gap-1.5 text-[15px] font-bold leading-snug">
          {rank !== undefined && (
            <span className="tabular-nums text-ink-muted" aria-label={`رتبه‌ی ${formatNumber(rank)}`}>
              {formatNumber(rank)}.
            </span>
          )}
          <Link
            to={productPath(product.slug)}
            className="truncate after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-has-[a:focus-visible]:ring-2"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{product.tagline}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
          {product.category && (
            <Link
              to={`/?category=${product.category.slug}`}
              className="relative z-10 rounded-md border border-line bg-surface px-2 py-0.5 hover:border-line-strong hover:text-ink"
            >
              {product.category.name}
            </Link>
          )}
          <TagChips tags={product.tags} />
          <span className="inline-flex items-center gap-1" aria-label={`${formatNumber(product.commentsCount)} نظر`}>
            <MessageCircle size={14} strokeWidth={1.75} aria-hidden />
            <span className="tabular-nums" aria-hidden>
              {formatNumber(product.commentsCount)}
            </span>
          </span>
          <ViewCount count={product.viewsCount} />
        </div>
      </div>
      <VoteButton
        productId={product.id}
        productName={product.name}
        slug={product.slug}
        votesCount={product.votesCount}
        voted={voted}
      />
    </article>
  )
}

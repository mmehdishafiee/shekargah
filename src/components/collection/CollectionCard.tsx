import { Link } from 'react-router'
import { Bookmark, Layers } from 'lucide-react'
import type { UserCollection } from '@/data/types'
import { formatNumber } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { Avatar } from '@/components/ui/Avatar'
import { cardClass } from '@/components/ui/styles'

/** Summary card for a member-curated list. */
export function CollectionCard({ collection, showOwner = true }: { collection: UserCollection; showOwner?: boolean }) {
  return (
    <div className={`${cardClass} flex h-full flex-col p-5 transition-colors hover:border-line-strong`}>
      <Link to={`/collections/${encodeURIComponent(collection.slug)}`} className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Layers size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-6">{collection.name}</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
            <span>{formatNumber(collection.productCount)} محصول</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Bookmark size={12} strokeWidth={1.75} aria-hidden />
              {formatNumber(collection.saveCount)}
            </span>
            {!collection.isPublic && (
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold">خصوصی</span>
            )}
          </span>
        </span>
      </Link>

      {collection.description && (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-6 text-ink-muted">{collection.description}</p>
      )}

      {showOwner && collection.owner && (
        <Link to={profilePath(collection.owner.username)} className="mt-3 flex items-center gap-2 text-xs text-ink-muted hover:text-ink">
          <Avatar name={collection.owner.displayName} seed={collection.owner.id} url={collection.owner.avatarUrl} size={22} />
          <span className="truncate">{collection.owner.displayName}</span>
        </Link>
      )}
    </div>
  )
}
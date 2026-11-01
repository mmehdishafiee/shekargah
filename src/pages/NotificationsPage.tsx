import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCheck, Layers, MessageCircle, Rocket, Star, ThumbsUp, Trophy, UserPlus, XCircle } from 'lucide-react'
import { useApi } from '@/data/api'
import { useNotifications } from '@/data/queries'
import type { Notification, NotificationKind } from '@/data/types'
import { formatDateTime } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const KIND_META: Record<NotificationKind, { icon: typeof ThumbsUp; label: string }> = {
  vote: { icon: ThumbsUp, label: 'رأی تازه' },
  comment: { icon: MessageCircle, label: 'نظر تازه' },
  review: { icon: Star, label: 'نقد تازه' },
  approved: { icon: Trophy, label: 'تأیید شد' },
  rejected: { icon: XCircle, label: 'رد شد' },
  system: { icon: CheckCheck, label: 'اطلاعیه' },
  follow: { icon: UserPlus, label: 'دنبال‌کردن تازه' },
  new_product: { icon: Rocket, label: 'محصول تازه' },
  collection: { icon: Layers, label: 'مجموعه‌ی تازه' },
}

export function NotificationsPage() {
  useDocumentMeta('اعلان‌ها')
  const api = useApi()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const feed = useNotifications()
  const all = feed.data?.pages.flatMap((page) => page.items) ?? []
  const items = filter === 'unread' ? all.filter((item) => !item.read) : all

  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
      ])
    },
  })

  return (
    <section aria-labelledby="notifications-heading" className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="notifications-heading" className="text-2xl font-extrabold">
            اعلان‌ها
          </h1>
          <p className="mt-1 text-sm text-ink-muted">رأی‌ها، نظرها و نقدهای محصولاتت اینجا جمع می‌شوند.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={markAll.isPending}
          disabled={!all.some((item) => !item.read)}
          icon={<CheckCheck size={16} strokeWidth={1.75} />}
          onClick={() => markAll.mutate()}
        >
          خواندن همه
        </Button>
      </div>

      <div role="group" aria-label="فیلتر اعلان‌ها" className="flex w-max gap-1 rounded-full bg-sunken p-1">
        {(
          [
            ['all', 'همه'],
            ['unread', 'خوانده‌نشده'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {feed.isPending ? (
          <div aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellOff size={22} strokeWidth={1.75} />}
            title={filter === 'unread' ? 'اعلان خوانده‌نشده‌ای نداری' : 'هنوز اعلانی نداری'}
            description="وقتی کسی به محصولت رأی بدهد یا نظر بنویسد، اینجا خبردار می‌شوی."
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
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

function NotificationRow({ item }: { item: Notification }) {
  const { icon: Icon, label } = KIND_META[item.kind]
  return (
    <li className={`flex items-start gap-3 px-3 py-3.5 sm:px-4 ${item.read ? '' : 'bg-brand-50/40'}`}>
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted">
        <Icon size={17} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-muted">{label}</p>
        <p className="mt-0.5 text-sm">
          {item.actor && (
            <>
              <Link to={profilePath(item.actor.username)} className="font-bold hover:underline">
                {item.actor.displayName}
              </Link>{' '}
            </>
          )}
          {item.kind === 'follow' ? (
            'شروع کرد به دنبال‌کردن تو'
          ) : item.productSlug ? (
            <>
              {item.kind === 'new_product' ? 'محصول تازه منتشر کرد: ' : item.kind === 'collection' ? 'مجموعه‌ی تازه ساخت: ' : 'روی '}
              <Link to={productPath(item.productSlug)} className="font-semibold hover:underline">
                {item.productName}
              </Link>
            </>
          ) : null}
        </p>
        {item.body && (
          <p dir="auto" className="mt-1 line-clamp-2 text-[13px] text-ink-muted">
            «{item.body}»
          </p>
        )}
        <p className="mt-1 text-xs text-ink-faint">{formatDateTime(item.createdAt)}</p>
      </div>
      {!item.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" aria-label="خوانده‌نشده" />}
    </li>
  )
}
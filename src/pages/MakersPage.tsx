import { useState } from 'react'
import { Link } from 'react-router'
import { Trophy } from 'lucide-react'
import { useTopHunters, useTopMakers } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const MEDALS = ['🥇', '🥈', '🥉']

/** Two leaderboards: makers by votes received, hunters by votes on what they found. */
export function MakersPage() {
  const [tab, setTab] = useState<'makers' | 'hunters'>('makers')
  const makers = useTopMakers()
  const hunters = useTopHunters()
  useDocumentMeta('سازندگان و شکارچی‌ها')

  const makerRows = makers.data?.pages.flatMap((page) => page.items) ?? []
  const hunterRows = hunters.data?.pages.flatMap((page) => page.items) ?? []
  const active = tab === 'makers' ? makers : hunters
  const rows = tab === 'makers' ? makerRows : hunterRows

  return (
    <section aria-labelledby="makers-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="makers-heading" className="text-2xl font-extrabold">
          سازندگان و شکارچی‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          سازندگان با محصولاتی که ساخته‌اند و شکارچی‌ها با محصولاتی که کشف کرده‌اند رتبه می‌گیرند.
        </p>
      </div>

      <div role="group" aria-label="نوع رتبه‌بندی" className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1 [scrollbar-width:none]">
        {(
          [
            ['makers', 'سازندگان'],
            ['hunters', 'شکارچی‌ها'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {active.isPending ? (
        <PageLoader />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : rows.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={<Trophy size={22} strokeWidth={1.75} />}
            title={tab === 'makers' ? 'هنوز سازنده‌ای با محصول منتشرشده نیست' : 'هنوز کسی محصولی را شکار نکرده است'}
          />
        </div>
      ) : (
        <>
          <ol aria-label={tab === 'makers' ? 'سازندگان برتر' : 'شکارچی‌های برتر'} className={`${cardClass} divide-y divide-line/70 p-1.5 sm:p-2`}>
            {rows.map((maker) => (
              <li key={maker.id}>
                <Link
                  to={profilePath(maker.username)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-sunken/70 sm:px-4"
                >
                  <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-ink-muted" aria-label={`رتبه‌ی ${formatNumber(maker.rank)}`}>
                    {MEDALS[maker.rank - 1] ?? formatNumber(maker.rank)}
                  </span>
                  <Avatar name={maker.displayName} seed={maker.id} url={maker.avatarUrl} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{maker.displayName}</span>
                    <span className="ltr block truncate text-start text-xs text-ink-muted">@{maker.username}</span>
                  </span>
                  <span className="shrink-0 text-end text-[13px] text-ink-muted">
                    <span className="block font-semibold tabular-nums text-ink">{formatNumber(maker.votesTotal)} رأی</span>
                    <span className="block tabular-nums">
                      {formatNumber('productCount' in maker ? maker.productCount : maker.huntCount)}{' '}
                      {'productCount' in maker ? 'محصول' : 'شکار'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {makers.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => makers.fetchNextPage()} loading={makers.isFetchingNextPage}>
                سازندگان بیشتر
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
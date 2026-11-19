import { Link } from 'react-router'
import { Flame, LayoutGrid } from 'lucide-react'
import { useTopics } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

/** Browse every topic, with the ones seeing recent traction surfaced first. */
export function TopicsPage() {
  const topics = useTopics()
  useDocumentMeta('موضوع‌ها')

  const hot = (topics.data ?? []).filter((topic) => topic.recentVotes > 0).slice(0, 6)
  const all = [...(topics.data ?? [])].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, 'fa'))

  return (
    <section aria-labelledby="topics-heading" className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 id="topics-heading" className="text-2xl font-extrabold">
          موضوع‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">محصولات را بر اساس موضوعی که در آن ساخته شده‌اند ببین.</p>
      </div>

      {topics.isPending ? (
        <PageLoader />
      ) : topics.isError ? (
        <ErrorState error={topics.error} onRetry={() => topics.refetch()} />
      ) : (topics.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<LayoutGrid size={22} strokeWidth={1.75} />} title="هنوز موضوعی ثبت نشده است" />
        </div>
      ) : (
        <>
          {hot.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Flame size={18} strokeWidth={2} className="text-brand-600" aria-hidden />
                موضوع‌های داغ
              </h2>
              <p className="mt-1 text-sm text-ink-muted">بر اساس رأی‌های هفت روز گذشته.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hot.map((topic) => (
                  <TopicCard key={topic.slug} topic={topic} highlight />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold">همه‌ی موضوع‌ها</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {all.map((topic) => (
                <TopicCard key={topic.slug} topic={topic} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function TopicCard({
  topic,
  highlight = false,
}: {
  topic: { slug: string; name: string; description: string | null; productCount: number; recentVotes: number }
  highlight?: boolean
}) {
  return (
    <Link
      to={`/?category=${encodeURIComponent(topic.slug)}`}
      className={`${cardClass} group flex flex-col gap-1.5 p-4 transition-colors hover:border-line-strong ${
        highlight ? 'border-brand-200 bg-brand-50/40' : ''
      }`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-bold group-hover:text-brand-700">{topic.name}</span>
        <span className="text-xs tabular-nums text-ink-muted">{formatNumber(topic.productCount)} محصول</span>
      </span>
      {topic.description && <span className="line-clamp-2 text-[13px] leading-6 text-ink-muted">{topic.description}</span>}
      {highlight && topic.recentVotes > 0 && (
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
          <Flame size={12} strokeWidth={2} aria-hidden />
          {formatNumber(topic.recentVotes)} رأی در ۷ روز
        </span>
      )}
    </Link>
  )
}
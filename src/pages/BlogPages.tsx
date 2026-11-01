import { Link, useParams } from 'react-router'
import { CalendarDays, Newspaper, Tag } from 'lucide-react'
import { usePost, usePosts } from '@/data/queries'
import { formatDate } from '@/lib/format'
import { markdownToPlain, renderMarkdown } from '@/lib/markdown'
import { articleSchema, useDocumentMeta } from '@/lib/useDocumentMeta'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

function PostCard({ slug, title, excerpt, coverUrl, tags, publishedAt, authorName }: {
  slug: string
  title: string
  excerpt: string | null
  coverUrl: string | null
  tags: string[]
  publishedAt: string | null
  authorName: string | null
}) {
  return (
    <li>
      <Link to={`/blog/${encodeURIComponent(slug)}`} className={`${cardClass} flex h-full flex-col gap-3 overflow-hidden transition-colors hover:border-line-strong`}>
        {coverUrl && <img src={coverUrl} alt="" className="-m-px h-40 w-full object-cover" loading="lazy" />}
        <div className="flex flex-1 flex-col p-5 pt-0">
          <h2 className="text-base font-extrabold leading-7">{title}</h2>
          {excerpt && <p className="mt-1.5 line-clamp-3 text-[13px] leading-6 text-ink-muted">{excerpt}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            {authorName && <span>{authorName}</span>}
            {publishedAt && <span>{formatDate(publishedAt)}</span>}
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-sunken px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </li>
  )
}

export function BlogPage() {
  useDocumentMeta('وبلاگ', 'یادداشت‌ها و نوشته‌های شکارگاه درباره‌ی محصولات، سازندگان و اکوسیستم فارسی.', { path: '/blog' })
  const posts = usePosts()
  const items = posts.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <section aria-labelledby="blog-heading" className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 id="blog-heading" className="text-2xl font-extrabold">
          وبلاگ شکارگاه
        </h1>
        <p className="mt-1 text-sm text-ink-muted">یادداشت‌هایی درباره‌ی محصولات، سازندگان و اکوسیستم محصولات فارسی.</p>
      </div>

      {posts.isPending ? (
        <PageLoader />
      ) : posts.isError ? (
        <ErrorState error={posts.error} onRetry={() => posts.refetch()} />
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Newspaper size={22} strokeWidth={1.75} />} title="هنوز نوشته‌ای منتشر نشده" description="به‌زودی اولین یادداشت‌ها اینجا منتشر می‌شوند." />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((post) => (
            <PostCard
              key={post.id}
              slug={post.slug}
              title={post.title}
              excerpt={post.excerpt ?? (markdownToPlain(post.excerpt ?? '', 140) || null)}
              coverUrl={post.coverUrl}
              tags={post.tags}
              publishedAt={post.publishedAt}
              authorName={post.author?.displayName ?? null}
            />
          ))}
        </ul>
      )}

      {posts.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => posts.fetchNextPage()} loading={posts.isFetchingNextPage}>
            نوشته‌های بیشتر
          </Button>
        </div>
      )}
    </section>
  )
}

export function BlogPostPage() {
  const { slug = '' } = useParams()
  const post = usePost(slug)
  useDocumentMeta(post.data?.seoTitle ?? post.data?.title ?? 'وبلاگ', post.data?.seoDescription ?? post.data?.excerpt ?? undefined, {
    path: `/blog/${encodeURIComponent(slug)}`,
    type: 'article',
    image: post.data?.coverUrl ?? null,
    schema: post.data
      ? articleSchema({
          title: post.data.title,
          description: post.data.seoDescription ?? post.data.excerpt ?? post.data.title,
          slug: post.data.slug,
          publishedAt: post.data.publishedAt,
          author: post.data.author?.displayName ?? null,
        })
      : undefined,
  })

  if (post.isPending) return <PageLoader />
  if (post.isError) return <ErrorState error={post.error} onRetry={() => post.refetch()} />
  if (!post.data) {
    return (
      <div className={cardClass}>
        <EmptyState icon={<Newspaper size={22} strokeWidth={1.75} />} title="این نوشته پیدا نشد" action={<ButtonLink to="/blog">همه‌ی نوشته‌ها</ButtonLink>} />
      </div>
    )
  }

  const article = post.data

  return (
    <article className="mx-auto max-w-2xl">
      <ButtonLink to="/blog" variant="ghost" size="sm" className="mb-3">
        همه‌ی نوشته‌ها
      </ButtonLink>

      <header>
        <h1 className="text-2xl font-extrabold leading-9 sm:text-3xl">{article.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-muted">
          {article.author && (
            <span className="flex items-center gap-2">
              <Avatar name={article.author.displayName} seed={article.author.id} url={article.author.avatarUrl} size={28} />
              {article.author.displayName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} strokeWidth={1.75} aria-hidden />
              {formatDate(article.publishedAt)}
            </span>
          )}
        </div>
        {article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs text-ink-muted">
                <Tag size={11} strokeWidth={2} aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {article.coverUrl && <img src={article.coverUrl} alt="" className="mt-6 w-full rounded-card border border-line object-cover" />}

      <div className="mt-6 border-t border-line/70 pt-2">{renderMarkdown(article.content)}</div>
    </article>
  )
}
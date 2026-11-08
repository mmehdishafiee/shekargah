import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, Save, Trash2 } from 'lucide-react'
import { useApi } from '@/data/api'
import { useAdminPost, useAdminPosts } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { markdownToPlain, renderMarkdown } from '@/lib/markdown'
import { SITE_URL, useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function AdminBlogPage() {
  useDocumentMeta('وبلاگ')
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const posts = useAdminPosts()
  const items = posts.data?.pages.flatMap((page) => page.items) ?? []
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeletePost(id),
    onSuccess: async () => {
      toast.success('نوشته حذف شد.')
      await queryClient.invalidateQueries({ queryKey: ['admin-posts'] })
    },
  })

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="حذف نوشته"
        description={pendingDelete ? `«${pendingDelete.title}» برای همیشه حذف می‌شود.` : undefined}
        confirmLabel="حذف"
        tone="danger"
        onConfirm={async () => {
          if (pendingDelete) await remove.mutateAsync(pendingDelete.id)
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">وبلاگ</h1>
          <p className="mt-1 text-sm text-ink-muted">نوشته بنویس، پیش‌نویس نگه دار و با تنظیمات سئو منتشر کن.</p>
        </div>
        <ButtonLink to="/admin/blog/new" icon={<Plus size={16} strokeWidth={2} aria-hidden />}>
          نوشته‌ی تازه
        </ButtonLink>
      </div>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {posts.isPending ? (
          <PageLoader />
        ) : posts.isError ? (
          <ErrorState error={posts.error} onRetry={() => posts.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Plus size={22} strokeWidth={1.75} />} title="هنوز نوشته‌ای نداری" />
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/blog/${post.id}`} className="block truncate font-bold hover:underline">
                    {post.title}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {post.status === 'published' ? `منتشرشده ${post.publishedAt ? formatDate(post.publishedAt) : ''}` : 'پیش‌نویس'} · آخرین ویرایش{' '}
                    {formatDate(post.updatedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    post.status === 'published' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                  }`}
                >
                  {post.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
                </span>
                <Link to={`/blog/${encodeURIComponent(post.slug)}`} aria-label={`دیدن ${post.title}`} className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-sunken">
                  <Eye size={16} strokeWidth={1.75} aria-hidden />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`حذف ${post.title}`}
                  icon={<Trash2 size={15} strokeWidth={1.75} />}
                  loading={remove.isPending}
                  onClick={() => setPendingDelete({ id: post.id, title: post.title })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {posts.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => posts.fetchNextPage()} loading={posts.isFetchingNextPage}>
            بیشتر
          </Button>
        </div>
      )}
    </div>
  )
}

export function AdminBlogEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const existing = useAdminPost(isNew ? undefined : id)
  if (!isNew && existing.isPending) return <PageLoader />
  if (!isNew && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  return <PostForm key={id ?? 'new'} id={isNew ? null : id!} initial={existing.data ?? null} />
}

function PostForm({ id, initial }: { id: string | null; initial: import('@/data/types').Post | null }) {
  useDocumentMeta(id ? 'ویرایش نوشته' : 'نوشته‌ی تازه')
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState({
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
    seoTitle: initial?.seoTitle ?? '',
    seoDescription: initial?.seoDescription ?? '',
    tags: (initial?.tags ?? []).join(', '),
    status: 'draft' as 'draft' | 'published',
  })
  const [error, setError] = useState<unknown>(null)
  const [preview, setPreview] = useState(false)

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }))

  const save = useMutation({
    mutationFn: (status: 'draft' | 'published') =>
      api.adminSavePost({
        id,
        slug: values.slug || slugify(values.title),
        title: values.title,
        excerpt: values.excerpt,
        content: values.content,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        status,
      }),
    onSuccess: async (slug) => {
      setError(null)
      toast.success('نوشته ذخیره شد.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: ['post', slug] }),
      ])
      if (!id) navigate(`/admin/blog`)
    },
    onError: (caught) => setError(caught),
  })

  const submit = (event: FormEvent, status: 'draft' | 'published') => {
    event.preventDefault()
    save.mutate(status)
  }

  const excerptFallback = markdownToPlain(values.content, 160)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{id ? 'ویرایش نوشته' : 'نوشته‌ی تازه'}</h1>
        <ButtonLink to="/admin/blog" variant="secondary">
          بازگشت
        </ButtonLink>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form className={`${cardClass} space-y-5 p-5`}>
          <Field label="عنوان">
            {(props) => <TextInput {...props} dir="auto" value={values.title} onChange={(event) => set('title', event.target.value)} />}
          </Field>

          <Field label="نشانی (slug)" hint="خالی بگذاری، خودکار از عنوان ساخته می‌شود.">
            {(props) => (
              <TextInput {...props} dir="ltr" className="text-start" value={values.slug} onChange={(event) => set('slug', slugify(event.target.value))} placeholder={slugify(values.title)} />
            )}
          </Field>

          <Field label="خلاصه" optional hint="در فهرست وبلاگ و توضیحات متا استفاده می‌شود.">
            {(props) => <TextArea {...props} dir="auto" rows={2} value={values.excerpt} onChange={(event) => set('excerpt', event.target.value)} maxLength={300} />}
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">متن (Markdown)</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((value) => !value)}>
                {preview ? 'ویرایش' : 'پیش‌نمایش'}
              </Button>
            </div>
            {preview ? (
              <div className={`${cardClass} min-h-64 p-5`}>{renderMarkdown(values.content || '_هنوز چیزی نوشته نشده._')}</div>
            ) : (
              <TextArea
                dir="auto"
                rows={16}
                value={values.content}
                onChange={(event) => set('content', event.target.value)}
                placeholder={'# عنوان\n\nمتن نوشته...\n\n**پررنگ** و *کج* و [لینک](https://example.com)'}
                aria-label="متن نوشته"
              />
            )}
          </div>

          {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 pt-4">
            <Button type="button" variant="secondary" loading={save.isPending} onClick={(event) => submit(event, 'draft')}>
              ذخیره‌ی پیش‌نویس
            </Button>
            <Button type="button" loading={save.isPending} icon={<Save size={16} strokeWidth={1.75} />} onClick={(event) => submit(event, 'published')}>
              انتشار
            </Button>
          </div>
        </form>

        <aside className="space-y-5">
          <div className={`${cardClass} space-y-4 p-5`}>
            <h2 className="text-base font-bold">سئو</h2>
            <Field label="عنوان سئو" optional hint="حداکثر ۷۰ نویسه. خالی بماند، عنوان نوشته استفاده می‌شود.">
              {(props) => <TextInput {...props} dir="auto" value={values.seoTitle} onChange={(event) => set('seoTitle', event.target.value)} maxLength={70} />}
            </Field>
            <Field label="توضیحات متا" optional hint="حداکثر ۱۶۰ نویسه.">
              {(props) => (
                <TextArea {...props} dir="auto" rows={3} value={values.seoDescription} onChange={(event) => set('seoDescription', event.target.value)} maxLength={160} />
              )}
            </Field>
            <Field label="برچسب‌ها" optional hint="با کاما جدا کن.">
              {(props) => <TextInput {...props} dir="auto" value={values.tags} onChange={(event) => set('tags', event.target.value)} />}
            </Field>
          </div>

          <div className={`${cardClass} p-5`}>
            <h2 className="text-base font-bold">پیش‌نمایش نتیجه‌ی گوگل</h2>
            <div className="mt-3 space-y-1">
              <p className="text-[15px] font-medium text-brand-700">{values.seoTitle || values.title || 'عنوان نوشته'}</p>
              <p className="ltr text-xs text-success-700">{SITE_URL.replace(/^https?:\/\//, '')}/blog/{values.slug || slugify(values.title) || 'slug'}</p>
              <p className="text-[13px] leading-6 text-ink-muted">{values.seoDescription || values.excerpt || excerptFallback || 'توضیحات متا...'}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, MessageCircle, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { keys, useComments } from '@/data/queries'
import type { Comment } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { LIMITS, validateComment } from '@/lib/validation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { Field, TextArea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/toast'
import { ReportDialog } from './ReportDialog'

interface CommentSectionProps {
  productId: string
  slug: string
  /** Comments can only be added to published products. */
  open: boolean
}

export function CommentSection({ productId, slug, open }: CommentSectionProps) {
  const comments = useComments(productId)
  const { session } = useAuth()
  const location = useLocation()
  const count = comments.data?.length ?? 0

  return (
    <section aria-labelledby="comments-heading" className="space-y-5">
      <h2 id="comments-heading" className="flex items-center gap-2 text-lg font-bold">
        نظرها
        {comments.isSuccess && <span className="text-base font-medium text-ink-muted">({formatNumber(count)})</span>}
      </h2>

      {open &&
        (session ? (
          <CommentForm productId={productId} slug={slug} />
        ) : (
          <p className="rounded-control border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
            برای نوشتن نظر{' '}
            <Link to="/login" state={{ from: location.pathname }} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
              وارد حسابت شو
            </Link>
            .
          </p>
        ))}

      {comments.isPending ? (
        <div className="flex justify-center py-8 text-ink-muted">
          <Spinner label="در حال بارگذاری نظرها" />
        </div>
      ) : comments.isError ? (
        <ErrorState error={comments.error} onRetry={() => comments.refetch()} title="نظرها بارگذاری نشد" />
      ) : count === 0 ? (
        <EmptyState
          icon={<MessageCircle size={22} strokeWidth={1.75} />}
          title="هنوز نظری ثبت نشده"
          description={open ? 'اولین نفری باش که درباره‌ی این محصول نظر می‌دهد.' : undefined}
        />
      ) : (
        <ol className="space-y-1">
          {comments.data.map((comment) => (
            <CommentItem key={comment.id} comment={comment} slug={slug} />
          ))}
        </ol>
      )}
    </section>
  )
}

function CommentForm({ productId, slug }: { productId: string; slug: string }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [body, setBody] = useState('')
  const [fieldError, setFieldError] = useState<string>()

  const mutation = useMutation({
    mutationFn: () => api.addComment(productId, body),
    onSuccess: async () => {
      setBody('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.comments(productId) }),
        queryClient.invalidateQueries({ queryKey: keys.product(slug) }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ])
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const error = validateComment(body)
    setFieldError(error)
    if (!error) mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="flex gap-3" noValidate>
      {profile && <Avatar name={profile.displayName} seed={profile.id} url={profile.avatarUrl} size={36} />}
      <div className="flex-1 space-y-3">
        <Field
          label="نظرت را بنویس"
          error={fieldError ?? (mutation.isError ? errorMessage(mutation.error) : undefined)}
          counter={{ value: body, max: LIMITS.comment.max }}
        >
          {(props) => (
            <TextArea
              {...props}
              dir="auto"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="تجربه‌ات از این محصول چه بوده؟"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={mutation.isPending}>
            ارسال نظر
          </Button>
        </div>
      </div>
    </form>
  )
}

function CommentItem({ comment, slug }: { comment: Comment; slug: string }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { session, isAdmin } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [reporting, setReporting] = useState(false)
  const isOwn = session?.userId === comment.author.id

  const remove = async () => {
    await api.deleteComment(comment.id)
    toast.success('نظر حذف شد.')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.comments(comment.productId) }),
      queryClient.invalidateQueries({ queryKey: keys.product(slug) }),
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
    ])
  }

  return (
    <li className="group flex gap-3 rounded-xl px-1 py-3">
      <Link to={profilePath(comment.author.username)} className="shrink-0">
        <Avatar name={comment.author.displayName} seed={comment.author.id} url={comment.author.avatarUrl} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link to={profilePath(comment.author.username)} className="text-sm font-semibold hover:underline">
            {comment.author.displayName}
          </Link>
          <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)} className="text-xs text-ink-muted">
            {formatRelative(comment.createdAt)}
          </time>
        </div>
        {/* Rendered as plain text: React escapes it, and no HTML is ever interpreted. */}
        <p dir="auto" className="mt-1 whitespace-pre-line break-words text-[15px] text-ink">
          {comment.body}
        </p>
        {session && (
          <div className="mt-1.5 flex gap-1">
            {(isOwn || isAdmin) && (
              <Button variant="ghost" size="sm" className="h-7 px-2" icon={<Trash2 size={14} strokeWidth={1.75} />} onClick={() => setConfirming(true)}>
                حذف
              </Button>
            )}
            {!isOwn && (
              <Button variant="ghost" size="sm" className="h-7 px-2" icon={<Flag size={14} strokeWidth={1.75} />} onClick={() => setReporting(true)}>
                گزارش
              </Button>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف نظر"
        description={isOwn ? 'این نظر برای همیشه حذف می‌شود.' : 'این نظر به‌عنوان اقدام مدیریتی حذف و در گزارش فعالیت ثبت می‌شود.'}
        confirmLabel="حذف نظر"
        tone="danger"
        onConfirm={remove}
      />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ commentId: comment.id }} />
    </li>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquareQuote, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { useReviews } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatNumber } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { LIMITS } from '@/lib/validation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { BidiText } from '@/components/ui/BidiText'
import { RatingPicker, RatingStars } from './RatingStars'

/** Reviews with 1–5 stars: one per user, editable in place. */
export function ReviewSection({ productId, productName }: { productId: string; productName: string }) {
  const api = useApi()
  const { session, profile } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const reviews = useReviews(productId)

  const mine = reviews.data?.find((review) => review.author?.id === session?.userId) ?? null
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const startEdit = () => {
    setRating(mine?.rating ?? 0)
    setBody(mine?.body ?? '')
    setEditing(true)
  }

  const save = useMutation({
    mutationFn: () => api.submitReview({ productId, rating, body }),
    onSuccess: async () => {
      setEditing(false)
      setError(null)
      toast.success(mine ? 'نقدت به‌روزرسانی شد.' : 'نقدت ثبت شد.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reviews', productId] }),
        queryClient.invalidateQueries({ queryKey: ['product'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ])
    },
    onError: (caught) => setError(caught),
  })

  const remove = useMutation({
    mutationFn: () => api.deleteReview(productId),
    onSuccess: async () => {
      setEditing(false)
      setRating(0)
      setBody('')
      toast.success('نقدت حذف شد.')
      await queryClient.invalidateQueries({ queryKey: ['reviews', productId] })
    },
    onError: (caught) => setError(caught),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (rating < 1) {
      setError(new Error('rating-required'))
      return
    }
    save.mutate()
  }

  const average = reviews.data?.length
    ? Math.round((reviews.data.reduce((sum, review) => sum + review.rating, 0) / reviews.data.length) * 100) / 100
    : 0

  return (
    <section aria-labelledby="reviews-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="text-sm font-bold text-ink-muted">
          نقدها
        </h2>
        {reviews.data && reviews.data.length > 0 && (
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <RatingStars value={average} />
            <span className="font-semibold text-ink">{formatNumber(average)}</span>
            <span>({formatNumber(reviews.data.length)} نقد)</span>
          </span>
        )}
      </div>

      {session ? (
        editing ? (
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-sunken/50 p-4">
            <RatingPicker value={rating} onChange={setRating} disabled={save.isPending} />
            <TextArea
              dir="auto"
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="متن نقد"
              placeholder="تجربه‌ات از این محصول چطور بود؟"
              maxLength={LIMITS.review.max}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {error ? <span className="me-auto text-xs text-danger-700">{error instanceof Error && error.message === 'rating-required' ? 'امتیاز را انتخاب کن.' : errorMessage(error)}</span> : null}
              {mine && (
                <Button type="button" variant="ghost" size="sm" loading={remove.isPending} onClick={() => remove.mutate()} icon={<Trash2 size={15} />}>
                  حذف نقد
                </Button>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
                انصراف
              </Button>
              <Button type="submit" size="sm" loading={save.isPending}>
                {mine ? 'ذخیره‌ی نقد' : 'ثبت نقد'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line-strong bg-sunken/40 p-4">
            {mine ? (
              <>
                <RatingStars value={mine.rating} />
                <span className="text-sm text-ink-muted">نقد تو ثبت شده است.</span>
                <Button variant="secondary" size="sm" className="ms-auto" onClick={startEdit}>
                  ویرایش نقد
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-ink-muted">این محصول را امتحان کرده‌ای؟ امتیاز و نقدت را بنویس.</span>
                <Button size="sm" className="ms-auto" onClick={startEdit}>
                  نوشتن نقد
                </Button>
              </>
            )}
          </div>
        )
      ) : (
        <p className="rounded-lg border border-line bg-sunken/40 p-4 text-sm text-ink-muted">
          برای نوشتن نقد{' '}
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={() => navigate('/login', { state: { from: location.pathname } })}
          >
            وارد حسابت شو
          </button>
          .
        </p>
      )}

      {reviews.isPending ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Spinner label="در حال بارگذاری نقدها" />
        </div>
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : (reviews.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote size={22} strokeWidth={1.75} />}
          title="هنوز نقدی ثبت نشده"
          description={`اولین نفری باش که «${productName}» را نقد می‌کند.`}
        />
      ) : (
        <ul className="space-y-4">
          {(reviews.data ?? []).map((review) => (
            <li key={review.id} className="flex gap-3">
              <Avatar name={review.author.displayName} seed={review.author.id} url={review.author.avatarUrl} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link to={profilePath(review.author.username)} className="text-sm font-bold hover:underline">
                    {review.author.displayName}
                  </Link>
                  <RatingStars value={review.rating} size={13} />
                  <span className="text-xs text-ink-muted">{formatDate(review.createdAt)}</span>
                  {profile?.id === review.author.id && <span className="text-xs text-brand-700">نقد تو</span>}
                </div>
                {review.body && (
                  <BidiText className="mt-1.5 break-words text-sm leading-7" text={review.body} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
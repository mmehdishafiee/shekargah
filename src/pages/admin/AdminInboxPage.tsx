import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Inbox, Layers, Mail, Sparkles } from 'lucide-react'
import { useApi } from '@/data/api'
import {
  useContactMessages,
  useEditRequests,
  useFeatureRequests,
  useMakerClaims,
} from '@/data/queries'
import type { ContactStatus, FeatureStatus, ReviewStatus } from '@/data/types'
import { formatDateTime, formatNumber } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

type Tab = 'messages' | 'claims' | 'edits' | 'features'

const TABS: { value: Tab; label: string; icon: typeof Inbox }[] = [
  { value: 'messages', label: 'پیام‌ها', icon: Mail },
  { value: 'claims', label: 'ادعای سازندگی', icon: Check },
  { value: 'edits', label: 'درخواست ویرایش', icon: Layers },
  { value: 'features', label: 'پیشنهاد قابلیت', icon: Sparkles },
]

const filterPills = 'flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1 [scrollbar-width:none]'
const pill = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'}`

export function AdminInboxPage() {
  const [tab, setTab] = useState<Tab>('messages')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">صندوق ورودی</h1>
        <p className="mt-1 text-sm text-ink-muted">پیام‌های تماس، ادعای سازندگی، درخواست‌های ویرایش و پیشنهادهای کاربران.</p>
      </div>

      <div role="group" aria-label="نوع صندوق" className={filterPills}>
        {TABS.map((item) => (
          <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => setTab(item.value)} className={pill(tab === item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'messages' && <MessagesTab />}
      {tab === 'claims' && <ClaimsTab />}
      {tab === 'edits' && <EditsTab />}
      {tab === 'features' && <FeaturesTab />}
    </div>
  )
}

function MessagesTab() {
  const [status, setStatus] = useState<ContactStatus>('new')
  const messages = useContactMessages(status)
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactStatus }) => api.setContactMessageStatus(id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contact-messages'] })
      toast.success('وضعیت پیام به‌روز شد.')
    },
  })

  return (
    <section className="space-y-3">
      <div className={filterPills}>
        {(['new', 'read', 'archived'] as const).map((value) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={pill(status === value)}>
            {value === 'new' ? 'تازه' : value === 'read' ? 'خوانده‌شده' : 'بایگانی'}
          </button>
        ))}
      </div>

      {messages.isPending ? (
        <PageLoader />
      ) : messages.isError ? (
        <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
      ) : (messages.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Inbox size={22} strokeWidth={1.75} />} title="پیامی در این وضعیت نیست" />
        </div>
      ) : (
        <ul className="space-y-3">
          {(messages.data ?? []).map((message) => (
            <li key={message.id} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{message.subject}</p>
                <time className="text-xs text-ink-muted">{formatDateTime(message.createdAt)}</time>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                {message.name} · <span className="ltr inline-block">{message.email}</span>
              </p>
              <p dir="auto" className="mt-3 whitespace-pre-line text-sm leading-7">
                {message.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {message.status !== 'read' && (
                  <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ id: message.id, next: 'read' })}>
                    خوانده شد
                  </Button>
                )}
                {message.status !== 'archived' && (
                  <Button size="sm" variant="ghost" loading={update.isPending} onClick={() => update.mutate({ id: message.id, next: 'archived' })}>
                    بایگانی
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReviewTabs({ status, setStatus }: { status: ReviewStatus; setStatus: (next: ReviewStatus) => void }) {
  return (
    <div className={filterPills}>
      {(['pending', 'approved', 'rejected'] as const).map((value) => (
        <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={pill(status === value)}>
          {value === 'pending' ? 'در انتظار' : value === 'approved' ? 'تأییدشده' : 'ردشده'}
        </button>
      ))}
    </div>
  )
}

function ClaimsTab() {
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const claims = useMakerClaims(status)
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.reviewMakerClaim({ id, approve }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['maker-claims'] })
      await queryClient.invalidateQueries({ queryKey: ['product'] })
      toast.success('ادعا بررسی شد.')
    },
  })

  return (
    <section className="space-y-3">
      <ReviewTabs status={status} setStatus={setStatus} />
      {claims.isPending ? (
        <PageLoader />
      ) : claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => claims.refetch()} />
      ) : (claims.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Check size={22} strokeWidth={1.75} />} title="ادعایی در این وضعیت نیست" />
        </div>
      ) : (
        <ul className="space-y-3">
          {(claims.data ?? []).map((claim) => (
            <li key={claim.id} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link to={productPath(claim.productSlug)} className="font-bold hover:underline">
                  {claim.productName}
                </Link>
                <time className="text-xs text-ink-muted">{formatDateTime(claim.createdAt)}</time>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                ادعا از طرف{' '}
                <Link to={profilePath(claim.claimant.username)} className="font-semibold hover:underline">
                  {claim.claimant.displayName}
                </Link>
              </p>
              {claim.proof && (
                <p dir="auto" className="mt-2 rounded-lg bg-sunken px-3 py-2 text-[13px] leading-6">
                  {claim.proof}
                </p>
              )}
              {claim.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ id: claim.id, approve: true })}>
                    تأیید سازندگی
                  </Button>
                  <Button size="sm" variant="secondary" loading={review.isPending} onClick={() => review.mutate({ id: claim.id, approve: false })}>
                    رد
                  </Button>
                </div>
              )}
              {review.isError && <p className="mt-2 text-xs text-danger-700">{errorMessage(review.error)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function EditsTab() {
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const edits = useEditRequests(status)
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.reviewEditRequest({ id, approve }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['edit-requests'] })
      await queryClient.invalidateQueries({ queryKey: ['product'] })
      toast.success('درخواست بررسی شد.')
    },
  })

  return (
    <section className="space-y-3">
      <ReviewTabs status={status} setStatus={setStatus} />
      {edits.isPending ? (
        <PageLoader />
      ) : edits.isError ? (
        <ErrorState error={edits.error} onRetry={() => edits.refetch()} />
      ) : (edits.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Layers size={22} strokeWidth={1.75} />} title="درخواستی در این وضعیت نیست" />
        </div>
      ) : (
        <ul className="space-y-3">
          {(edits.data ?? []).map((request) => (
            <li key={request.id} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link to={productPath(request.productSlug)} className="font-bold hover:underline">
                  {request.productName}
                </Link>
                <time className="text-xs text-ink-muted">{formatDateTime(request.createdAt)}</time>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                از طرف{' '}
                <Link to={profilePath(request.requester.username)} className="font-semibold hover:underline">
                  {request.requester.displayName}
                </Link>
              </p>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                {request.payload.tagline && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-muted">تگلاین:</dt>
                    <dd dir="auto">{request.payload.tagline}</dd>
                  </div>
                )}
                {request.payload.description && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-muted">توضیح:</dt>
                    <dd dir="auto" className="line-clamp-3">{request.payload.description}</dd>
                  </div>
                )}
                {request.payload.website_url && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-muted">وب‌سایت:</dt>
                    <dd className="ltr">{request.payload.website_url}</dd>
                  </div>
                )}
                {request.payload.screenshots && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-muted">تصاویر:</dt>
                    <dd>{formatNumber(request.payload.screenshots.length)} تصویر تازه</dd>
                  </div>
                )}
              </dl>
              {request.note && <p className="mt-2 text-[13px] text-ink-muted">یادداشت: {request.note}</p>}
              {request.status === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ id: request.id, approve: true })}>
                    تأیید و اعمال
                  </Button>
                  <Button size="sm" variant="secondary" loading={review.isPending} onClick={() => review.mutate({ id: request.id, approve: false })}>
                    رد
                  </Button>
                </div>
              )}
              {review.isError && <p className="mt-2 text-xs text-danger-700">{errorMessage(review.error)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const FEATURE_LABELS: Record<FeatureStatus, string> = { new: 'تازه', planned: 'در برنامه', done: 'انجام شد', declined: 'رد شد' }

function FeaturesTab() {
  const features = useFeatureRequests(null)
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: FeatureStatus }) => api.setFeatureRequestStatus(id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feature-requests'] })
      toast.success('وضعیت پیشنهاد به‌روز شد.')
    },
  })

  return (
    <section className="space-y-3">
      {features.isPending ? (
        <PageLoader />
      ) : features.isError ? (
        <ErrorState error={features.error} onRetry={() => features.refetch()} />
      ) : (features.data ?? []).length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Sparkles size={22} strokeWidth={1.75} />} title="هنوز پیشنهادی ثبت نشده" />
        </div>
      ) : (
        <ul className="space-y-3">
          {(features.data ?? []).map((request) => (
            <li key={request.id} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{request.title}</p>
                <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-semibold">{FEATURE_LABELS[request.status]}</span>
              </div>
              {request.body && <p dir="auto" className="mt-2 text-sm leading-7 text-ink-muted">{request.body}</p>}
              <p className="mt-2 text-xs text-ink-faint">
                {request.authorName ?? 'کاربر'} · {formatDateTime(request.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['planned', 'done', 'declined'] as const).map((next) => (
                  <Button key={next} size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ id: request.id, next })}>
                    {FEATURE_LABELS[next]}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
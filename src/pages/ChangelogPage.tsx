import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitCommitHorizontal, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { useFeatureRequests } from '@/data/queries'
import type { FeatureStatus } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

interface Commit {
  hash: string
  date: string
  subject: string
}

const FEATURE_LABELS: Record<FeatureStatus, string> = {
  new: 'تازه',
  planned: 'در برنامه',
  done: 'انجام شد',
  declined: 'رد شد',
}

export function ChangelogPage() {
  useDocumentMeta('تغییرات شکارگاه', 'همه‌ی تغییرات شکارگاه از ابتدا تا امروز، از روی کامیت‌های گیت‌هاب.', { path: '/changelog' })

  const commits = useQuery({
    queryKey: ['changelog'],
    queryFn: async (): Promise<Commit[]> => {
      const response = await fetch('/changelog.json', { cache: 'no-cache' })
      if (!response.ok) throw new Error('changelog_unavailable')
      return response.json()
    },
    staleTime: 5 * 60_000,
  })
  const features = useFeatureRequests(null)
  const [requesting, setRequesting] = useState(false)

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">تغییرات شکارگاه</h1>
        <p className="mt-1 text-sm leading-7 text-ink-muted">
          هر چیزی که از روز اول تا امروز به شکارگاه اضافه یا اصلاح شده، به ترتیب تاریخ.
        </p>
      </div>

      <div className={`${cardClass} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Sparkles size={18} strokeWidth={1.75} aria-hidden />
            قابلیت تازه می‌خواهی؟
          </h2>
          <RequestFeatureButton onOpen={() => setRequesting(true)} />
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">پیشنهادت را ثبت کن؛ در همین صفحه وضعیتش را می‌بینی.</p>

        {features.isSuccess && (features.data ?? []).length > 0 && (
          <ul className="mt-4 space-y-2">
            {(features.data ?? []).slice(0, 12).map((request) => (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-sunken px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{request.title}</span>
                  {request.body && <span className="mt-0.5 block text-[13px] text-ink-muted">{request.body}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold">
                  {FEATURE_LABELS[request.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">تاریخچه‌ی تغییرات</h2>
        {commits.isPending ? (
          <PageLoader />
        ) : commits.isError ? (
          <ErrorState error={commits.error} onRetry={() => commits.refetch()} />
        ) : (commits.data ?? []).length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={<GitCommitHorizontal size={22} strokeWidth={1.75} />} title="تاریخچه‌ای ثبت نشده" />
          </div>
        ) : (
          <ol className={`${cardClass} divide-y divide-line/70`}>
            {(commits.data ?? []).map((commit) => (
              <li key={commit.hash} className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted">
                  <GitCommitHorizontal size={15} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="text-sm font-medium leading-6">
                    {commit.subject}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
                    <span>{formatDate(commit.date)}</span>
                    <span aria-hidden>·</span>
                    <span className="ltr font-mono">{commit.hash}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {requesting && <FeatureRequestDialog onClose={() => setRequesting(false)} />}
    </section>
  )
}

function RequestFeatureButton({ onOpen }: { onOpen: () => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => (session ? onOpen() : navigate('/login', { state: { from: location.pathname } }))}
    >
      ثبت پیشنهاد
    </Button>
  )
}

function FeatureRequestDialog({ onClose }: { onClose: () => void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<unknown>(null)

  const mutation = useMutation({
    mutationFn: () => api.submitFeatureRequest({ title: title.trim(), body: body.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feature-requests'] })
      toast.success('پیشنهادت ثبت شد.')
      onClose()
    },
    onError: (caught) => setError(caught),
  })

  const submit = () => {
    if (title.trim().length < 4) {
      setError(new Error('عنوان دست‌کم ۴ نویسه باشد.'))
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog
      open
      title="پیشنهاد قابلیت"
      description="چه چیزی شکارگاه را بهتر می‌کند؟ کوتاه و روشن بنویس."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            ثبت پیشنهاد
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="عنوان">
          {(props) => <TextInput {...props} dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} />}
        </Field>
        <Field label="توضیح" optional counter={{ value: body, max: 2000 }}>
          {(props) => <TextArea {...props} dir="auto" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      </div>
    </Dialog>
  )
}
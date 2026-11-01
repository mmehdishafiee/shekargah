import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Search, ShieldCheck, ShieldOff, Users } from 'lucide-react'
import { useApi } from '@/data/api'
import { useAdminUsers } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatNumber } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

/** Admin directory of members plus the broadcast composer. */
export function AdminUsersPage() {
  useDocumentMeta('کاربران')
  const api = useApi()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [draft, setDraft] = useState(query)
  const users = useAdminUsers(query)
  const rows = users.data?.pages.flatMap((page) => page.items) ?? []
  const toast = useToast()

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'admin' }) => api.adminSetRole(id, role),
    onSuccess: async () => {
      toast.success('نقش کاربر تغییر کرد.')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })

  const search = (event: FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams(params)
    if (draft.trim()) next.set('q', draft.trim())
    else next.delete('q')
    setParams(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">کاربران</h1>
        <p className="mt-1 text-sm text-ink-muted">فهرست اعضا، تعداد محصول و رأی‌های دریافتی.</p>
      </div>

      <BroadcastForm />

      <form onSubmit={search} role="search" className="flex gap-2">
        <div className="relative flex-1">
          <Search size={17} strokeWidth={1.75} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <TextInput
            aria-label="جست‌وجوی کاربر"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="نام یا نام کاربری"
            className="ps-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          جست‌وجو
        </Button>
      </form>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {users.isPending ? (
          <PageLoader />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users size={22} strokeWidth={1.75} />} title="کاربری پیدا نشد" />
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <Avatar name={user.displayName} seed={user.id} url={user.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link to={profilePath(user.username)} className="truncate font-bold hover:underline">
                      {user.displayName}
                    </Link>
                    {user.role === 'admin' && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">مدیر</span>
                    )}
                  </p>
                  <p className="ltr truncate text-start text-xs text-ink-muted">@{user.username}</p>
                </div>
                <div className="shrink-0 text-end text-[13px] text-ink-muted">
                  <p className="font-semibold tabular-nums text-ink">{formatNumber(user.productCount)} محصول</p>
                  <p className="tabular-nums">{formatNumber(user.votesReceived)} رأی</p>
                  <p className="text-[11px]">{formatDate(user.createdAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={setRole.isPending}
                  aria-label={user.role === 'admin' ? `گرفتن دسترسی مدیریت از ${user.displayName}` : `دادن دسترسی مدیریت به ${user.displayName}`}
                  icon={user.role === 'admin' ? <ShieldOff size={15} strokeWidth={1.75} /> : <ShieldCheck size={15} strokeWidth={1.75} />}
                  onClick={() => setRole.mutate({ id: user.id, role: user.role === 'admin' ? 'user' : 'admin' })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {users.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => users.fetchNextPage()} loading={users.isFetchingNextPage}>
            کاربران بیشتر
          </Button>
        </div>
      )}
    </div>
  )
}

function BroadcastForm() {
  const api = useApi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<unknown>(null)

  const mutation = useMutation({
    mutationFn: () => api.adminBroadcast(title, body),
    onSuccess: async (count) => {
      toast.success(`پیام برای ${formatNumber(count)} کاربر ارسال شد.`)
      setTitle('')
      setBody('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (caught) => setError(caught),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
      className={`${cardClass} space-y-4 p-5`}
    >
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Megaphone size={17} strokeWidth={1.75} aria-hidden />
        پیام همگانی
      </h2>
      <p className="text-[13px] text-ink-muted">یک اعلان سیستمی برای همهٔ اعضا می‌فرستد.</p>
      <Field label="عنوان">
        {(props) => <TextInput {...props} dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} />}
      </Field>
      <Field label="متن">
        {(props) => <TextArea {...props} dir="auto" rows={3} value={body} onChange={(event) => setBody(event.target.value)} maxLength={200} />}
      </Field>
      {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={mutation.isPending} disabled={title.trim().length < 3 || body.trim().length < 3}>
          ارسال به همه
        </Button>
      </div>
    </form>
  )
}
import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, X } from 'lucide-react'
import { useApi } from '@/data/api'
import { useBannedWords } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

/** Admin list of words that block product copy and comments. */
export function AdminBannedWordsPage() {
  useDocumentMeta('عبارت‌های ممنوعه')
  const api = useApi()
  const queryClient = useQueryClient()
  const words = useBannedWords()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<unknown>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['banned-words'] })

  const add = useMutation({
    mutationFn: (word: string) => api.addBannedWord(word),
    onSuccess: async () => {
      setDraft('')
      setError(null)
      await invalidate()
    },
    onError: (caught) => setError(caught),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.removeBannedWord(id),
    onSuccess: () => invalidate(),
    onError: (caught) => setError(caught),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const word = draft.trim()
    if (word.length < 2) {
      setError(new Error('too-short'))
      return
    }
    add.mutate(word)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">عبارت‌های ممنوعه</h1>
        <p className="mt-1 text-sm text-ink-muted">
          هر محصول یا نظری که یکی از این عبارت‌ها را داشته باشد، هنگام ثبت رد می‌شود.
        </p>
      </div>

      <form onSubmit={submit} className={`${cardClass} space-y-3 p-5`}>
        <div className="flex gap-2">
          <TextInput
            aria-label="عبارت ممنوعه"
            dir="auto"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
            }}
            placeholder="مثلاً: کلاهبرداری"
            maxLength={40}
          />
          <Button type="submit" loading={add.isPending} icon={<Plus size={16} strokeWidth={2} />}>
            افزودن
          </Button>
        </div>
        {error ? (
          <Notice tone="danger">
            {error instanceof Error && error.message === 'too-short' ? 'عبارت باید دست‌کم ۲ نویسه باشد.' : errorMessage(error)}
          </Notice>
        ) : null}
      </form>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {words.isPending ? (
          <PageLoader />
        ) : words.isError ? (
          <ErrorState error={words.error} onRetry={() => words.refetch()} />
        ) : (words.data ?? []).length === 0 ? (
          <EmptyState icon={<Ban size={22} strokeWidth={1.75} />} title="هنوز عبارتی اضافه نشده" />
        ) : (
          <ul className="divide-y divide-line/70">
            {(words.data ?? []).map((word) => (
              <li key={word.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span dir="auto" className="min-w-0 flex-1 truncate text-sm">
                  {word.word}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`حذف ${word.word}`}
                  icon={<X size={15} strokeWidth={1.75} />}
                  loading={remove.isPending}
                  onClick={() => remove.mutate(word.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useApi } from '@/data/api'
import { errorMessage } from '@/lib/errors'
import { validateEmail } from '@/lib/validation'
import { Button } from '@/components/ui/Button'

/** Newsletter signup used in the page sidebar. Idempotent and silent about duplicates. */
export function NewsletterSignup() {
  const api = useApi()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: (value: string) => api.subscribeNewsletter({ email: value, source: 'sidebar' }),
    onSuccess: () => {
      setDone(true)
      setEmail('')
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = validateEmail(email)
    setError(problem)
    if (problem) return
    mutation.mutate(email)
  }

  if (done) {
    return (
      <p role="status" className="text-sm font-medium text-success-700">
        ثبت شد. خبرنامه‌ی شکارگاه را برایت می‌فرستیم.
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor="newsletter-email" className="block text-sm font-semibold text-ink">
        خبرنامه
      </label>
      <p className="text-[13px] text-ink-muted">محصولات تازه‌ی هر هفته را در ایمیلت بگیر.</p>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(undefined)
          }}
          placeholder="you@example.com"
          aria-invalid={Boolean(error)}
          className="h-9 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none"
        />
        <Button type="submit" size="sm" loading={mutation.isPending} icon={<Mail size={15} strokeWidth={1.75} />}>
          عضویت
        </Button>
      </div>
      {error && <p className="text-xs text-danger-700">{error}</p>}
      {mutation.isError && <p className="text-xs text-danger-700">{errorMessage(mutation.error)}</p>}
    </form>
  )
}
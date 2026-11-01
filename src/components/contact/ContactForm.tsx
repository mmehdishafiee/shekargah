import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useApi } from '@/data/api'
import { errorMessage } from '@/lib/errors'
import { validateEmail } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

/** In-site contact form. The message lands in the admin inbox. */
export function ContactForm() {
  const api = useApi()
  const [values, setValues] = useState({ name: '', email: '', subject: '', body: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({})
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      api.submitContactMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        body: values.body.trim(),
      }),
    onSuccess: () => {
      setSent(true)
      setValues({ name: '', email: '', subject: '', body: '' })
    },
  })

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSent(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found: Partial<Record<keyof typeof values, string>> = {}
    if (values.name.trim().length < 2) found.name = 'نام را وارد کنید.'
    const emailProblem = validateEmail(values.email)
    if (emailProblem) found.email = emailProblem
    if (values.subject.trim().length < 2) found.subject = 'موضوع را بنویسید.'
    if (values.body.trim().length < 10) found.body = 'متن پیام دست‌کم ۱۰ نویسه باشد.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className={`${cardClass} space-y-4 p-5 sm:p-6`}>
      <div>
        <h2 className="text-base font-bold">فرم تماس</h2>
        <p className="mt-1 text-[13px] text-ink-muted">پیامت مستقیم به صندوق تیم شکارگاه می‌رسد.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام" error={errors.name}>
          {(props) => <TextInput {...props} value={values.name} onChange={(event) => set('name', event.target.value)} />}
        </Field>
        <Field label="ایمیل" error={errors.email}>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              dir="ltr"
              className="text-start"
              autoComplete="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="موضوع" error={errors.subject}>
        {(props) => <TextInput {...props} value={values.subject} onChange={(event) => set('subject', event.target.value)} />}
      </Field>

      <Field label="پیام" error={errors.body} counter={{ value: values.body, max: 3000 }}>
        {(props) => (
          <TextArea {...props} dir="auto" rows={5} value={values.body} onChange={(event) => set('body', event.target.value)} />
        )}
      </Field>

      {sent && <Notice tone="success">پیامت رسید. ممنون که نوشتی — به‌زودی جواب می‌دهیم.</Notice>}
      {mutation.isError && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}

      <Button type="submit" loading={mutation.isPending} icon={<Send size={16} strokeWidth={1.75} aria-hidden />}>
        فرستادن پیام
      </Button>
    </form>
  )
}
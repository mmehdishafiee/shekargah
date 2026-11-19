import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import { useApi } from '@/data/api'
import { useCompanies } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

/** Admin CRUD for company profiles and their members. */
export function AdminCompaniesPage() {
  useDocumentMeta('شرکت‌ها')
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const companies = useCompanies()
  const [form, setForm] = useState({ slug: '', name: '', description: '', websiteUrl: '', members: '' })
  const [error, setError] = useState<unknown>(null)

  const create = useMutation({
    mutationFn: () =>
      api.adminSaveCompany({
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description,
        websiteUrl: form.websiteUrl,
        isActive: true,
        members: form.members
          .split(',')
          .map((member) => member.trim().replace(/^@/, ''))
          .filter(Boolean),
      }),
    onSuccess: async () => {
      toast.success('شرکت ساخته شد.')
      setForm({ slug: '', name: '', description: '', websiteUrl: '', members: '' })
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (caught) => setError(caught),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  const items = companies.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">شرکت‌ها</h1>
        <p className="mt-1 text-sm text-ink-muted">پروفایل سازمانی بساز و اعضایش را با نام کاربری وصل کن.</p>
      </div>

      <form onSubmit={submit} className={`${cardClass} space-y-4 p-5`}>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Plus size={17} strokeWidth={2} aria-hidden />
          شرکت تازه
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام شرکت">
            {(props) => <TextInput {...props} dir="auto" value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} />}
          </Field>
          <Field label="نشانی (slug)" hint="فقط حروف کوچک انگلیسی، عدد و خط تیره.">
            {(props) => (
              <TextInput
                {...props}
                dir="ltr"
                value={form.slug}
                onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                className="text-start"
              />
            )}
          </Field>
        </div>
        <Field label="توضیح" optional>
          {(props) => <TextArea {...props} dir="auto" rows={2} value={form.description} onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="وب‌سایت" optional>
            {(props) => (
              <TextInput {...props} dir="ltr" type="url" value={form.websiteUrl} onChange={(event) => setForm((f) => ({ ...f, websiteUrl: event.target.value }))} className="text-start" />
            )}
          </Field>
          <Field label="اعضا" optional hint="نام کاربری‌ها با کاما جدا شوند.">
            {(props) => (
              <TextInput {...props} dir="ltr" value={form.members} onChange={(event) => setForm((f) => ({ ...f, members: event.target.value }))} className="text-start" />
            )}
          </Field>
        </div>
        {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
        <div className="flex justify-end">
          <Button type="submit" loading={create.isPending} disabled={!form.name.trim() || !form.slug.trim()}>
            ساخت شرکت
          </Button>
        </div>
      </form>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {companies.isPending ? (
          <PageLoader />
        ) : companies.isError ? (
          <ErrorState error={companies.error} onRetry={() => companies.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Building2 size={22} strokeWidth={1.75} />} title="هنوز شرکتی ثبت نشده" />
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((company) => (
              <li key={company.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{company.name}</p>
                  <p className="ltr truncate text-start text-xs text-ink-muted">/{company.slug}</p>
                </div>
                <p className="shrink-0 text-[13px] text-ink-muted">
                  {formatNumber(company.productCount)} محصول · {formatNumber(company.memberCount)} عضو
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
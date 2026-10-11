import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ImagePlus, X } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { useCategories } from '@/data/queries'
import type { Product } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { productPath, profilePath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { IMAGE_TYPES, LIMITS, hasErrors, validateProduct, type FieldErrors, type ProductFormValues } from '@/lib/validation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

const EMPTY: ProductFormValues = { name: '', tagline: '', description: '', websiteUrl: '', categoryId: '', logo: null }

export function SubmitPage() {
  useDocumentMeta('معرفی محصول')
  const [submitted, setSubmitted] = useState<Product | null>(null)
  return (
    <div className="mx-auto max-w-2xl">
      {submitted ? <SubmissionReceived product={submitted} onAnother={() => setSubmitted(null)} /> : <SubmitForm onDone={setSubmitted} />}
    </div>
  )
}

function SubmitForm({ onDone }: { onDone(product: Product): void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const categories = useCategories()
  const [values, setValues] = useState<ProductFormValues>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<keyof ProductFormValues>>({})
  const preview = useObjectUrl(values.logo)

  const mutation = useMutation({
    mutationFn: () => api.submitProduct(values),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ['maker-products'] })
      onDone(product)
      window.scrollTo({ top: 0 })
    },
  })

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateProduct(values)
    setErrors(found)
    if (hasErrors(found)) {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      first?.focus()
      return
    }
    mutation.mutate()
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold">معرفی محصول</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        محصولت بعد از ثبت، در صف بررسی مدیران قرار می‌گیرد و پس از تأیید در شکارگاه منتشر می‌شود.
      </p>

      <form onSubmit={submit} noValidate className={`${cardClass} mt-6 space-y-6 p-5 sm:p-7`}>
        <Field label="نام محصول" error={errors.name} counter={{ value: values.name, max: LIMITS.productName.max }}>
          {(props) => <TextInput {...props} dir="auto" value={values.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />}
        </Field>

        <Field
          label="معرفی کوتاه"
          hint="یک جمله که بگوید محصول چه کاری انجام می‌دهد. در فهرست محصولات نمایش داده می‌شود."
          error={errors.tagline}
          counter={{ value: values.tagline, max: LIMITS.tagline.max }}
        >
          {(props) => <TextInput {...props} dir="auto" value={values.tagline} onChange={(e) => set('tagline', e.target.value)} autoComplete="off" />}
        </Field>

        <Field
          label="توضیحات"
          hint="برای چه کسانی ساخته شده، چه مشکلی را حل می‌کند و چه چیزی آن را متفاوت می‌کند."
          error={errors.description}
          counter={{ value: values.description, max: LIMITS.description.max }}
        >
          {(props) => (
            <TextArea {...props} dir="auto" rows={7} value={values.description} onChange={(e) => set('description', e.target.value)} />
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="نشانی وب‌سایت" error={errors.websiteUrl}>
            {(props) => (
              <TextInput
                {...props}
                type="url"
                dir="ltr"
                inputMode="url"
                placeholder="https://"
                value={values.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                className="text-start"
              />
            )}
          </Field>
          <Field label="دسته‌بندی" error={errors.categoryId ?? (categories.isError ? 'دسته‌بندی‌ها بارگذاری نشد. صفحه را تازه کن.' : undefined)}>
            {(props) => (
              <Select {...props} value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} disabled={categories.isPending}>
                <option value="">{categories.isPending ? 'در حال بارگذاری…' : 'انتخاب کنید'}</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="لوگو"
          optional
          hint={`تصویر مربعی PNG، JPG یا WebP تا ${formatBytes(LIMITS.logoBytes)}.`}
          error={errors.logo}
        >
          {(props) => (
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-sunken text-ink-muted">
                {preview ? <img src={preview} alt="پیش‌نمایش لوگو" className="size-full object-cover" /> : <ImagePlus size={22} strokeWidth={1.5} aria-hidden />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600">
                  {values.logo ? 'تغییر تصویر' : 'انتخاب تصویر'}
                  <input
                    {...props}
                    type="file"
                    accept={IMAGE_TYPES.join(',')}
                    className="sr-only"
                    onChange={(e) => {
                      set('logo', e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {values.logo && (
                  <Button variant="ghost" size="sm" icon={<X size={15} strokeWidth={1.75} />} onClick={() => set('logo', null)}>
                    حذف
                  </Button>
                )}
              </div>
            </div>
          )}
        </Field>

        {mutation.isError && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}

        <div className="flex flex-col-reverse gap-3 border-t border-line/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">با ثبت محصول، تأیید می‌کنی که اطلاعات درست است و قوانین شکارگاه را خوانده‌ای.</p>
          <Button type="submit" loading={mutation.isPending} className="sm:min-w-36">
            ثبت برای بررسی
          </Button>
        </div>
      </form>
    </>
  )
}

function SubmissionReceived({ product, onAnother }: { product: Product; onAnother(): void }) {
  const { profile } = useAuth()
  return (
    <div className={`${cardClass} px-6 py-10 text-center sm:px-10`}>
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-50 text-success-700">
        <CheckCircle2 size={28} strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-extrabold">«{product.name}» ثبت شد</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        محصولت در صف بررسی است و تا وقتی مدیران تأییدش نکنند، فقط خودت آن را می‌بینی. نتیجه‌ی بررسی را در صفحه‌ی پروفایلت می‌توانی دنبال کنی.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {profile && (
          <ButtonLink to={profilePath(profile.username)} variant="secondary">
            دیدن وضعیت ارسال‌ها
          </ButtonLink>
        )}
        <ButtonLink to={productPath(product.slug)} variant="secondary">
          پیش‌نمایش صفحه‌ی محصول
        </ButtonLink>
        <Button onClick={onAnother}>معرفی محصول دیگر</Button>
      </div>
    </div>
  )
}

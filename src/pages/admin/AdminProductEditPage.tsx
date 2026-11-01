import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, X } from 'lucide-react'
import { useApi } from '@/data/api'
import { useCategories, useProduct, useTags } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { productPath } from '@/lib/paths'
import { IMAGE_TYPES, LIMITS, validateProduct, type FieldErrors } from '@/lib/validation'
import { ProductLogo } from '@/components/product/ProductLogo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Notice, PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

export function AdminProductEditPage() {
  const { slug = '' } = useParams()
  const product = useProduct(slug)
  if (product.isPending) return <PageLoader />
  if (product.isError) return <Notice tone="danger">{errorMessage(product.error)}</Notice>
  if (!product.data) return <Notice tone="danger">محصول پیدا نشد.</Notice>
  return <EditForm product={product.data} />
}

function EditForm({ product }: { product: NonNullable<ReturnType<typeof useProduct>['data']> }) {
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const categories = useCategories()
  const tags = useTags()
  const [values, setValues] = useState({
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    websiteUrl: product.websiteUrl,
    categoryId: product.category?.id ?? '',
    selectedTags: product.tags.map((tag) => tag.slug),
  })
  const [logo, setLogo] = useState<File | null>(null)
  const [screenshots, setScreenshots] = useState(product.screenshots)
  const [newScreenshots, setNewScreenshots] = useState<File[]>([])
  const [credit, setCredit] = useState({
    role: product.creditRole,
    makerUsername: product.makerCredit?.username ?? '',
    makerName: product.makerCreditName ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors<'name' | 'tagline' | 'description' | 'websiteUrl' | 'categoryId' | 'tags' | 'logo' | 'screenshots'>>({})

  const previewLogo = logo ? URL.createObjectURL(logo) : product.logoUrl
  const previewShots = useMemo(
    () => newScreenshots.map((file) => ({ url: URL.createObjectURL(file), file })),
    [newScreenshots],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const found = validateProduct({
        name: values.name,
        tagline: values.tagline,
        description: values.description,
        websiteUrl: values.websiteUrl,
        categoryId: values.categoryId,
        tags: values.selectedTags,
        logo,
        screenshots: [...newScreenshots],
        creditRole: product.creditRole,
        makerCreditUsername: '',
        makerCreditName: product.makerCreditName ?? '',
      })
      if (Object.keys(found).length > 0) {
        setErrors(found)
        throw new Error('validation')
      }
      await api.adminUpdateProduct({ id: product.id, ...values, categoryId: values.categoryId })
      if (logo) await api.setProductLogo(product.id, logo)
      await api.setProductCredit(product.id, {
        role: credit.role,
        makerUsername: credit.makerUsername || undefined,
        makerName: credit.makerName || undefined,
      })
      await api.setProductTags(product.id, values.selectedTags)
      await api.setProductScreenshots(product.id, {
        keep: screenshots.map((shot) => ({ key: shot.key, alt: shot.alt })),
        add: newScreenshots,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product', product.slug] }),
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ])
      toast.success(`«${values.name}» به‌روزرسانی شد.`)
      navigate(productPath(values.name))
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  const addShots = (files: File[]) => {
    const total = screenshots.length + newScreenshots.length + files.length
    setNewScreenshots((current) => [...current, ...files].slice(0, Math.max(0, LIMITS.screenshots.max - screenshots.length)))
    if (total > LIMITS.screenshots.max) setErrors((current) => ({ ...current, screenshots: `حداکثر ${LIMITS.screenshots.max} اسکرین‌شات مجاز است.` }))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">ویرایش محصول</h1>
          <p className="mt-1 text-sm text-ink-muted">تغییرات اینجا مستقیماً روی محصول منتشرشده اعمال می‌شود.</p>
        </div>
        <ButtonLink to={productPath(product.slug)} variant="secondary">انصراف</ButtonLink>
      </div>

      <form onSubmit={submit} noValidate className={`${cardClass} space-y-6 p-5 sm:p-7`}>
        <Field label="نام محصول" error={errors.name} counter={{ value: values.name, max: LIMITS.productName.max }}>
          {(props) => <TextInput {...props} dir="auto" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
        </Field>
        <Field label="معرفی کوتاه" error={errors.tagline} counter={{ value: values.tagline, max: LIMITS.tagline.max }}>
          {(props) => <TextInput {...props} dir="auto" value={values.tagline} onChange={(e) => setValues((v) => ({ ...v, tagline: e.target.value }))} />}
        </Field>
        <Field label="توضیحات" error={errors.description} counter={{ value: values.description, max: LIMITS.description.max }}>
          {(props) => <TextArea {...props} dir="auto" rows={8} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="نشانی وب‌سایت" error={errors.websiteUrl}>
            {(props) => <TextInput {...props} dir="ltr" type="url" value={values.websiteUrl} onChange={(e) => setValues((v) => ({ ...v, websiteUrl: e.target.value }))} />}
          </Field>
          <Field label="دسته‌بندی" error={errors.categoryId}>
            {(props) => <Select {...props} value={values.categoryId} onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))}>
              <option value="">انتخاب کنید</option>
              {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>}
          </Field>
        </div>
        <Field label="برچسب‌ها" error={errors.tags}>
          {() => <div className="flex flex-wrap gap-2">
            {tags.data?.map((tag) => {
              const selected = values.selectedTags.includes(tag.slug)
              return <button key={tag.id} type="button" aria-pressed={selected} onClick={() => setValues((v) => ({ ...v, selectedTags: selected ? v.selectedTags.filter((s) => s !== tag.slug) : [...v.selectedTags, tag.slug] }))} className={`rounded-full border px-3 py-1.5 text-sm ${selected ? 'border-ink bg-ink text-canvas' : 'border-line text-ink-muted'}`}>#{tag.name}</button>
            })}
          </div>}
        </Field>

        <Field label="نسبت محصول" hint="سازنده یعنی خودش ساخته؛ شکارچی یعنی فقط کشف و ثبت کرده.">
          {() => (
            <div className="space-y-3">
              <div role="radiogroup" aria-label="نسبت محصول" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['maker', 'سازنده'],
                    ['hunter', 'شکارچی'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={credit.role === value}
                    onClick={() => setCredit((current) => ({ ...current, role: value }))}
                    className={`rounded-control border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      credit.role === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {credit.role === 'hunter' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="نام سازنده‌ی واقعی" optional>
                    {(props) => (
                      <TextInput {...props} dir="auto" value={credit.makerName} onChange={(event) => setCredit((current) => ({ ...current, makerName: event.target.value }))} />
                    )}
                  </Field>
                  <Field label="نام کاربری سازنده" optional>
                    {(props) => (
                      <TextInput
                        {...props}
                        dir="ltr"
                        className="text-start"
                        value={credit.makerUsername}
                        onChange={(event) => setCredit((current) => ({ ...current, makerUsername: event.target.value.toLowerCase() }))}
                      />
                    )}
                  </Field>
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="لوگو" optional hint={`PNG، JPG یا WebP تا ${formatBytes(LIMITS.logoBytes)}.`} error={errors.logo}>
          {(props) => <div className="flex items-center gap-4">
            <ProductLogo name={values.name} seed={product.slug} url={previewLogo} size={72} />
            <label className="inline-flex h-9 cursor-pointer items-center rounded-control border border-line-strong px-3.5 text-sm font-medium">
              تغییر لوگو<input {...props} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
            </label>
          </div>}
        </Field>

        <Field label="اسکرین‌شات‌ها" optional hint={`حداکثر ${LIMITS.screenshots.max} تصویر؛ ${formatBytes(LIMITS.screenshotBytes)} برای هر تصویر.`} error={errors.screenshots}>
          {(props) => <div className="space-y-3">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-control border border-line-strong px-3.5 text-sm font-medium">
              افزودن تصویر<input {...props} type="file" multiple accept={IMAGE_TYPES.join(',')} className="sr-only" onChange={(e) => addShots(Array.from(e.target.files ?? []))} />
            </label>
            <div className="flex flex-wrap gap-2">
              {screenshots.map((shot) => <div key={shot.key} className="group relative"><img src={shot.url} alt={shot.alt ?? 'اسکرین‌شات محصول'} className="size-24 rounded-lg border object-cover" /><button type="button" aria-label="حذف اسکرین‌شات" onClick={() => setScreenshots((current) => current.filter((s) => s.key !== shot.key))} className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"><X size={12} /></button></div>)}
              {previewShots.map(({ url, file }, index) => <div key={`${file.name}-${index}`} className="group relative"><img src={url} alt={file.name} className="size-24 rounded-lg border object-cover" /><button type="button" aria-label="حذف اسکرین‌شات جدید" onClick={() => setNewScreenshots((current) => current.filter((_, i) => i !== index))} className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"><X size={12} /></button></div>)}
            </div>
          </div>}
        </Field>

        {mutation.isError && mutation.error instanceof Error && mutation.error.message !== 'validation' && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}
        <div className="flex justify-end border-t border-line/70 pt-5"><Button type="submit" loading={mutation.isPending} icon={<Save size={16} />}>ذخیره تغییرات</Button></div>
      </form>
    </div>
  )
}

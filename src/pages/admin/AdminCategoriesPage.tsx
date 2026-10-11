import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApi } from '@/data/api'
import { useCategories } from '@/data/queries'
import type { Category } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { LIMITS, compact, hasErrors } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { ErrorState, Notice, Spinner } from '@/components/ui/Feedback'
import { Field, TextInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

export function AdminCategoriesPage() {
  const categories = useCategories(true)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()

  const remove = async () => {
    if (!deleting) return
    await api.deleteCategory(deleting.id)
    toast.success(`دسته‌ی «${deleting.name}» حذف شد.`)
    await queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  if (categories.isPending) {
    return (
      <div className="flex justify-center py-12 text-ink-muted">
        <Spinner label="در حال بارگذاری دسته‌بندی‌ها" />
      </div>
    )
  }
  if (categories.isError) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">{formatNumber(categories.data.length)} دسته</p>
        <Button size="sm" icon={<Plus size={16} strokeWidth={2} />} onClick={() => setEditing('new')}>
          دسته‌ی تازه
        </Button>
      </div>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line/70 text-start text-[13px] text-ink-muted">
              <th scope="col" className="px-4 py-3 text-start font-medium">نام</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">نامک</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">ترتیب</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">وضعیت</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">اقدام‌ها</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {categories.data.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{category.name}</p>
                  {category.description && <p className="text-[13px] text-ink-muted">{category.description}</p>}
                </td>
                <td className="ltr px-4 py-3 text-start font-mono text-[13px] text-ink-muted">{category.slug}</td>
                <td className="px-4 py-3 tabular-nums">{formatNumber(category.sortOrder)}</td>
                <td className="px-4 py-3">
                  {category.isActive ? (
                    <span className="text-success-700">فعال</span>
                  ) : (
                    <span className="text-ink-muted">غیرفعال</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={`ویرایش ${category.name}`} onClick={() => setEditing(category)}>
                      <Pencil size={15} strokeWidth={1.75} />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`حذف ${category.name}`} onClick={() => setDeleting(category)}>
                      <Trash2 size={15} strokeWidth={1.75} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="حذف دسته‌بندی"
        description={`«${deleting?.name ?? ''}» حذف می‌شود. دسته‌ای که محصول دارد حذف‌شدنی نیست؛ می‌توانی غیرفعالش کنی.`}
        confirmLabel="حذف دسته"
        tone="danger"
        onConfirm={remove}
      />
    </div>
  )
}

function CategoryDialog({ category, onClose }: { category: Category | null; onClose(): void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    sortOrder: String(category?.sortOrder ?? 100),
    isActive: category?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    const order = Number(values.sortOrder)
    const found = compact({
      name:
        values.name.trim().length < LIMITS.categoryName.min || values.name.trim().length > LIMITS.categoryName.max
          ? 'نام باید بین ۲ تا ۴۰ نویسه باشد.'
          : undefined,
      slug: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.slug.trim()) && values.slug.trim().length <= 40
        ? undefined
        : 'فقط حروف کوچک انگلیسی، عدد و خط تیره؛ مثل developer-tools',
      description: values.description.trim().length > LIMITS.categoryDescription.max ? 'توضیح نباید بیشتر از ۲۰۰ نویسه باشد.' : undefined,
      sortOrder: Number.isInteger(order) ? undefined : 'یک عدد صحیح وارد کن.',
    })
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      await api.saveCategory({ id: category?.id, ...values, sortOrder: order })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('دسته‌بندی ذخیره شد.')
      onClose()
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  const set = (key: keyof typeof values, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }))

  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? 'ویرایش دسته‌بندی' : 'دسته‌بندی تازه'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={() => save()} loading={busy}>
            ذخیره
          </Button>
        </>
      }
    >
      <form onSubmit={save} noValidate className="space-y-4">
        <Field label="نام" error={errors.name}>
          {(props) => <TextInput {...props} dir="auto" value={values.name} onChange={(e) => set('name', e.target.value)} />}
        </Field>
        <Field label="نامک (در نشانی صفحه)" error={errors.slug}>
          {(props) => (
            <TextInput {...props} dir="ltr" className="text-start" value={values.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
          )}
        </Field>
        <Field label="توضیح کوتاه" optional error={errors.description}>
          {(props) => <TextInput {...props} dir="auto" value={values.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <Field label="ترتیب نمایش" hint="عدد کوچک‌تر زودتر نمایش داده می‌شود." error={errors.sortOrder}>
          {(props) => (
            <TextInput {...props} type="number" dir="ltr" className="text-start" value={values.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          )}
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={values.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 accent-brand-600" />
          فعال (در فهرست‌ها و فرم ثبت محصول نمایش داده شود)
        </label>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

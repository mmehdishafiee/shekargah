import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, ShieldQuestion } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { useEditRequests } from '@/data/queries'
import type { Product } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { productPath } from '@/lib/paths'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'

/** Owner/admin edit, "suggest an edit" and "I built this" for one product. */
export function ProductActionsExtra({ product }: { product: Product }) {
  const { session, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isOwner = session?.userId === product.maker.id
  const claimable = product.creditRole === 'hunter' && !product.makerCredit
  const [suggesting, setSuggesting] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const requests = useEditRequests('pending')
  const myPending =
    Boolean(session) &&
    (requests.data ?? []).some((request) => request.productId === product.id && request.requester.id === session?.userId)

  const requireLogin = () => navigate('/login', { state: { from: location.pathname } })

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {(isOwner || isAdmin) && (
        <Link
          to={`${productPath(product.slug)}/edit`}
          className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-sunken"
        >
          <Pencil size={15} strokeWidth={1.75} aria-hidden />
          ویرایش محصول
        </Link>
      )}

      {!isOwner && myPending && (
        <span className="inline-flex h-9 items-center rounded-control border border-line bg-sunken px-3 text-[13px] font-medium text-ink-muted">
          پیشنهاد شما در انتظار بررسی است
        </span>
      )}

      {!isOwner && !myPending && (
        <Button
          variant="secondary"
          size="sm"
          icon={<Pencil size={15} strokeWidth={1.75} aria-hidden />}
          onClick={() => (session ? setSuggesting(true) : requireLogin())}
        >
          پیشنهاد ویرایش
        </Button>
      )}

      {claimable && (
        <Button
          variant="ghost"
          size="sm"
          icon={<ShieldQuestion size={15} strokeWidth={1.75} aria-hidden />}
          onClick={() => (session ? setClaiming(true) : requireLogin())}
        >
          سازنده‌ی این محصولم
        </Button>
      )}

      {suggesting && <SuggestEditDialog product={product} onClose={() => setSuggesting(false)} />}
      {claiming && <ClaimDialog product={product} claimantName={profile?.displayName ?? ''} onClose={() => setClaiming(false)} />}
    </div>
  )
}

function SuggestEditDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState({
    tagline: '',
    description: '',
    websiteUrl: '',
    note: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<unknown>(null)
  const [uploading, setUploading] = useState(false)

  const submit = async () => {
    setError(null)
    const payload: Record<string, unknown> = {}
    if (values.tagline.trim()) payload.tagline = values.tagline.trim()
    if (values.description.trim()) payload.description = values.description.trim()
    if (values.websiteUrl.trim()) payload.website_url = values.websiteUrl.trim()
    if (Object.keys(payload).length === 0 && files.length === 0) {
      setError(new Error('دست‌کم یک مورد را تغییر بده یا تصویر اضافه کن.'))
      return
    }
    try {
      setUploading(true)
      if (files.length > 0) {
        const keys: { object_key: string }[] = []
        for (const file of files.slice(0, 3)) keys.push({ object_key: await api.uploadEditScreenshot(file) })
        payload.screenshots = keys
      }
      await api.submitEditRequest({ productId: product.id, payload, note: values.note.trim() || null })
      await queryClient.invalidateQueries({ queryKey: ['edit-requests'] })
      toast.success('پیشنهادت ثبت شد و برای بررسی فرستاده شد.')
      onClose()
    } catch (caught) {
      setError(caught)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open
      title="پیشنهاد ویرایش"
      description="فقط فیلدهایی را پر کن که می‌خواهی عوض شوند. پیشنهاد پس از تأیید سازنده یا مدیر اعمال می‌شود."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            انصراف
          </Button>
          <Button onClick={submit} loading={uploading}>
            فرستادن پیشنهاد
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="تگ‌لاین تازه" optional>
          {(props) => <TextInput {...props} dir="auto" value={values.tagline} onChange={(event) => setValues((v) => ({ ...v, tagline: event.target.value }))} />}
        </Field>
        <Field label="توضیح تازه" optional>
          {(props) => <TextArea {...props} dir="auto" rows={4} value={values.description} onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))} />}
        </Field>
        <Field label="وب‌سایت تازه" optional>
          {(props) => (
            <TextInput {...props} dir="ltr" className="text-start" value={values.websiteUrl} onChange={(event) => setValues((v) => ({ ...v, websiteUrl: event.target.value }))} />
          )}
        </Field>
        <Field label="تصاویر تازه" hint="تا ۳ تصویر (PNG/JPG/WebP)." optional>
          {(props) => (
            <input
              {...props}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))}
              className="block w-full text-sm text-ink-muted file:me-3 file:rounded-control file:border-0 file:bg-sunken file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          )}
        </Field>
        <Field label="یادداشت برای بررسی‌کننده" optional>
          {(props) => <TextInput {...props} dir="auto" value={values.note} onChange={(event) => setValues((v) => ({ ...v, note: event.target.value }))} />}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      </div>
    </Dialog>
  )
}

function ClaimDialog({ product, claimantName, onClose }: { product: Product; claimantName: string; onClose: () => void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [proof, setProof] = useState('')
  const [error, setError] = useState<unknown>(null)

  const mutation = useMutation({
    mutationFn: () => api.submitMakerClaim({ productId: product.id, proof: proof.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['maker-claims'] })
      toast.success('درخواستت ثبت شد. مدیر بررسی می‌کند.')
      onClose()
    },
    onError: (caught) => setError(caught),
  })

  return (
    <Dialog
      open
      title="سازنده‌ی این محصولم"
      description={`اگر «${product.name}» را ساخته‌ای، توضیح بده چطور می‌توانی این را ثابت کنی. مدیر بررسی می‌کند${claimantName ? ` و نتیجه را به ${claimantName} اطلاع می‌دهد` : ''}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            ثبت درخواست
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="توضیح / مدرک" hint="مثلاً اکانت سازنده، ایمیل دامنه، یا لینک پروفایل." optional>
          {(props) => <TextArea {...props} dir="auto" rows={4} value={proof} onChange={(event) => setProof(event.target.value)} />}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      </div>
    </Dialog>
  )
}
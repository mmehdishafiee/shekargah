import { useState } from 'react'
import { useApi } from '@/data/api'
import type { ReportReason } from '@/data/types'
import { errorMessage, isApiError } from '@/lib/errors'
import { LIMITS } from '@/lib/validation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextArea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { REPORT_REASONS } from './reportReasons'

interface ReportDialogProps {
  open: boolean
  onClose(): void
  target: { productId: string } | { commentId: string }
}

export function ReportDialog({ open, onClose, target }: ReportDialogProps) {
  const api = useApi()
  const toast = useToast()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const isComment = 'commentId' in target

  const close = () => {
    setError(null)
    setDetails('')
    onClose()
  }

  const submit = async () => {
    if (details.trim().length > LIMITS.reportDetails.max) return
    setBusy(true)
    setError(null)
    try {
      await api.reportContent({ ...target, reason, details })
      toast.success('گزارشت ثبت شد. مدیران بررسی‌اش می‌کنند.')
      close()
    } catch (caught) {
      if (isApiError(caught, 'duplicate')) {
        toast.success('قبلاً این مورد را گزارش داده‌ای.')
        close()
      } else setError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={isComment ? 'گزارش نظر' : 'گزارش محصول'}
      description="گزارش‌ها فقط برای مدیران قابل مشاهده است."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={submit} loading={busy}>
            ثبت گزارش
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">دلیل گزارش</legend>
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="report-reason"
                value={key}
                checked={reason === key}
                onChange={() => setReason(key)}
                className="size-4 accent-brand-600"
              />
              {REPORT_REASONS[key]}
            </label>
          ))}
        </fieldset>
        <Field label="توضیح بیشتر" optional counter={{ value: details, max: LIMITS.reportDetails.max }}>
          {(props) => <TextArea {...props} dir="auto" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />}
        </Field>
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      </div>
    </Dialog>
  )
}

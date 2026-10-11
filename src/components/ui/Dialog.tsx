import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'
import { Field, TextArea } from './Field'
import { Notice } from './Feedback'
import { errorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'

interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  onClose(): void
  children: ReactNode
  footer?: ReactNode
}

export function Dialog({ open, title, description, onClose, children, footer }: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>('textarea, input, select, button:not([data-close])')
    ;(focusable ?? panel)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && panel) {
        const items = panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-card bg-surface p-6 shadow-pop focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="-m-1.5 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="بستن"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {description && <div className="mt-1.5 text-sm text-ink-muted">{description}</div>}
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** Ask for a reason; when `required`, confirming without one is blocked. */
  reason?: { label: string; required?: boolean; max?: number; hint?: string }
  onConfirm(reason: string): Promise<unknown> | void
  onClose(): void
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'primary', reason, onConfirm, onClose }: ConfirmDialogProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [fieldError, setFieldError] = useState<string>()

  const close = () => {
    if (busy) return
    setText('')
    setError(null)
    setFieldError(undefined)
    onClose()
  }

  const confirm = async () => {
    const max = reason?.max ?? 500
    if (reason?.required && !text.trim()) return setFieldError('این فیلد را پر کنید.')
    if (text.trim().length > max) return setFieldError(`حداکثر ${formatNumber(max)} نویسه مجاز است.`)
    setBusy(true)
    setError(null)
    try {
      await onConfirm(text.trim())
      setText('')
      setFieldError(undefined)
      onClose()
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            انصراف
          </Button>
          <Button variant={tone} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {reason && (
          <Field label={reason.label} hint={reason.hint} error={fieldError} optional={!reason.required} counter={{ value: text, max: reason.max ?? 500 }}>
            {(props) => <TextArea {...props} dir="auto" value={text} onChange={(e) => setText(e.target.value)} rows={3} />}
          </Field>
        )}
        {Boolean(error) && <Notice tone="danger">{errorMessage(error)}</Notice>}
      </div>
    </Dialog>
  )
}

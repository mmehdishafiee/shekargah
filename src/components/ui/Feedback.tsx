import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, RotateCcw, TriangleAlert } from 'lucide-react'
import { errorMessage } from '@/lib/errors'

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <svg
      className="animate-spin text-current"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-muted">
      <Spinner size={28} label={label} />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full bg-sunken text-ink-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'بارگذاری انجام نشد' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-danger-50 text-danger-600">
        <TriangleAlert size={22} strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{errorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken"
        >
          <RotateCcw size={16} strokeWidth={1.75} />
          تلاش دوباره
        </button>
      )}
    </div>
  )
}

const NOTICE_STYLES = {
  info: { box: 'border-line bg-sunken text-ink', icon: Info },
  success: { box: 'border-success-700/20 bg-success-50 text-success-700', icon: CheckCircle2 },
  warning: { box: 'border-warning-700/20 bg-warning-50 text-warning-700', icon: AlertCircle },
  danger: { box: 'border-danger-600/20 bg-danger-50 text-danger-700', icon: TriangleAlert },
} as const

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof NOTICE_STYLES
  title?: string
  children?: ReactNode
}) {
  const { box, icon: Icon } = NOTICE_STYLES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-control border px-4 py-3 text-sm ${box}`}>
      <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function ProductRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 px-4 py-4" aria-hidden>
      <div className="size-14 shrink-0 rounded-xl bg-sunken" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-sunken" />
        <div className="h-3 w-2/3 rounded bg-sunken" />
      </div>
      <div className="h-16 w-14 rounded-xl bg-sunken" />
    </div>
  )
}

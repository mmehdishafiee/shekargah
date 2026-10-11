import type { ProductStatus } from '@/data/types'

const STYLES: Record<ProductStatus, { label: string; className: string }> = {
  pending: { label: 'در انتظار بررسی', className: 'bg-warning-50 text-warning-700 ring-warning-700/20' },
  published: { label: 'منتشرشده', className: 'bg-success-50 text-success-700 ring-success-700/20' },
  rejected: { label: 'ردشده', className: 'bg-danger-50 text-danger-700 ring-danger-600/20' },
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  const { label, className } = STYLES[status]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${className}`}>{label}</span>
}

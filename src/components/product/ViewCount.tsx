import { Eye } from 'lucide-react'
import { formatNumber } from '@/lib/format'

export function ViewCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-muted" aria-label={`${formatNumber(count)} بازدید`}>
      <Eye size={14} strokeWidth={1.75} aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {formatNumber(count)}
      </span>
    </span>
  )
}

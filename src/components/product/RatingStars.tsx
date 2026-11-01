import { Star } from 'lucide-react'
import { formatNumber } from '@/lib/format'

/** Read-only star display. `value` is 0–5 and may be fractional. */
export function RatingStars({ value, size = 15 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`امتیاز ${formatNumber(value)} از ۵`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={1.75}
          className={star <= rounded ? 'fill-warning-700 text-warning-700' : 'text-line-strong'}
          aria-hidden
        />
      ))}
    </span>
  )
}

/** Interactive star picker used in the review form. */
export function RatingPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="امتیاز" className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ستاره`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="rounded p-0.5 disabled:opacity-50"
        >
          <Star
            size={26}
            strokeWidth={1.75}
            className={star <= value ? 'fill-warning-700 text-warning-700' : 'text-line-strong hover:text-warning-700'}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}
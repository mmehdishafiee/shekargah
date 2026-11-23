import { BadgeCheck } from 'lucide-react'

/** Shows the "بررسی‌شده توسط انسان" mark that admins can grant to a product. */
export function VerifiedBadge({ size = 15, withLabel = false }: { size?: number; withLabel?: boolean }) {
  if (withLabel) {
    return (
      <span
        aria-hidden="true"
        title="بررسی‌شده توسط انسان"
        className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[12px] font-semibold text-success-700"
      >
        <BadgeCheck size={size} strokeWidth={2} aria-hidden />
        بررسی‌شده توسط انسان
      </span>
    )
  }
  return (
    <span title="بررسی‌شده توسط انسان" aria-label="بررسی‌شده توسط انسان" className="inline-flex text-success-700">
      <BadgeCheck size={size} strokeWidth={2} aria-hidden />
    </span>
  )
}
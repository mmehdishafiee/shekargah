/**
 * Shekargah mark: an abstract «ش» — three dots over the teeth of «س» —
 * on a rounded square in hunter orange.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--color-brand-600)" />
      <g fill="#fff">
        <circle cx="16" cy="7.6" r="1.9" />
        <circle cx="12.6" cy="11.6" r="1.9" />
        <circle cx="19.4" cy="11.6" r="1.9" />
      </g>
      <path
        d="M8 16.4v2.6a4 4 0 0 0 8 0v-2.6m0 2.6a4 4 0 0 0 8 0v-2.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-extrabold tracking-normal text-ink">شکارگاه</span>
    </span>
  )
}

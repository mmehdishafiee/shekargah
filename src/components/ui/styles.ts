export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken active:bg-line',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim()
}

export const inputClass =
  'block w-full rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-sunken aria-[invalid=true]:border-danger-600 aria-[invalid=true]:focus:ring-danger-50'

export const cardClass = 'rounded-card border border-line bg-surface shadow-card'

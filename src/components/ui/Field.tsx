import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { formatNumber } from '@/lib/format'
import { inputClass } from './styles'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  optional?: boolean
  counter?: { value: string; max: number }
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, optional, counter, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  const length = counter ? counter.value.trim().length : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ms-1.5 text-xs font-normal text-ink-muted">(اختیاری)</span>}
        </label>
        {counter && (
          <span className={`text-xs tabular-nums ${length > counter.max ? 'text-danger-600' : 'text-ink-muted'}`} aria-hidden>
            {formatNumber(length)} / {formatNumber(counter.max)}
          </span>
        )}
      </div>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} className="text-[13px] text-danger-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-[13px] text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} h-10 ${className}`} {...props} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-24 py-2 leading-relaxed ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} h-10 pe-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

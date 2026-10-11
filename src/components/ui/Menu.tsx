import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
  label: string
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  triggerClassName?: string
}

/** Small disclosure menu: closes on outside click, Escape and item selection. */
export function Menu({ label, trigger, children, triggerClassName = '' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute end-0 top-full z-40 mt-2 min-w-52 rounded-control border border-line bg-surface/95 p-1.5 shadow-pop backdrop-blur-md"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-ink hover:bg-sunken focus-visible:bg-sunken'

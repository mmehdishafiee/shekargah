import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { getStoredTheme, setTheme, watchSystemTheme, type ThemeMode } from '@/lib/theme'

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'روشن', icon: Sun },
  { value: 'dark', label: 'تیره', icon: Moon },
  { value: 'system', label: 'سیستم', icon: Monitor },
]

/** Three-way theme switch (روشن / تیره / سیستم) persisted in localStorage. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme())

  useEffect(() => watchSystemTheme(mode), [mode])

  const choose = (next: ThemeMode) => {
    setMode(next)
    setTheme(next)
  }

  return (
    <div role="group" aria-label="حالت نمایش" className="flex items-center gap-0.5 rounded-full bg-sunken p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`grid size-8 place-items-center rounded-full transition-colors ${
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
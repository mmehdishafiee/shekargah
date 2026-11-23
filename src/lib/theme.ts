export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'shekargah:theme'

export function getStoredTheme(): ThemeMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

/** Resolves the effective theme and toggles the `dark` class on <html>. */
export function applyTheme(mode: ThemeMode): void {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage unavailable: the theme still applies for this page view.
  }
  applyTheme(mode)
}

/** Keeps `system` mode in sync with OS changes. Returns an unsubscribe function. */
export function watchSystemTheme(mode: ThemeMode): () => void {
  if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => applyTheme('system')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Runs before React mounts so the first paint already matches the theme. */
export function initTheme(): ThemeMode {
  const mode = getStoredTheme()
  applyTheme(mode)
  return mode
}
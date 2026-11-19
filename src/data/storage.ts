export const STORAGE_PREFIX = 'supabase'
export const R2_PREFIX = 'r2'

export type StorageProvider = 'supabase' | 'r2'

export function prefixed(provider: StorageProvider, objectPath: string): string {
  return `${provider}:${objectPath}`
}

export function parseStored(value: string | null | undefined): { provider: StorageProvider; path: string | null } {
  if (!value) return { provider: 'supabase', path: null }
  const [provider, path] = value.split(':', 2)
  if ((provider === STORAGE_PREFIX || provider === R2_PREFIX) && path) return { provider, path }
  return { provider: 'supabase', path: value }
}

export function storagePath(value: string | null | undefined): string | null {
  return parseStored(value).path
}

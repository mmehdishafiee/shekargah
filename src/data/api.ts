import { createContext, useContext } from 'react'
import { env } from '@/lib/env'
import type { ShekargahApi } from './types'

export const ApiContext = createContext<ShekargahApi | null>(null)

export function useApi(): ShekargahApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used inside <ApiContext.Provider>')
  return api
}

export async function createDefaultApi(): Promise<ShekargahApi> {
  if (!env.isConfigured) {
    throw new Error('Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  }
  const { createSupabaseApi } = await import('./supabaseApi')
  return createSupabaseApi(env.supabaseUrl, env.supabaseKey)
}

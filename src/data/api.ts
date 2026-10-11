import { createContext, useContext } from 'react'
import { env } from '@/lib/env'
import type { ShekargahApi } from './types'

export const ApiContext = createContext<ShekargahApi | null>(null)

export function useApi(): ShekargahApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used inside <ApiContext.Provider>')
  return api
}

/** Loads only the backend in use, so demo builds never ship supabase-js and vice versa. */
export async function createDefaultApi(): Promise<ShekargahApi> {
  if (env.isDemo) {
    const { createDemoApi } = await import('./demoApi')
    return createDemoApi({ latencyMs: 250 })
  }
  const { createSupabaseApi } = await import('./supabaseApi')
  return createSupabaseApi(env.supabaseUrl, env.supabaseKey)
}

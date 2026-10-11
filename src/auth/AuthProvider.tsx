import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/data/api'
import type { Session } from '@/data/types'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true
    void api.getSession().then((initial) => {
      if (!active) return
      setSession(initial)
      setLoading(false)
    })
    const unsubscribe = api.onAuthChange((next, event) => {
      setSession((previous) => (previous?.userId === next?.userId ? previous : next))
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Votes, private submissions and admin data depend on who is signed in.
        void queryClient.invalidateQueries()
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api, queryClient])

  const userId = session?.userId ?? null
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    queryFn: () => api.getProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
  const { refetch } = profileQuery

  const refreshProfile = useCallback(async () => {
    await refetch()
  }, [refetch])

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), [])

  const value = useMemo<AuthState>(() => {
    const profile = userId ? (profileQuery.data ?? null) : null
    return {
      loading: loading || (Boolean(userId) && profileQuery.isPending),
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      passwordRecovery,
      clearPasswordRecovery,
      refreshProfile,
    }
  }, [loading, session, userId, profileQuery.data, profileQuery.isPending, passwordRecovery, clearPasswordRecovery, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { useState, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { ApiContext } from '@/data/api'
import type { ShekargahApi } from '@/data/types'
import { createQueryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ api, queryClient, children }: { api: ShekargahApi; queryClient?: QueryClient; children: ReactNode }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ApiContext.Provider>
  )
}

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Authorization and validation errors will not fix themselves.
        retry: (count, error) => !(error instanceof ApiError && error.code !== 'network' && error.code !== 'unknown') && count < 2,
      },
    },
  })
}

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/useAuth'
import { useApi } from './api'
import type { LeaderboardPeriod, ProductQuery, ProductStatus } from './types'

export const keys = {
  categories: (includeInactive: boolean) => ['categories', includeInactive] as const,
  tags: () => ['tags'] as const,
  feed: (query: Omit<ProductQuery, 'page'>) => ['feed', query] as const,
  product: (slug: string) => ['product', slug] as const,
  dailyProducts: (date: string | null) => ['daily-products', date] as const,
  leaderboard: (period: LeaderboardPeriod) => ['leaderboard', period] as const,
  trending: () => ['trending'] as const,
  votes: (userId: string | null, ids: string[]) => ['votes', userId, ids] as const,
  savedIds: (userId: string | null, ids: string[]) => ['saved', userId, ids] as const,
  savedProducts: (userId: string | null) => ['saved-products', userId] as const,
  comments: (productId: string) => ['comments', productId] as const,
  profile: (username: string) => ['profile', username] as const,
  makerProducts: (makerId: string, viewerId: string | null) => ['maker-products', makerId, viewerId] as const,
  adminProducts: (status: ProductStatus) => ['admin', 'products', status] as const,
  reports: (filter: 'open' | 'all') => ['admin', 'reports', filter] as const,
}

export function useCategories(includeInactive = false) {
  const api = useApi()
  return useQuery({
    queryKey: keys.categories(includeInactive),
    queryFn: () => api.listCategories({ includeInactive }),
    staleTime: 5 * 60_000,
  })
}

export function useTags() {
  const api = useApi()
  return useQuery({ queryKey: keys.tags(), queryFn: () => api.listTags(), staleTime: 5 * 60_000 })
}

export function useProductFeed(query: Omit<ProductQuery, 'page'>) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.feed(query),
    queryFn: ({ pageParam }) => api.listProducts({ ...query, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(slug: string) {
  const api = useApi()
  return useQuery({ queryKey: keys.product(slug), queryFn: () => api.getProduct(slug) })
}

export function useDailyProducts(date: string | null) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.dailyProducts(date),
    queryFn: ({ pageParam }) => api.listDailyProducts({ date: date ?? undefined, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.leaderboard(period),
    queryFn: ({ pageParam }) => api.listLeaderboard({ period, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useTrending() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.trending(),
    queryFn: ({ pageParam }) => api.listTrending(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
}

/** Ids of the given products the signed-in user has voted for. */
export function useMyVotes(productIds: string[]) {
  const api = useApi()
  const { session } = useAuth()
  const ids = [...productIds].sort()
  return useQuery({
    queryKey: keys.votes(session?.userId ?? null, ids),
    queryFn: async () => new Set(await api.listMyVotes(ids)),
    enabled: Boolean(session) && ids.length > 0,
    placeholderData: keepPreviousData,
  })
}

/** Ids of the given products the signed-in user has saved. */
export function useMySavedIds(productIds: string[]) {
  const api = useApi()
  const { session } = useAuth()
  const ids = [...productIds].sort()
  return useQuery({
    queryKey: keys.savedIds(session?.userId ?? null, ids),
    queryFn: async () => new Set(await api.listMySavedProductIds(ids)),
    enabled: Boolean(session) && ids.length > 0,
    placeholderData: keepPreviousData,
  })
}

export function useSavedProducts() {
  const api = useApi()
  const { session } = useAuth()
  return useInfiniteQuery({
    queryKey: keys.savedProducts(session?.userId ?? null),
    queryFn: ({ pageParam }) => api.listMySavedProducts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(session),
  })
}

export function useComments(productId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: keys.comments(productId ?? ''),
    queryFn: () => api.listComments(productId!),
    enabled: Boolean(productId),
  })
}

export function useProfileByUsername(username: string) {
  const api = useApi()
  return useQuery({ queryKey: keys.profile(username), queryFn: () => api.getProfileByUsername(username) })
}

export function useMakerProducts(makerId: string | undefined) {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: keys.makerProducts(makerId ?? '', session?.userId ?? null),
    queryFn: () => api.listMakerProducts(makerId!),
    enabled: Boolean(makerId),
  })
}

export function useAdminProducts(status: ProductStatus) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.adminProducts(status),
    queryFn: ({ pageParam }) => api.listProductsByStatus(status, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function useReports(filter: 'open' | 'all') {
  const api = useApi()
  return useQuery({ queryKey: keys.reports(filter), queryFn: () => api.listReports(filter) })
}

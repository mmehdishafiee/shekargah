import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/useAuth'
import { useApi } from './api'
import type { ContactStatus, FeatureStatus, LeaderboardPeriod, ProductQuery, ProductStatus, ReviewStatus } from './types'

export const keys = {
  categories: (includeInactive: boolean) => ['categories', includeInactive] as const,
  tags: () => ['tags'] as const,
  feed: (query: Omit<ProductQuery, 'page'>) => ['feed', query] as const,
  product: (slug: string) => ['product', slug] as const,
  dailyProducts: (date: string | null) => ['daily-products', date] as const,
  leaderboard: (period: LeaderboardPeriod, anchor: string | null = null) => ['leaderboard', period, anchor] as const,
  trending: () => ['trending'] as const,
  votes: (userId: string | null, ids: string[]) => ['votes', userId, ids] as const,
  savedIds: (userId: string | null, ids: string[]) => ['saved', userId, ids] as const,
  savedProducts: (userId: string | null) => ['saved-products', userId] as const,
  comments: (productId: string) => ['comments', productId] as const,
  profile: (username: string) => ['profile', username] as const,
  makerProducts: (makerId: string, viewerId: string | null) => ['maker-products', makerId, viewerId] as const,
  adminProducts: (status: ProductStatus) => ['admin', 'products', status] as const,
  reports: (filter: 'open' | 'all') => ['admin', 'reports', filter] as const,
  followCounts: (profileId: string) => ['follow-counts', profileId] as const,
  isFollowing: (viewerId: string | null, profileId: string) => ['is-following', viewerId, profileId] as const,
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

export function useTopics() {
  const api = useApi()
  return useQuery({ queryKey: ['topics'], queryFn: () => api.listTopics(), staleTime: 2 * 60_000 })
}

export function useTopMakers() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['top-makers'],
    queryFn: ({ pageParam }) => api.listTopMakers(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
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

export function useLeaderboard(period: LeaderboardPeriod, anchor: string | null = null) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: keys.leaderboard(period, anchor),
    queryFn: ({ pageParam }) => api.listLeaderboard({ period, page: pageParam, anchor }),
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

export function useReviews(productId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['reviews', productId ?? ''],
    queryFn: () => api.listReviews(productId!),
    enabled: Boolean(productId),
  })
}

export function useSponsors() {
  const api = useApi()
  return useQuery({ queryKey: ['sponsors'], queryFn: () => api.listSponsors(), staleTime: 5 * 60_000 })
}

export function useNotifications() {
  const api = useApi()
  const { session } = useAuth()
  return useInfiniteQuery({
    queryKey: ['notifications', session?.userId ?? null],
    queryFn: ({ pageParam }) => api.listNotifications(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(session),
  })
}

export function useUnreadNotifications() {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['notifications-unread', session?.userId ?? null],
    queryFn: () => api.unreadNotificationCount(),
    enabled: Boolean(session),
    staleTime: 30_000,
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

export function useCollections() {
  const api = useApi()
  return useQuery({ queryKey: ['collections'], queryFn: () => api.listCollections(), staleTime: 2 * 60_000 })
}

export function useCollectionProducts(slug: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['collection', slug],
    queryFn: ({ pageParam }) => api.listCollectionProducts(slug, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(slug),
  })
}

export function usePersonalFeed() {
  const api = useApi()
  const { session } = useAuth()
  return useInfiniteQuery({
    queryKey: ['personal-feed', session?.userId ?? null],
    queryFn: ({ pageParam }) => api.listPersonalFeed(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(session),
  })
}

export function useAdminUsers(query: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['admin-users', query],
    queryFn: ({ pageParam }) => api.listUsersOverview(query, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function useBannedWords() {
  const api = useApi()
  return useQuery({ queryKey: ['banned-words'], queryFn: () => api.listBannedWords() })
}

export function useCompanies() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['companies'],
    queryFn: ({ pageParam }) => api.listCompanies(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function useCompany(slug: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: ['company', slug ?? ''], queryFn: () => api.getCompany(slug!), enabled: Boolean(slug) })
}

export function useCompanyProducts(slug: string | undefined) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['company-products', slug ?? ''],
    queryFn: ({ pageParam }) => api.listCompanyProducts(slug!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(slug),
  })
}

export function useNewsletterSubscribers() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['newsletter-subscribers'],
    queryFn: ({ pageParam }) => api.listNewsletterSubscribers(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function usePosts() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) => api.listPosts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function usePost(slug: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: ['post', slug ?? ''], queryFn: () => api.getPost(slug!), enabled: Boolean(slug) })
}

export function useSiteStats() {
  const api = useApi()
  return useQuery({ queryKey: ['site-stats'], queryFn: () => api.siteStats(), staleTime: 5 * 60_000 })
}

export function useAdminPosts() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['admin-posts'],
    queryFn: ({ pageParam }) => api.adminListPosts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
}

export function useAdminPost(id: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: ['admin-post', id ?? ''], queryFn: () => api.adminGetPost(id!), enabled: Boolean(id) })
}

export function useTopHunters() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['top-hunters'],
    queryFn: ({ pageParam }) => api.listTopHunters(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useDailyWinners(days = 7, perDay = 5) {
  const api = useApi()
  return useQuery({
    queryKey: ['daily-winners', days, perDay],
    queryFn: () => api.listDailyWinners({ days, perDay }),
    staleTime: 2 * 60_000,
  })
}

export function useFollowCounts(profileId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: keys.followCounts(profileId ?? ''),
    queryFn: () => api.followCounts(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  })
}

export function useIsFollowing(profileId: string | undefined) {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: keys.isFollowing(session?.userId ?? null, profileId ?? ''),
    queryFn: () => api.isFollowing(profileId as string),
    enabled: Boolean(profileId && session),
    staleTime: 30_000,
  })
}

/** Follow or unfollow, then refresh the watching counts and the bell. */
export function useFollowToggle(profileId: string | undefined, username: string) {
  const api = useApi()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (next: boolean) => (next ? api.followUser(username) : api.unfollowUser(username)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.isFollowing(session?.userId ?? null, profileId ?? '') }),
        queryClient.invalidateQueries({ queryKey: keys.followCounts(profileId ?? '') }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
      ])
    },
  })
}

export function useMyCollections() {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['my-collections', session?.userId ?? null],
    queryFn: () => api.listMyCollections(),
    enabled: Boolean(session),
    staleTime: 15_000,
  })
}

export function useProfileCollections(profileId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['profile-collections', profileId ?? ''],
    queryFn: () => api.listProfileCollections(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 15_000,
  })
}

export function useSavedCollections() {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['saved-collections', session?.userId ?? null],
    queryFn: () => api.listSavedCollections(),
    enabled: Boolean(session),
    staleTime: 15_000,
  })
}

export function useCollection(slug: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['collection', slug],
    queryFn: () => api.getCollection(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
  })
}

/** Invalidate every list surface after a list or its contents change. */
function useCollectionInvalidator(slug?: string) {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['collections'] }),
      queryClient.invalidateQueries({ queryKey: ['my-collections'] }),
      queryClient.invalidateQueries({ queryKey: ['saved-collections'] }),
      queryClient.invalidateQueries({ queryKey: ['profile-collections'] }),
      queryClient.invalidateQueries({ queryKey: ['collection-products', slug ?? ''] }),
      queryClient.invalidateQueries({ queryKey: ['collection', slug ?? ''] }),
    ])
  }
}

export function useCreateCollection() {
  const api = useApi()
  const invalidate = useCollectionInvalidator()
  return useMutation({
    mutationFn: (input: { name: string; description?: string | null; isPublic?: boolean }) => api.createCollection(input),
    onSuccess: invalidate,
  })
}

export function useDeleteCollection(slug: string) {
  const api = useApi()
  const invalidate = useCollectionInvalidator(slug)
  return useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: invalidate,
  })
}

export function useSetCollectionSaved(collectionId: string, slug: string) {
  const api = useApi()
  const invalidate = useCollectionInvalidator(slug)
  return useMutation({
    mutationFn: (saved: boolean) => api.setCollectionSaved(collectionId, saved),
    onSuccess: invalidate,
  })
}

export function useCollectionItems(collectionId: string | undefined, slug: string) {
  const api = useApi()
  const invalidate = useCollectionInvalidator(slug)
  const add = useMutation({
    mutationFn: (productId: string) => api.addProductToCollection(collectionId as string, productId),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (productId: string) => api.removeProductFromCollection(collectionId as string, productId),
    onSuccess: invalidate,
  })
  return { add, remove }
}

export function useEditRequests(status: ReviewStatus = 'pending') {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['edit-requests', status, session?.userId ?? null],
    queryFn: () => api.listEditRequests(status),
    enabled: Boolean(session),
    staleTime: 15_000,
  })
}

export function useMakerClaims(status: ReviewStatus = 'pending') {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['maker-claims', status, session?.userId ?? null],
    queryFn: () => api.listMakerClaims(status),
    enabled: Boolean(session),
    staleTime: 15_000,
  })
}

export function useContactMessages(status: ContactStatus = 'new') {
  const api = useApi()
  return useQuery({
    queryKey: ['contact-messages', status],
    queryFn: () => api.listContactMessages(status),
    staleTime: 15_000,
  })
}

export function useFeatureRequests(status: FeatureStatus | null = null) {
  const api = useApi()
  return useQuery({
    queryKey: ['feature-requests', status],
    queryFn: () => api.listFeatureRequests(status),
    staleTime: 30_000,
  })
}

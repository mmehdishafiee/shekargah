export type ProductStatus = 'pending' | 'published' | 'rejected'
export type SortOrder = 'popular' | 'newest'
export type LeaderboardPeriod = 'daily' | 'weekly'
export type Role = 'user' | 'admin'
export type ReportReason = 'spam' | 'inappropriate' | 'misleading' | 'copyright' | 'other'
export type ReportStatus = 'open' | 'resolved' | 'dismissed'
export type ModerationAction = 'approve' | 'reject' | 'unpublish'

export const PAGE_SIZE = 20

export interface Session {
  userId: string
  email: string
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export interface CategoryRef {
  id: string
  slug: string
  name: string
}

export interface Tag {
  id: string
  slug: string
  name: string
}

export interface TagRef {
  slug: string
  name: string
}

export interface ProfileSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface Profile extends ProfileSummary {
  bio: string | null
  role: Role
  createdAt: string
}

export interface ProductSummary {
  id: string
  slug: string
  name: string
  tagline: string
  logoUrl: string | null
  votesCount: number
  commentsCount: number
  viewsCount: number
  publishedAt: string | null
  category: CategoryRef | null
  tags: TagRef[]
}

/** A product with its position in a ranked list (daily, leaderboard, trending). */
export interface RankedProduct extends ProductSummary {
  rank: number
  score: number | null
}

export interface Product extends ProductSummary {
  description: string
  websiteUrl: string
  status: ProductStatus
  maker: ProfileSummary
  moderationNote: string | null
  moderatedAt: string | null
  moderatorName: string | null
  createdAt: string
}

export interface Comment {
  id: string
  productId: string
  body: string
  createdAt: string
  author: ProfileSummary
}

export interface Report {
  id: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  createdAt: string
  resolvedAt: string | null
  reporter: ProfileSummary | null
  product: { id: string; slug: string; name: string; status: ProductStatus } | null
  comment: { id: string; body: string; product: { slug: string; name: string } | null } | null
}

export interface ProductQuery {
  search?: string
  category?: string
  /** Products carrying at least one of these tag slugs. */
  tags?: string[]
  sort: SortOrder
  page: number
}

export interface Page<T> {
  items: T[]
  total: number
  hasMore: boolean
}

export interface SubmitProductInput {
  name: string
  tagline: string
  description: string
  websiteUrl: string
  categoryId: string
  tags: string[]
  logo: File | null
}

export interface ProfileUpdate {
  username: string
  displayName: string
  bio: string
  avatar?: File | null
  removeAvatar?: boolean
}

export interface CategoryInput {
  id?: string
  slug: string
  name: string
  description: string
  sortOrder: number
  isActive: boolean
}

export interface ReportInput {
  productId?: string
  commentId?: string
  reason: ReportReason
  details: string
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER'

/**
 * Everything the UI needs from a backend. Two implementations exist:
 * `supabaseApi` (production) and `demoApi` (browser-only sample data).
 * Authorization is enforced by the database; the demo mirrors the same rules.
 */
export interface ShekargahApi {
  readonly mode: 'demo' | 'supabase'

  getSession(): Promise<Session | null>
  onAuthChange(listener: (session: Session | null, event: AuthEvent) => void): () => void
  signUp(input: { email: string; password: string; displayName: string }): Promise<{ needsConfirmation: boolean }>
  signIn(input: { email: string; password: string }): Promise<void>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>

  getProfile(userId: string): Promise<Profile | null>
  getProfileByUsername(username: string): Promise<Profile | null>
  updateProfile(userId: string, input: ProfileUpdate): Promise<Profile>

  listCategories(options?: { includeInactive?: boolean }): Promise<Category[]>
  listTags(): Promise<Tag[]>
  listProducts(query: ProductQuery): Promise<Page<ProductSummary>>
  getProduct(slug: string): Promise<Product | null>
  listMakerProducts(makerId: string): Promise<Product[]>
  submitProduct(input: SubmitProductInput): Promise<Product>
  deleteProduct(productId: string): Promise<void>
  setProductTags(productId: string, slugs: string[]): Promise<void>

  /** Products published on a Tehran calendar day (defaults to today). */
  listDailyProducts(input: { date?: string; page: number }): Promise<Page<RankedProduct>>
  /** Products ranked by votes received inside a window, not lifetime totals. */
  listLeaderboard(input: { period: LeaderboardPeriod; page: number }): Promise<Page<RankedProduct>>
  /** Products with the fastest recent engagement. */
  listTrending(page: number): Promise<Page<RankedProduct>>
  recordProductView(productId: string, viewerKey: string): Promise<void>

  listMyVotes(productIds: string[]): Promise<string[]>
  vote(productId: string): Promise<void>
  unvote(productId: string): Promise<void>

  listMySavedProductIds(productIds: string[]): Promise<string[]>
  listMySavedProducts(page: number): Promise<Page<ProductSummary>>
  saveProduct(productId: string): Promise<void>
  unsaveProduct(productId: string): Promise<void>

  listComments(productId: string): Promise<Comment[]>
  addComment(productId: string, body: string): Promise<Comment>
  deleteComment(commentId: string): Promise<void>

  reportContent(input: ReportInput): Promise<void>

  listProductsByStatus(status: ProductStatus, page: number): Promise<Page<Product>>
  moderateProduct(productId: string, action: ModerationAction, note?: string): Promise<void>
  saveCategory(input: CategoryInput): Promise<Category>
  deleteCategory(categoryId: string): Promise<void>
  listReports(filter: 'open' | 'all'): Promise<Report[]>
  resolveReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<void>
}

export type ProductStatus = 'pending' | 'published' | 'rejected'
export type SortOrder = 'popular' | 'newest'
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
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

/** A category/topic with discovery metadata. */
export interface Topic {
  slug: string
  name: string
  description: string | null
  productCount: number
  recentVotes: number
}

/** A maker ranked by the votes their published products received. */
export interface TopMaker {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  productCount: number
  votesTotal: number
  rank: number
}

export interface ProfileSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface ProfileLinks {
  websiteUrl: string | null
  xUsername: string | null
  telegramUsername: string | null
  linkedinUsername: string | null
  githubUsername: string | null
}

export interface Profile extends ProfileSummary, ProfileLinks {
  bio: string | null
  role: Role
  createdAt: string
}

/** One day's top products, as shown on the home page. */
export interface DailyGroup {
  day: string
  items: (ProductSummary & { rank: number; categoryName: string | null })[]
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
  ratingAvg: number
  ratingCount: number
  verified: boolean
  publishedAt: string | null
  category: CategoryRef | null
  tags: TagRef[]
}

export type CreditRole = 'maker' | 'hunter'

/** A hunter who discovered products, ranked by the votes those products got. */
export interface TopHunter {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  huntCount: number
  votesTotal: number
  rank: number
}

export type NotificationKind = 'vote' | 'comment' | 'review' | 'approved' | 'rejected' | 'system'

export interface Notification {
  id: string
  kind: NotificationKind
  productId: string | null
  productSlug: string | null
  productName: string | null
  body: string | null
  read: boolean
  createdAt: string
  actor: { username: string; displayName: string } | null
}

export interface Review {
  id: string
  rating: number
  body: string | null
  createdAt: string
  author: ProfileSummary
}

export interface Sponsor {
  id: string
  name: string
  tagline: string | null
  url: string
  logoUrl: string | null
}

export interface Collection {
  slug: string
  name: string
  description: string | null
  productCount: number
}

export interface Company {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  productCount: number
  memberCount: number
}

export interface CompanyDetail {
  id: string
  slug: string
  name: string
  description: string | null
  websiteUrl: string | null
  logoUrl: string | null
  isActive: boolean
}

export interface NewsletterSubscriber {
  email: string
  source: string | null
  createdAt: string
}

export interface AdminCompanyInput {
  id?: string | null
  slug: string
  name: string
  description: string
  websiteUrl: string
  isActive: boolean
  members: string[]
}

export interface PostSummary {
  id: string
  slug: string
  title: string
  excerpt: string | null
  coverUrl: string | null
  tags: string[]
  publishedAt: string | null
  author: ProfileSummary | null
}

export interface Post extends PostSummary {
  content: string
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
}

export interface AdminPostRow {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published'
  tags: string[]
  publishedAt: string | null
  updatedAt: string
}

export interface AdminPostInput {
  id?: string | null
  slug: string
  title: string
  excerpt: string
  content: string
  seoTitle: string
  seoDescription: string
  tags: string[]
  status: 'draft' | 'published'
}

export interface SiteStats {
  products: number
  makers: number
  votes: number
}

export interface AdminUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: Role
  createdAt: string
  productCount: number
  votesReceived: number
}

/** A product with its position in a ranked list (daily, leaderboard, trending). */
export interface RankedProduct extends ProductSummary {
  rank: number
  score: number | null
}

export interface ProductScreenshot {
  url: string
  key: string
  alt: string | null
}

export interface Product extends ProductSummary {
  description: string
  websiteUrl: string
  status: ProductStatus
  maker: ProfileSummary
  creditRole: CreditRole
  /** The credited maker when a hunter submitted the product. */
  makerCredit: ProfileSummary | null
  makerCreditName: string | null
  hunter: ProfileSummary | null
  company: { id: string; slug: string; name: string } | null
  screenshots: ProductScreenshot[]
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

export interface ProductCreditInput {
  role: CreditRole
  /** Username of the credited maker when they have a Shekargah account. */
  makerUsername?: string
  /** Free-text name of the credited maker when they have no account. */
  makerName?: string
}

export interface SubmitProductInput {
  name: string
  tagline: string
  description: string
  websiteUrl: string
  categoryId: string
  tags: string[]
  logo: File | null
  screenshots: File[]
  credit: ProductCreditInput
}

export interface ProfileUpdate extends Partial<ProfileLinks> {
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

export interface AdminProductUpdate {
  id: string
  name: string
  tagline: string
  description: string
  websiteUrl: string
  categoryId: string
}

export interface ReportInput {
  productId?: string
  commentId?: string
  reason: ReportReason
  details: string
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER'

/**
 * Everything the UI needs from a backend. `supabaseApi` is the only production
 * implementation. `demoApi` is a test fixture — never wired to the real app.
 */
export type OAuthProvider = 'google' | 'github'

export interface ShekargahApi {
  readonly mode: 'supabase' | 'demo'

  getSession(): Promise<Session | null>
  onAuthChange(listener: (session: Session | null, event: AuthEvent) => void): () => void
  signUp(input: { email: string; password: string; displayName: string }): Promise<{ needsConfirmation: boolean }>
  signIn(input: { email: string; password: string }): Promise<void>
  signInWithOAuth(provider: OAuthProvider, redirectTo: string): Promise<void>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>

  getProfile(userId: string): Promise<Profile | null>
  getProfileByUsername(username: string): Promise<Profile | null>
  updateProfile(userId: string, input: ProfileUpdate): Promise<Profile>

  listCategories(options?: { includeInactive?: boolean }): Promise<Category[]>
  /** Categories with product counts and 7-day vote activity. */
  listTopics(): Promise<Topic[]>
  /** Makers ranked by votes received on their published products. */
  listTopMakers(page: number): Promise<Page<TopMaker>>
  /** Adds an address to the newsletter list; idempotent. */
  subscribeNewsletter(input: { email: string; source?: string }): Promise<void>
  listTags(): Promise<Tag[]>
  listProducts(query: ProductQuery): Promise<Page<ProductSummary>>
  getProduct(slug: string): Promise<Product | null>
  listMakerProducts(makerId: string): Promise<Product[]>
  submitProduct(input: SubmitProductInput): Promise<Product>
  deleteProduct(productId: string): Promise<void>
  setProductTags(productId: string, slugs: string[]): Promise<void>
  /** Admin-only: update a product's content fields (not status/counters/maker). */
  adminUpdateProduct(input: AdminProductUpdate): Promise<void>
  /** Attach a logo to an existing product (maker on unpublished, admin anywhere). */
  setProductLogo(productId: string, logo: File): Promise<void>
  /** Replace a product's screenshots with the given files + kept existing keys. */
  setProductScreenshots(productId: string, input: { keep: { key: string; alt: string | null }[]; add: File[] }): Promise<void>

  /** Products published on a Tehran calendar day (defaults to today). */
  listDailyProducts(input: { date?: string; page: number }): Promise<Page<RankedProduct>>
  /** Top products of each recent day (the home discovery surface). */
  listDailyWinners(input: { days?: number; perDay?: number }): Promise<DailyGroup[]>
  /** Products ranked by votes received inside a window, not lifetime totals. */
  listLeaderboard(input: { period: LeaderboardPeriod; page: number; anchor?: string | null }): Promise<Page<RankedProduct>>
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

  listReviews(productId: string): Promise<Review[]>
  submitReview(input: { productId: string; rating: number; body: string }): Promise<void>
  deleteReview(productId: string): Promise<void>

  listSponsors(): Promise<Sponsor[]>

  listCollections(): Promise<Collection[]>
  listCollectionProducts(slug: string, page: number): Promise<Page<ProductSummary>>

  /** Hunters ranked by votes their discovered products received. */
  listTopHunters(page: number): Promise<Page<TopHunter>>
  /** Set who gets credit for a product (submitter on their drafts, admin anywhere). */
  setProductCredit(productId: string, input: ProductCreditInput): Promise<void>

  /** Recommended products for the signed-in visitor. */
  listPersonalFeed(page: number): Promise<Page<ProductSummary>>

  listCompanies(page: number): Promise<Page<Company>>
  getCompany(slug: string): Promise<CompanyDetail | null>
  listCompanyProducts(slug: string, page: number): Promise<Page<ProductSummary>>
  adminSaveCompany(input: AdminCompanyInput): Promise<string>
  setProductCompany(productId: string, companyId: string | null): Promise<void>
  listNewsletterSubscribers(page: number): Promise<Page<NewsletterSubscriber>>

  listNotifications(page: number): Promise<Page<Notification>>
  unreadNotificationCount(): Promise<number>
  markAllNotificationsRead(): Promise<void>

  reportContent(input: ReportInput): Promise<void>

  listProductsByStatus(status: ProductStatus, page: number): Promise<Page<Product>>
  moderateProduct(productId: string, action: ModerationAction, note?: string): Promise<void>
  saveCategory(input: CategoryInput): Promise<Category>
  deleteCategory(categoryId: string): Promise<void>
  listReports(filter: 'open' | 'all'): Promise<Report[]>
  resolveReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<void>

  listPosts(page: number): Promise<Page<PostSummary>>
  getPost(slug: string): Promise<Post | null>
  siteStats(): Promise<SiteStats>

  /** Admin-only moderation helpers. */
  adminListPosts(page: number): Promise<Page<AdminPostRow>>
  adminGetPost(id: string): Promise<Post | null>
  adminSavePost(input: AdminPostInput): Promise<string>
  adminDeletePost(id: string): Promise<void>
  adminBroadcast(title: string, body: string): Promise<number>
  listBannedWords(): Promise<{ id: string; word: string }[]>
  addBannedWord(word: string): Promise<void>
  removeBannedWord(id: string): Promise<void>
  listUsersOverview(query: string, page: number): Promise<Page<AdminUser>>
  adminSetRole(profileId: string, role: Role): Promise<void>
  /** Grant or remove the "بررسی‌شده توسط انسان" mark. Admin only. */
  setProductVerified(productId: string, verified: boolean): Promise<void>
}

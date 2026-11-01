import { AuthError, createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type ApiErrorCode } from '@/lib/errors'
import { toWebpFile } from '@/lib/image'
import { normalizeFa } from '@/lib/text'
import { parseStored } from './storage'
import {
  PAGE_SIZE,
  type AdminPostRow,
  type AdminUser,
  type Category,
  type Comment,
  type Company,
  type NewsletterSubscriber,
  type PostSummary,
  type Notification,
  type Product,
  type DailyGroup,
  type ProductStatus,
  type ProductSummary,
  type Profile,
  type ProfileSummary,
  type RankedProduct,
  type Report,
  type Role,
  type Session,
  type ShekargahApi,
  type Tag,
  type TagRef,
  type TopHunter,
  type TopMaker,
} from './types'

// ---------------------------------------------------------------------------
// Row shapes returned by PostgREST for the selects below.
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  bio?: string | null
  role?: 'user' | 'admin'
  created_at?: string
  website_url?: string | null
  x_username?: string | null
  telegram_username?: string | null
  linkedin_username?: string | null
  github_username?: string | null
}

interface CategoryRow {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

interface ProductRow {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  website_url: string
  logo_path: string | null
  status: ProductStatus
  votes_count: number
  comments_count: number
  views_count: number
  rating_avg: number
  rating_count: number
  verified: boolean
  published_at: string | null
  created_at: string
  moderation_note: string | null
  moderated_at: string | null
  category: { id: string; slug: string; name: string } | null
  company: { id: string; slug: string; name: string } | null
  maker: ProfileRow
  moderator: { display_name: string } | null
  credit_role: 'maker' | 'hunter'
  maker_credit_id: string | null
  maker_credit_name: string | null
  hunter_id: string | null
  maker_credit: ProfileRow | null
  hunter: ProfileRow | null
  product_tags: { tags: { slug: string; name: string } | null }[]
  product_screenshots?: { storage_provider: 'supabase' | 'r2'; object_key: string; alt_text: string | null; sort_order: number }[]
}

interface CollectionRow {
  id: string
  slug: string
  name: string
  tagline: string
  logo_path: string | null
  votes_count: number
  comments_count: number
  views_count: number
  published_at: string | null
  rating_avg: number | null
  rating_count: number | null
  verified: boolean | null
  total_count: number
}

interface FeedRow {
  id: string
  slug: string
  name: string
  tagline: string
  logo_path: string | null
  votes_count: number
  comments_count: number
  views_count: number
  published_at: string | null
  category_id: string | null
  category_slug: string | null
  category_name: string | null
  tag_slugs: string[] | null
  tag_names: string[] | null
  rating_avg: number | null
  rating_count: number | null
  verified: boolean | null
  total_count: number
}

interface RankedRow extends FeedRow {
  rank: number
  score: number | null
}

interface SavedRow {
  product_id: string
  products: ProductRow | null
}

interface CommentRow {
  id: string
  product_id: string
  body: string
  created_at: string
  author: ProfileRow
}

interface ReportRow {
  id: string
  reason: Report['reason']
  details: string | null
  status: Report['status']
  created_at: string
  resolved_at: string | null
  reporter: ProfileRow | null
  product: { id: string; slug: string; name: string; status: ProductStatus } | null
  comment: { id: string; body: string; product: { slug: string; name: string } | null } | null
}

const PROFILE_SUMMARY = 'id, username, display_name, avatar_path'
const PROFILE_FULL = `${PROFILE_SUMMARY}, bio, role, created_at, website_url, x_username, telegram_username, linkedin_username, github_username`
const PRODUCT_SELECT = `id, slug, name, tagline, description, website_url, logo_path, status, votes_count,
  comments_count, views_count, rating_avg, rating_count, verified, published_at, created_at, moderation_note, moderated_at,
  credit_role, maker_credit_id, maker_credit_name, hunter_id,
  category:categories(id, slug, name),
  company:companies(id, slug, name),
  maker:profiles!products_maker_id_fkey(${PROFILE_SUMMARY}),
  maker_credit:profiles!products_maker_credit_id_fkey(${PROFILE_SUMMARY}),
  hunter:profiles!products_hunter_id_fkey(${PROFILE_SUMMARY}),
  moderator:profiles!products_moderated_by_fkey(display_name),
  product_tags:product_tags(tags(slug, name)),
  product_screenshots:product_screenshots(storage_provider, object_key, alt_text, sort_order)`
const COMMENT_SELECT = `id, product_id, body, created_at, author:profiles!comments_author_id_fkey(${PROFILE_SUMMARY})`
const REPORT_SELECT = `id, reason, details, status, created_at, resolved_at,
  reporter:profiles!reports_reporter_id_fkey(${PROFILE_SUMMARY}),
  product:products(id, slug, name, status),
  comment:comments(id, body, product:products(slug, name))`

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

const toTagRefs = (slugs: string[] | null | undefined, names: string[] | null | undefined): TagRef[] =>
  (slugs ?? []).map((slug, index) => ({ slug, name: names?.[index] ?? slug }))

const toRanked = (row: RankedRow, publicUrl: (bucket: string, path: string | null) => string | null): RankedProduct => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  tagline: row.tagline,
  logoUrl: publicUrl('product-logos', row.logo_path),
  votesCount: row.votes_count,
  commentsCount: row.comments_count,
  viewsCount: row.views_count,
  ratingAvg: Number(row.rating_avg ?? 0),
  ratingCount: Number(row.rating_count ?? 0),
  verified: Boolean(row.verified),
  publishedAt: row.published_at,
  category: row.category_id ? { id: row.category_id, slug: row.category_slug!, name: row.category_name! } : null,
  tags: toTagRefs(row.tag_slugs, row.tag_names),
  rank: row.rank,
  score: row.score,
})

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const MESSAGE_CODES: [RegExp, ApiErrorCode][] = [
  [/too_many_tags/, 'too_many_tags'],
  [/unknown_tag/, 'unknown_tag'],
  [/invalid_viewer_key/, 'invalid_input'],
  [/too_many_pending_submissions/, 'too_many_pending'],
  [/rate_limited/, 'rate_limited'],
  [/inactive_category/, 'inactive_category'],
  [/invalid_transition/, 'invalid_transition'],
  [/note_required/, 'note_required'],
  [/not_authorized|row-level security|permission denied/, 'not_authorized'],
  [/product_not_found|report_not_found/, 'not_found'],
]

export function mapPostgrestError(error: PostgrestError): ApiError {
  for (const [pattern, code] of MESSAGE_CODES) if (pattern.test(error.message)) return new ApiError(code, error.message)
  switch (error.code) {
    case '23505':
      return new ApiError(/username/.test(error.message) ? 'username_taken' : 'duplicate', error.message)
    case '23503':
      return new ApiError('category_in_use', error.message)
    case '42501':
      return new ApiError('not_authorized', error.message)
    case '23514':
    case '22023':
    case '22P02':
      return new ApiError('invalid_input', error.message)
    case 'PGRST116':
      return new ApiError('not_found', error.message)
    default:
      return /fetch|network/i.test(error.message) ? new ApiError('network', error.message) : new ApiError('unknown', error.message)
  }
}

export function mapAuthError(error: AuthError): ApiError {
  const code = error.code ?? ''
  if (code === 'invalid_credentials') return new ApiError('invalid_credentials')
  if (code === 'email_not_confirmed') return new ApiError('email_not_confirmed')
  if (code === 'user_already_exists' || code === 'email_exists') return new ApiError('email_taken')
  if (code === 'weak_password' || code === 'same_password') return new ApiError('weak_password')
  if (code.startsWith('over_') || error.status === 429) return new ApiError('rate_limited')
  if (error.name === 'AuthRetryableFetchError') return new ApiError('network')
  return new ApiError('unknown', error.message)
}

/** Unwraps a query that must return data (lists, `.single()`, row-returning RPCs). */
function check<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw mapPostgrestError(result.error)
  if (result.data === null || result.data === undefined) throw new ApiError('not_found')
  return result.data
}

/** Unwraps an RPC or mutation whose successful response has no data payload. */
function checkVoid(result: { data: unknown; error: PostgrestError | null }): void {
  if (result.error) throw mapPostgrestError(result.error)
}

/** Unwraps a `.maybeSingle()` query, where no row is a valid answer. */
function maybe<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw mapPostgrestError(result.error)
  return result.data
}

// ---------------------------------------------------------------------------

export function createSupabaseApi(url: string, key: string, client?: SupabaseClient): ShekargahApi {
  const supabase =
    client ??
    createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })

  const publicUrl = (bucket: string, path: string | null) => {
    const stored = parseStored(path)
    if (!stored.path) return null
    return supabase.storage.from(bucket).getPublicUrl(stored.path).data.publicUrl
  }
  const toLeanPage = (rows: CollectionRow[], page: number) => {
    const total = Number(rows[0]?.total_count ?? 0)
    const items: ProductSummary[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      logoUrl: publicUrl('product-logos', row.logo_path),
      votesCount: row.votes_count,
      commentsCount: row.comments_count,
      viewsCount: row.views_count,
      ratingAvg: Number(row.rating_avg ?? 0),
      ratingCount: Number(row.rating_count ?? 0),
      verified: Boolean(row.verified),
      publishedAt: row.published_at,
      category: null,
      tags: [],
    }))
    return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
  }

  const toSummary = (row: ProfileRow): ProfileSummary => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: publicUrl('avatars', row.avatar_path),
  })
  const toProfile = (row: ProfileRow): Profile => ({
    ...toSummary(row),
    bio: row.bio ?? null,
    role: row.role ?? 'user',
    createdAt: row.created_at ?? new Date().toISOString(),
    websiteUrl: row.website_url ?? null,
    xUsername: row.x_username ?? null,
    telegramUsername: row.telegram_username ?? null,
    linkedinUsername: row.linkedin_username ?? null,
    githubUsername: row.github_username ?? null,
  })
  const toCategory = (row: CategoryRow): Category => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  })
  const toProductSummary = (row: ProductRow): ProductSummary => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    logoUrl: publicUrl('product-logos', row.logo_path),
    votesCount: row.votes_count,
    commentsCount: row.comments_count,
    viewsCount: row.views_count,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    verified: Boolean(row.verified),
    publishedAt: row.published_at,
    category: row.category,
    tags: (row.product_tags ?? []).flatMap((item) => (item.tags ? [{ slug: item.tags.slug, name: item.tags.name }] : [])),
  })
  const toProduct = (row: ProductRow): Product => ({
    ...toProductSummary(row),
    description: row.description,
    websiteUrl: row.website_url,
    status: row.status,
    maker: toSummary(row.maker),
    creditRole: row.credit_role ?? 'maker',
    makerCredit: row.maker_credit ? toSummary(row.maker_credit) : null,
    makerCreditName: row.maker_credit_name,
    hunter: row.hunter ? toSummary(row.hunter) : null,
    company: row.company,
    screenshots: (row.product_screenshots ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((shot) => {
        const url = supabase.storage.from('product-screenshots').getPublicUrl(shot.object_key).data.publicUrl
        return [{ url, key: shot.object_key, alt: shot.alt_text }]
      }),
    moderationNote: row.moderation_note,
    moderatedAt: row.moderated_at,
    moderatorName: row.moderator?.display_name ?? null,
    createdAt: row.created_at,
  })
  const toComment = (row: CommentRow): Comment => ({
    id: row.id,
    productId: row.product_id,
    body: row.body,
    createdAt: row.created_at,
    author: toSummary(row.author),
  })

  async function currentUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new ApiError('not_authenticated')
    return id
  }

  async function upload(bucket: string, input: File, ownerId: string): Promise<string> {
    // Normalise to WebP in the browser so storage only ever holds WebP files.
    const file = await toWebpFile(input)
    const extension = EXTENSIONS[file.type]
    if (!extension) throw new ApiError('upload_failed', `unsupported type ${file.type}`)
    const objectPath = `${ownerId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw new ApiError('upload_failed', error.message)
    return objectPath
  }

  async function removeFile(bucket: string, path: string | null | undefined) {
    const stored = parseStored(path)
    if (!stored.path) return
    if (stored.provider !== 'supabase') return
    await supabase.storage.from(bucket).remove([stored.path])
  }

  const toSession = (session: { user: { id: string; email?: string } } | null): Session | null =>
    session ? { userId: session.user.id, email: session.user.email ?? '' } : null

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await supabase.auth.getSession()
      return toSession(data.session)
    },

    onAuthChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const mapped = event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY' ? event : 'OTHER'
        listener(toSession(session), mapped)
      })
      return () => data.subscription.unsubscribe()
    },

    async signUp({ email, password, displayName }) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: normalizeFa(displayName.trim()) },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) throw mapAuthError(error)
      return { needsConfirmation: !data.session }
    },

    async signIn({ email, password }) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) throw mapAuthError(error)
    },

    async signInWithOAuth(provider, redirectTo) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        })
        if (error) throw error
      } catch (error) {
        throw mapAuthError(error instanceof AuthError ? error : new AuthError('OAuth provider is not configured'))
      }
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw mapAuthError(error)
    },

    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw mapAuthError(error)
    },

    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw mapAuthError(error)
    },

    async getProfile(userId) {
      const row = maybe(await supabase.from('profiles').select(PROFILE_FULL).eq('id', userId).maybeSingle<ProfileRow>())
      if (row) return toProfile(row)
      // Repair a missing profile after login. This covers legacy users created
      // before the trigger fix and keeps the profile flow self-healing.
      const { data } = await supabase.auth.getSession()
      if (data.session?.user.id === userId) {
        check(await supabase.rpc('ensure_profile'))
        const repaired = maybe(await supabase.from('profiles').select(PROFILE_FULL).eq('id', userId).maybeSingle<ProfileRow>())
        return repaired ? toProfile(repaired) : null
      }
      return null
    },

    async getProfileByUsername(username) {
      const row = maybe(
        await supabase.from('profiles').select(PROFILE_FULL).eq('username', username).maybeSingle<ProfileRow>(),
      )
      return row ? toProfile(row) : null
    },

    async listTags() {
      const rows = check(await supabase.from('tags').select('id, slug, name').order('slug').returns<Tag[]>())
      return rows.map(({ id, slug, name }) => ({ id, slug, name }))
    },

    async updateProfile(userId, input) {
      const existing = check(
        await supabase.from('profiles').select('avatar_path').eq('id', userId).single<{ avatar_path: string | null }>(),
      )
      let avatarPath = existing.avatar_path
      if (input.avatar) avatarPath = await upload('avatars', input.avatar, userId)
      else if (input.removeAvatar) avatarPath = null

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: input.username.trim(),
          display_name: normalizeFa(input.displayName.trim()),
          bio: input.bio.trim() ? normalizeFa(input.bio.trim()) : null,
          avatar_path: avatarPath,
          website_url: input.websiteUrl?.trim() || null,
          x_username: input.xUsername?.trim() || null,
          telegram_username: input.telegramUsername?.trim() || null,
          linkedin_username: input.linkedinUsername?.trim() || null,
          github_username: input.githubUsername?.trim() || null,
        })
        .eq('id', userId)
        .select(PROFILE_FULL)
        .single<ProfileRow>()
      if (error) {
        if (input.avatar) await removeFile('avatars', avatarPath)
        throw mapPostgrestError(error)
      }
      if (existing.avatar_path && existing.avatar_path !== avatarPath) await removeFile('avatars', existing.avatar_path)
      return toProfile(data)
    },

    async listCategories(options) {
      let query = supabase.from('categories').select('id, slug, name, description, sort_order, is_active')
      if (!options?.includeInactive) query = query.eq('is_active', true)
      const rows = check(await query.order('sort_order').order('name').limit(200).returns<CategoryRow[]>())
      return rows.map(toCategory)
    },

    async listTopics() {
      const rows = check(await supabase.rpc('list_topics')) as {
        slug: string
        name: string
        description: string | null
        product_count: number
        recent_votes: number
      }[]
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        productCount: Number(row.product_count),
        recentVotes: Number(row.recent_votes),
      }))
    },

    async listTopMakers(page) {
      const rows = check(
        await supabase.rpc('list_top_makers', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as {
        id: string
        username: string
        display_name: string
        avatar_path: string | null
        product_count: number
        votes_total: number
        rank: number
      }[]
      const items: TopMaker[] = rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: publicUrl('avatars', row.avatar_path),
        productCount: Number(row.product_count),
        votesTotal: Number(row.votes_total),
        rank: row.rank,
      }))
      return { items, total: page * PAGE_SIZE + items.length, hasMore: items.length === PAGE_SIZE }
    },

    async subscribeNewsletter({ email, source }) {
      checkVoid(await supabase.rpc('subscribe_newsletter', { p_email: email.trim(), p_source: source ?? null }))
    },

    async listProducts({ search, category, tags, sort, page }) {
      const rows = check(
        await supabase.rpc('list_products', {
          p_search: search?.trim() ? normalizeFa(search.trim()) : null,
          p_category: category || null,
          p_sort: sort,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
          p_tags: tags?.length ? tags : null,
        }),
      ) as FeedRow[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items: ProductSummary[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        tagline: row.tagline,
        logoUrl: publicUrl('product-logos', row.logo_path),
        votesCount: row.votes_count,
        commentsCount: row.comments_count,
        viewsCount: row.views_count,
        ratingAvg: Number(row.rating_avg ?? 0),
        ratingCount: Number(row.rating_count ?? 0),
        verified: Boolean(row.verified),
        publishedAt: row.published_at,
        category: row.category_id ? { id: row.category_id, slug: row.category_slug!, name: row.category_name! } : null,
        tags: toTagRefs(row.tag_slugs, row.tag_names),
      }))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async getProduct(slug) {
      const row = maybe(await supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle<ProductRow>())
      return row ? toProduct(row) : null
    },

    async listMakerProducts(makerId) {
      const rows = check(
        await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('maker_id', makerId)
          .order('created_at', { ascending: false })
          .limit(100)
          .returns<ProductRow[]>(),
      )
      return rows.map(toProduct)
    },

    async submitProduct(input) {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: input.name.trim(),
          tagline: input.tagline.trim(),
          description: input.description.trim(),
          website_url: input.websiteUrl.trim(),
          category_id: input.categoryId,
        })
        .select('id')
        .single<{ id: string }>()
      if (error) throw mapPostgrestError(error)

      const userId = await currentUserId()
      let logoPath: string | null = null

      // Credit must be recorded before the product can be published, so a
      // hunter submission never looks like the hunter built it.
      if (input.credit && input.credit.role === 'hunter') {
        checkVoid(
          await supabase.rpc('set_product_credit', {
            p_product_id: data.id,
            p_credit_role: 'hunter',
            p_maker_credit_username: input.credit.makerUsername?.trim() || null,
            p_maker_credit_name: input.credit.makerName?.trim() || 'ناشناس',
          }),
        )
      }

      const uploadedScreenshots: string[] = []
      try {
        if (input.logo) {
          logoPath = await upload('product-logos', input.logo, userId)
          checkVoid(await supabase.rpc('set_product_logo', { p_product_id: data.id, p_logo_path: logoPath }))
        }
        if (input.screenshots?.length) {
          for (const shot of input.screenshots) uploadedScreenshots.push(await upload('product-screenshots', shot, userId))
          checkVoid(
            await supabase.rpc('set_product_screenshots', {
              p_product_id: data.id,
              p_screenshots: uploadedScreenshots.map((key) => ({ object_key: key })),
            }),
          )
        }
      } catch (caught) {
        if (logoPath) await removeFile('product-logos', logoPath)
        for (const key of uploadedScreenshots) await removeFile('product-screenshots', key)
        await supabase.from('products').delete().eq('id', data.id)
        throw caught
      }

      if (input.tags.length > 0) {
        try {
          checkVoid(await supabase.rpc('set_product_tags', { p_product_id: data.id, p_slugs: input.tags }))
        } catch (caught) {
          await supabase.from('products').delete().eq('id', data.id)
          if (logoPath) await removeFile('product-logos', logoPath)
          for (const key of uploadedScreenshots) await removeFile('product-screenshots', key)
          throw caught
        }
      }

      return toProduct(
        check(await supabase.from('products').select(PRODUCT_SELECT).eq('id', data.id).single<ProductRow>()),
      )
    },

    async deleteProduct(productId) {
      const screenshots = check(
        await supabase.from('product_screenshots').select('object_key').eq('product_id', productId).returns<{ object_key: string }[]>(),
      )
      const rows = check(
        await supabase.from('products').delete().eq('id', productId).select('id, logo_path').returns<{ id: string; logo_path: string | null }[]>(),
      )
      if (rows.length === 0) throw new ApiError('not_authorized')
      await removeFile('product-logos', rows[0]!.logo_path)
      for (const shot of screenshots) await removeFile('product-screenshots', shot.object_key)
    },

    async setProductTags(productId, slugs) {
      checkVoid(await supabase.rpc('set_product_tags', { p_product_id: productId, p_slugs: slugs }))
    },

    async adminUpdateProduct(input) {
      check(
        await supabase.rpc('admin_update_product', {
          p_product_id: input.id,
          p_name: input.name.trim(),
          p_tagline: input.tagline.trim(),
          p_description: input.description.trim(),
          p_website_url: input.websiteUrl.trim(),
          p_category_id: input.categoryId,
        }),
      )
    },

    async setProductLogo(productId, logo) {
      const userId = await currentUserId()
      const path = await upload('product-logos', logo, userId)
      try {
        checkVoid(await supabase.rpc('set_product_logo', { p_product_id: productId, p_logo_path: path }))
      } catch (caught) {
        await removeFile('product-logos', path)
        throw caught
      }
    },

    async setProductScreenshots(productId, input) {
      const userId = await currentUserId()
      const added: string[] = []
      try {
        for (const file of input.add) added.push(await upload('product-screenshots', file, userId))
        const keep = (input.keep ?? []).map((k) => k.key)
        const removed = await supabase
          .from('product_screenshots')
          .select('object_key')
          .eq('product_id', productId)
          .returns<{ object_key: string }[]>()
        const existing = (removed.data ?? []).map((r) => r.object_key)
        const merged = [...keep, ...added]
          checkVoid(
            await supabase.rpc('set_product_screenshots', {
            p_product_id: productId,
            p_screenshots: merged.map((key) => ({ object_key: key })),
          }),
        )
        for (const key of existing) {
          if (!merged.includes(key)) await removeFile('product-screenshots', key)
        }
      } catch (caught) {
        for (const key of added) await removeFile('product-screenshots', key)
        throw caught
      }
    },

    async listDailyProducts({ date, page }) {
      const rows = check(
        await supabase.rpc('list_daily_products', {
          p_date: date ?? null,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
        }),
      ) as RankedRow[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items = rows.map((row) => toRanked(row, publicUrl))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async listDailyWinners({ days = 7, perDay = 5 }) {
      const rows = check(await supabase.rpc('list_daily_winners', { p_days: days, p_per_day: perDay })) as {
        day: string
        rank: number
        id: string
        slug: string
        name: string
        tagline: string
        logo_path: string | null
        votes_count: number
        comments_count: number
        views_count: number
        published_at: string | null
        category_slug: string | null
        category_name: string | null
        rating_avg: number | null
        rating_count: number | null
        verified: boolean | null
      }[]
      const groups = new Map<string, DailyGroup>()
      for (const row of rows) {
        const key = String(row.day).slice(0, 10)
        if (!groups.has(key)) groups.set(key, { day: key, items: [] })
        groups.get(key)!.items.push({
          id: row.id,
          slug: row.slug,
          name: row.name,
          tagline: row.tagline,
          logoUrl: publicUrl('product-logos', row.logo_path),
          votesCount: row.votes_count,
          commentsCount: row.comments_count,
          viewsCount: row.views_count,
          ratingAvg: Number(row.rating_avg ?? 0),
          ratingCount: Number(row.rating_count ?? 0),
          verified: Boolean(row.verified),
          publishedAt: row.published_at,
          category:
            row.category_slug && row.category_name
              ? { id: '', slug: row.category_slug, name: row.category_name }
              : null,
          tags: [],
          rank: row.rank,
          categoryName: row.category_name,
        })
      }
      return [...groups.values()]
    },

    async listLeaderboard({ period, page }) {
      const rows = check(
        await supabase.rpc('list_leaderboard', {
          p_period: period,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
        }),
      ) as RankedRow[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items = rows.map((row) => toRanked(row, publicUrl))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async listTrending(page) {
      const rows = check(
        await supabase.rpc('list_trending', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as RankedRow[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items = rows.map((row) => toRanked(row, publicUrl))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async recordProductView(productId, viewerKey) {
      checkVoid(await supabase.rpc('record_product_view', { p_product_id: productId, p_viewer_key: viewerKey }))
    },

    async listMySavedProductIds(productIds) {
      const { data } = await supabase.auth.getSession()
      if (!data.session || productIds.length === 0) return []
      const rows = check(
        await supabase.from('saved_products').select('product_id').in('product_id', productIds).returns<{ product_id: string }[]>(),
      )
      return rows.map((row) => row.product_id)
    },

    async listMySavedProducts(page) {
      await currentUserId()
      const rows = check(
        await supabase
          .from('saved_products')
          .select(`product_id, products:products(${PRODUCT_SELECT})`)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
          .returns<SavedRow[]>(),
      )
      const items = rows.flatMap((row) => (row.products ? [toProductSummary(row.products)] : []))
      return { items, total: page * PAGE_SIZE + items.length, hasMore: items.length === PAGE_SIZE }
    },

    async saveProduct(productId) {
      await currentUserId()
      const { error } = await supabase.from('saved_products').insert({ product_id: productId })
      if (error) throw mapPostgrestError(error)
    },

    async unsaveProduct(productId) {
      const userId = await currentUserId()
      const rows = check(
        await supabase.from('saved_products').delete().eq('product_id', productId).eq('user_id', userId).select('id'),
      )
      if (rows.length === 0) throw new ApiError('not_found')
    },



    async listMyVotes(productIds) {
      const { data } = await supabase.auth.getSession()
      if (!data.session || productIds.length === 0) return []
      const rows = check(
        await supabase.from('votes').select('product_id').in('product_id', productIds).returns<{ product_id: string }[]>(),
      )
      return rows.map((row) => row.product_id)
    },

    async vote(productId) {
      await currentUserId()
      const { error } = await supabase.from('votes').insert({ product_id: productId })
      if (error) throw mapPostgrestError(error)
    },

    async unvote(productId) {
      const userId = await currentUserId()
      check(await supabase.from('votes').delete().eq('product_id', productId).eq('user_id', userId))
    },

    async listComments(productId) {
      const rows = check(
        await supabase
          .from('comments')
          .select(COMMENT_SELECT)
          .eq('product_id', productId)
          .order('created_at', { ascending: true })
          .limit(300)
          .returns<CommentRow[]>(),
      )
      return rows.map(toComment)
    },

    async addComment(productId, body) {
      await currentUserId()
      const row = check(
        await supabase.from('comments').insert({ product_id: productId, body: body.trim() }).select(COMMENT_SELECT).single<CommentRow>(),
      )
      return toComment(row)
    },

    async deleteComment(commentId) {
      const rows = check(await supabase.from('comments').delete().eq('id', commentId).select('id'))
      if (rows.length === 0) throw new ApiError('not_authorized')
    },

    async listReviews(productId) {
      const rows = check(await supabase.rpc('list_reviews', { p_product_id: productId })) as {
        id: string
        rating: number
        body: string | null
        created_at: string
        author_id: string
        author_username: string
        author_display_name: string
        author_avatar_path: string | null
      }[]
      return rows.map((row) => ({
        id: row.id,
        rating: Number(row.rating),
        body: row.body,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: row.author_username,
          displayName: row.author_display_name,
          avatarUrl: publicUrl('avatars', row.author_avatar_path),
        },
      }))
    },

    async submitReview({ productId, rating, body }) {
      await currentUserId()
      const { error } = await supabase
        .from('reviews')
        .upsert({ product_id: productId, rating, body: body.trim() || null }, { onConflict: 'product_id,author_id' })
      if (error) throw mapPostgrestError(error)
    },

    async deleteReview(productId) {
      await currentUserId()
      const { error } = await supabase.from('reviews').delete().eq('product_id', productId)
      if (error) throw mapPostgrestError(error)
    },

    async listSponsors() {
      const rows = check(
        await supabase
          .from('sponsors')
          .select('id, name, tagline, url, logo_key')
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at')
          .limit(12)
          .returns<{ id: string; name: string; tagline: string | null; url: string; logo_key: string | null }[]>(),
      )
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        url: row.url,
        logoUrl: publicUrl('product-logos', row.logo_key),
      }))
    },

    async listNotifications(page) {
      await currentUserId()
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, product_id, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(username, display_name), product:products(slug, name)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        .returns<
          {
            id: number
            kind: Notification['kind']
            product_id: string | null
            body: string | null
            read_at: string | null
            created_at: string
            actor: { username: string; display_name: string } | null
            product: { slug: string; name: string } | null
          }[]
        >()
      if (error) throw mapPostgrestError(error)
      const items: Notification[] = (data ?? []).map((row) => ({
        id: String(row.id),
        kind: row.kind,
        productId: row.product_id,
        productSlug: row.product?.slug ?? null,
        productName: row.product?.name ?? null,
        body: row.body,
        read: Boolean(row.read_at),
        createdAt: row.created_at,
        actor: row.actor ? { username: row.actor.username, displayName: row.actor.display_name } : null,
      }))
      return { items, total: page * PAGE_SIZE + items.length, hasMore: items.length === PAGE_SIZE }
    },

    async unreadNotificationCount() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return 0
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (error) return 0
      return count ?? 0
    },

    async markAllNotificationsRead() {
      checkVoid(await supabase.rpc('mark_all_notifications_read'))
    },

    async reportContent({ productId, commentId, reason, details }) {
      await currentUserId()
      const { error } = await supabase.from('reports').insert({
        product_id: productId ?? null,
        comment_id: commentId ?? null,
        reason,
        details: details.trim() || null,
      })
      if (error) throw mapPostgrestError(error)
    },

    async listProductsByStatus(status, page) {
      const order =
        status === 'pending'
          ? { column: 'created_at', ascending: true }
          : status === 'published'
            ? { column: 'published_at', ascending: false }
            : { column: 'moderated_at', ascending: false }
      const { data, error, count } = await supabase
        .from('products')
        .select(PRODUCT_SELECT, { count: 'exact' })
        .eq('status', status)
        .order(order.column, { ascending: order.ascending })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        .returns<ProductRow[]>()
      if (error) throw mapPostgrestError(error)
      const total = count ?? data.length
      return { items: data.map(toProduct), total, hasMore: page * PAGE_SIZE + data.length < total }
    },

    async moderateProduct(productId, action, note) {
      check(await supabase.rpc('moderate_product', { p_product_id: productId, p_action: action, p_note: note ?? null }))
    },

    async saveCategory(input) {
      const values = {
        slug: input.slug.trim(),
        name: normalizeFa(input.name.trim()),
        description: input.description.trim() || null,
        sort_order: input.sortOrder,
        is_active: input.isActive,
      }
      const query = input.id
        ? supabase.from('categories').update(values).eq('id', input.id)
        : supabase.from('categories').insert(values)
      const row = check(await query.select('id, slug, name, description, sort_order, is_active').single<CategoryRow>())
      return toCategory(row)
    },

    async deleteCategory(categoryId) {
      const rows = check(await supabase.from('categories').delete().eq('id', categoryId).select('id'))
      if (rows.length === 0) throw new ApiError('not_authorized')
    },

    async listReports(filter) {
      let query = supabase.from('reports').select(REPORT_SELECT)
      if (filter === 'open') query = query.eq('status', 'open')
      const rows = check(await query.order('created_at', { ascending: false }).limit(100).returns<ReportRow[]>())
      return rows.map(
        (row): Report => ({
          id: row.id,
          reason: row.reason,
          details: row.details,
          status: row.status,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          reporter: row.reporter ? toSummary(row.reporter) : null,
          product: row.product,
          comment: row.comment,
        }),
      )
    },

    async resolveReport(reportId, status) {
      check(await supabase.rpc('resolve_report', { p_report_id: reportId, p_status: status }))
    },

    async listCollections() {
      const rows = check(await supabase.rpc('list_collections')) as {
        slug: string
        name: string
        description: string | null
        product_count: number
      }[]
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        productCount: Number(row.product_count),
      }))
    },

    async listCollectionProducts(slug, page) {
      const rows = check(
        await supabase.rpc('list_collection_products', { p_slug: slug, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as CollectionRow[]
      return toLeanPage(rows, page)
    },

    async listTopHunters(page) {
      const rows = check(
        await supabase.rpc('list_top_hunters', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as {
        id: string
        username: string
        display_name: string
        avatar_path: string | null
        hunt_count: number
        votes_total: number
        rank: number
      }[]
      const items: TopHunter[] = rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: publicUrl('avatars', row.avatar_path),
        huntCount: Number(row.hunt_count),
        votesTotal: Number(row.votes_total),
        rank: row.rank,
      }))
      return { items, total: page * PAGE_SIZE + items.length, hasMore: items.length === PAGE_SIZE }
    },

    async setProductCredit(productId, input) {
      checkVoid(
        await supabase.rpc('set_product_credit', {
          p_product_id: productId,
          p_credit_role: input.role,
          p_maker_credit_username: input.makerUsername?.trim() || null,
          p_maker_credit_name: input.makerName?.trim() || null,
        }),
      )
    },

    async listPersonalFeed(page) {
      const rows = check(
        await supabase.rpc('list_personal_feed', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as CollectionRow[]
      return toLeanPage(rows, page)
    },

    async adminBroadcast(title, body) {
      const result = await supabase.rpc('admin_broadcast', { p_title: title.trim(), p_body: body.trim() })
      if (result.error) throw mapPostgrestError(result.error)
      return Number(result.data ?? 0)
    },

    async listBannedWords() {
      return check(
        await supabase.from('banned_words').select('id, word').order('created_at').returns<{ id: string; word: string }[]>(),
      )
    },

    async addBannedWord(word) {
      const { error } = await supabase.from('banned_words').insert({ word: word.trim() })
      if (error) throw mapPostgrestError(error)
    },

    async removeBannedWord(id) {
      const { error } = await supabase.from('banned_words').delete().eq('id', id)
      if (error) throw mapPostgrestError(error)
    },

    async listCompanies(page) {
      const rows = check(await supabase.rpc('list_companies', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE })) as {
        id: string
        slug: string
        name: string
        description: string | null
        logo_key: string | null
        product_count: number
        member_count: number
        total_count: number
      }[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items: Company[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        logoUrl: publicUrl('product-logos', row.logo_key),
        productCount: Number(row.product_count),
        memberCount: Number(row.member_count),
      }))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async getCompany(slug) {
      const rows = check(await supabase.rpc('get_company', { p_slug: slug })) as {
        id: string
        slug: string
        name: string
        description: string | null
        website_url: string | null
        logo_key: string | null
        is_active: boolean
      }[]
      const row = rows[0]
      if (!row) return null
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        websiteUrl: row.website_url,
        logoUrl: publicUrl('product-logos', row.logo_key),
        isActive: row.is_active,
      }
    },

    async listCompanyProducts(slug, page) {
      const rows = check(
        await supabase.rpc('list_company_products', { p_slug: slug, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as CollectionRow[]
      return toLeanPage(rows, page)
    },

    async adminSaveCompany(input) {
      const result = await supabase.rpc('admin_save_company', {
        p_id: input.id ?? null,
        p_slug: input.slug.trim(),
        p_name: input.name.trim(),
        p_description: input.description.trim() || null,
        p_website_url: input.websiteUrl.trim() || null,
        p_logo_key: null,
        p_is_active: input.isActive,
        p_members: input.members,
      })
      if (result.error) throw mapPostgrestError(result.error)
      return String(result.data)
    },

    async setProductCompany(productId, companyId) {
      const result = await supabase.rpc('set_product_company', { p_product_id: productId, p_company_id: companyId })
      if (result.error) throw mapPostgrestError(result.error)
    },

    async listNewsletterSubscribers(page) {
      const rows = check(
        await supabase.rpc('list_newsletter_subscribers', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
      ) as { email: string; source: string | null; created_at: string; total_count: number }[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items: NewsletterSubscriber[] = rows.map((row) => ({
        email: row.email,
        source: row.source,
        createdAt: row.created_at,
      }))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async listPosts(page) {
      const rows = check(await supabase.rpc('list_posts', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE })) as {
        id: string
        slug: string
        title: string
        excerpt: string | null
        cover_key: string | null
        tags: string[] | null
        published_at: string | null
        author_id: string | null
        author_username: string | null
        author_display_name: string | null
        author_avatar_path: string | null
        total_count: number
      }[]
      const total = Number(rows[0]?.total_count ?? 0)
      const items: PostSummary[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        coverUrl: publicUrl('product-logos', row.cover_key),
        tags: row.tags ?? [],
        publishedAt: row.published_at,
        author:
          row.author_id && row.author_username
            ? {
                id: row.author_id,
                username: row.author_username,
                displayName: row.author_display_name ?? row.author_username,
                avatarUrl: publicUrl('avatars', row.author_avatar_path),
              }
            : null,
      }))
      return { items, total, hasMore: page * PAGE_SIZE + items.length < total }
    },

    async getPost(slug) {
      const rows = check(await supabase.rpc('get_post', { p_slug: slug })) as {
        id: string
        slug: string
        title: string
        excerpt: string | null
        content: string
        cover_key: string | null
        tags: string[] | null
        seo_title: string | null
        seo_description: string | null
        published_at: string | null
        updated_at: string
        author_id: string | null
        author_username: string | null
        author_display_name: string | null
        author_avatar_path: string | null
      }[]
      const row = rows[0]
      if (!row) return null
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content,
        coverUrl: publicUrl('product-logos', row.cover_key),
        tags: row.tags ?? [],
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        author:
          row.author_id && row.author_username
            ? {
                id: row.author_id,
                username: row.author_username,
                displayName: row.author_display_name ?? row.author_username,
                avatarUrl: publicUrl('avatars', row.author_avatar_path),
              }
            : null,
      }
    },

    async siteStats() {
      const rows = check(await supabase.rpc('site_stats')) as { products: number; makers: number; votes: number }[]
      const row = rows[0]
      return {
        products: Number(row?.products ?? 0),
        makers: Number(row?.makers ?? 0),
        votes: Number(row?.votes ?? 0),
      }
    },

    async adminListPosts(page) {
      const rows = check(await supabase.rpc('admin_list_posts', { p_limit: 30, p_offset: page * 30 })) as {
        id: string
        slug: string
        title: string
        status: 'draft' | 'published'
        tags: string[] | null
        published_at: string | null
        updated_at: string
      }[]
      const items: AdminPostRow[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        tags: row.tags ?? [],
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
      }))
      return { items, total: page * 30 + items.length, hasMore: items.length === 30 }
    },

    async adminGetPost(id) {
      const rows = check(await supabase.rpc('admin_get_post', { p_id: id })) as {
        id: string
        slug: string
        title: string
        excerpt: string | null
        content: string
        seo_title: string | null
        seo_description: string | null
        tags: string[] | null
        status: 'draft' | 'published'
      }[]
      const row = rows[0]
      if (!row) return null
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content,
        coverUrl: null,
        tags: row.tags ?? [],
        publishedAt: null,
        updatedAt: '',
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        author: null,
      }
    },

    async adminSavePost(input) {
      const result = await supabase.rpc('admin_save_post', {
        p_id: input.id ?? null,
        p_slug: input.slug.trim(),
        p_title: input.title.trim(),
        p_excerpt: input.excerpt.trim() || null,
        p_content: input.content,
        p_seo_title: input.seoTitle.trim() || null,
        p_seo_description: input.seoDescription.trim() || null,
        p_tags: input.tags,
        p_status: input.status,
      })
      if (result.error) throw mapPostgrestError(result.error)
      return String(result.data)
    },

    async adminDeletePost(id) {
      const result = await supabase.rpc('admin_delete_post', { p_id: id })
      if (result.error) throw mapPostgrestError(result.error)
    },

    async setProductVerified(productId, verified) {
      const result = await supabase.rpc('set_product_verified', { p_product_id: productId, p_verified: verified })
      if (result.error) throw mapPostgrestError(result.error)
    },

    async adminSetRole(profileId, role) {
      const result = await supabase.rpc('admin_set_role', { p_profile_id: profileId, p_role: role })
      if (result.error) throw mapPostgrestError(result.error)
    },

    async listUsersOverview(query, page) {
      const rows = check(
        await supabase.rpc('list_users_overview', {
          p_query: query.trim() || null,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
        }),
      ) as {
        id: string
        username: string
        display_name: string
        avatar_path: string | null
        role: Role
        created_at: string
        product_count: number
        votes_received: number
      }[]
      const items: AdminUser[] = rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: publicUrl('avatars', row.avatar_path),
        role: row.role,
        createdAt: row.created_at,
        productCount: Number(row.product_count),
        votesReceived: Number(row.votes_received),
      }))
      return { items, total: page * PAGE_SIZE + items.length, hasMore: items.length === PAGE_SIZE }
    },
  }
}

import { AuthError, createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type ApiErrorCode } from '@/lib/errors'
import { normalizeFa } from '@/lib/text'
import {
  PAGE_SIZE,
  type Category,
  type Comment,
  type Product,
  type ProductStatus,
  type ProductSummary,
  type Profile,
  type ProfileSummary,
  type Report,
  type Session,
  type ShekargahApi,
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
  published_at: string | null
  created_at: string
  moderation_note: string | null
  moderated_at: string | null
  category: { id: string; slug: string; name: string } | null
  maker: ProfileRow
  moderator: { display_name: string } | null
}

interface FeedRow {
  id: string
  slug: string
  name: string
  tagline: string
  logo_path: string | null
  votes_count: number
  comments_count: number
  published_at: string | null
  category_id: string | null
  category_slug: string | null
  category_name: string | null
  total_count: number
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
const PROFILE_FULL = `${PROFILE_SUMMARY}, bio, role, created_at`
const PRODUCT_SELECT = `id, slug, name, tagline, description, website_url, logo_path, status, votes_count,
  comments_count, published_at, created_at, moderation_note, moderated_at,
  category:categories(id, slug, name),
  maker:profiles!products_maker_id_fkey(${PROFILE_SUMMARY}),
  moderator:profiles!products_moderated_by_fkey(display_name)`
const COMMENT_SELECT = `id, product_id, body, created_at, author:profiles!comments_author_id_fkey(${PROFILE_SUMMARY})`
const REPORT_SELECT = `id, reason, details, status, created_at, resolved_at,
  reporter:profiles!reports_reporter_id_fkey(${PROFILE_SUMMARY}),
  product:products(id, slug, name, status),
  comment:comments(id, body, product:products(slug, name))`

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const MESSAGE_CODES: [RegExp, ApiErrorCode][] = [
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

/** Unwraps a query that must return data (lists, `.single()`, RPCs). */
function check<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw mapPostgrestError(result.error)
  if (result.data === null || result.data === undefined) throw new ApiError('not_found')
  return result.data
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

  const publicUrl = (bucket: string, path: string | null) =>
    path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null

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
  })
  const toCategory = (row: CategoryRow): Category => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  })
  const toProduct = (row: ProductRow): Product => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    websiteUrl: row.website_url,
    logoUrl: publicUrl('product-logos', row.logo_path),
    status: row.status,
    votesCount: row.votes_count,
    commentsCount: row.comments_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    category: row.category,
    maker: toSummary(row.maker),
    moderationNote: row.moderation_note,
    moderatedAt: row.moderated_at,
    moderatorName: row.moderator?.display_name ?? null,
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

  async function upload(bucket: string, file: File): Promise<string> {
    const userId = await currentUserId()
    const extension = EXTENSIONS[file.type]
    if (!extension) throw new ApiError('upload_failed', `unsupported type ${file.type}`)
    const path = `${userId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw new ApiError('upload_failed', error.message)
    return path
  }

  async function removeFile(bucket: string, path: string | null | undefined) {
    if (path) await supabase.storage.from(bucket).remove([path])
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
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw mapAuthError(error)
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
      return row ? toProfile(row) : null
    },

    async getProfileByUsername(username) {
      const row = maybe(
        await supabase.from('profiles').select(PROFILE_FULL).eq('username', username).maybeSingle<ProfileRow>(),
      )
      return row ? toProfile(row) : null
    },

    async updateProfile(userId, input) {
      const existing = check(
        await supabase.from('profiles').select('avatar_path').eq('id', userId).single<{ avatar_path: string | null }>(),
      )
      let avatarPath = existing.avatar_path
      if (input.avatar) avatarPath = await upload('avatars', input.avatar)
      else if (input.removeAvatar) avatarPath = null

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: input.username.trim(),
          display_name: normalizeFa(input.displayName.trim()),
          bio: input.bio.trim() ? normalizeFa(input.bio.trim()) : null,
          avatar_path: avatarPath,
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

    async listProducts({ search, category, sort, page }) {
      const rows = check(
        await supabase.rpc('list_products', {
          p_search: search?.trim() ? normalizeFa(search.trim()) : null,
          p_category: category || null,
          p_sort: sort,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
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
        publishedAt: row.published_at,
        category: row.category_id ? { id: row.category_id, slug: row.category_slug!, name: row.category_name! } : null,
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
      const logoPath = input.logo ? await upload('product-logos', input.logo) : null
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: input.name.trim(),
          tagline: input.tagline.trim(),
          description: input.description.trim(),
          website_url: input.websiteUrl.trim(),
          category_id: input.categoryId,
          logo_path: logoPath,
        })
        .select(PRODUCT_SELECT)
        .single<ProductRow>()
      if (error) {
        await removeFile('product-logos', logoPath)
        throw mapPostgrestError(error)
      }
      return toProduct(data)
    },

    async deleteProduct(productId) {
      const rows = check(
        await supabase.from('products').delete().eq('id', productId).select('id, logo_path').returns<{ id: string; logo_path: string | null }[]>(),
      )
      if (rows.length === 0) throw new ApiError('not_authorized')
      await removeFile('product-logos', rows[0]!.logo_path)
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
  }
}

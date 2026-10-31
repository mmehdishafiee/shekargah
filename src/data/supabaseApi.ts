import { AuthError, createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type ApiErrorCode } from '@/lib/errors'
import { normalizeFa } from '@/lib/text'
import { parseStored } from './storage'
import {
  PAGE_SIZE,
  type Category,
  type Comment,
  type Product,
  type ProductStatus,
  type ProductSummary,
  type Profile,
  type ProfileSummary,
  type RankedProduct,
  type Report,
  type Session,
  type ShekargahApi,
  type Tag,
  type TagRef,
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
  views_count: number
  published_at: string | null
  created_at: string
  moderation_note: string | null
  moderated_at: string | null
  category: { id: string; slug: string; name: string } | null
  maker: ProfileRow
  moderator: { display_name: string } | null
  product_tags: { tags: { slug: string; name: string } | null }[]
  product_screenshots?: { storage_provider: 'supabase' | 'r2'; object_key: string; alt_text: string | null; sort_order: number }[]
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
const PROFILE_FULL = `${PROFILE_SUMMARY}, bio, role, created_at`
const PRODUCT_SELECT = `id, slug, name, tagline, description, website_url, logo_path, status, votes_count,
  comments_count, views_count, published_at, created_at, moderation_note, moderated_at,
  category:categories(id, slug, name),
  maker:profiles!products_maker_id_fkey(${PROFILE_SUMMARY}),
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
  const toProductSummary = (row: ProductRow): ProductSummary => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    logoUrl: publicUrl('product-logos', row.logo_path),
    votesCount: row.votes_count,
    commentsCount: row.comments_count,
    viewsCount: row.views_count,
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

  async function upload(bucket: string, file: File, ownerId: string): Promise<string> {
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

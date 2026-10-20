import { ApiError } from '@/lib/errors'
import { leaderboardWindowStart, tehranDateLabel } from '@/lib/engagement'
import { normalizeFa, slugify } from '@/lib/text'
import { createDemoState, type DemoComment, type DemoProduct, type DemoState, type DemoUser } from './demoSeed'
import {
  PAGE_SIZE,
  type AuthEvent,
  type Category,
  type Comment,
  type LeaderboardPeriod,
  type Product,
  type ProductSummary,
  type Profile,
  type ProfileSummary,
  type RankedProduct,
  type Report,
  type Session,
  type ShekargahApi,
  type TagRef,
} from './types'

export interface DemoStorage {
  load(): DemoState | null
  save(state: DemoState): void
}

const STORAGE_KEY = 'shekargah:demo:v2'

export const browserStorage: DemoStorage = {
  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as DemoState) : null
      return parsed?.version === 2 ? parsed : null
    } catch {
      return null
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or unavailable: the demo keeps working in memory.
    }
  },
}

export function resetDemoStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ApiError('upload_failed'))
    reader.readAsDataURL(file)
  })
}

let idCounter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

/**
 * Browser-only backend used when Supabase is not configured. It enforces the
 * same rules as the database (pending submissions, one vote per user, admin
 * only moderation) so the UI behaves identically in both modes.
 */
export function createDemoApi(options: { storage?: DemoStorage | null; latencyMs?: number; state?: DemoState } = {}): ShekargahApi {
  const storage = options.storage === undefined ? browserStorage : options.storage
  const latency = options.latencyMs ?? 0
  const state: DemoState = options.state ?? storage?.load() ?? createDemoState()
  const listeners = new Set<(session: Session | null, event: AuthEvent) => void>()

  const persist = () => storage?.save(state)
  const wait = () => (latency > 0 ? new Promise((r) => setTimeout(r, latency)) : Promise.resolve())

  const userById = (id: string) => state.users.find((u) => u.id === id)
  const current = () => (state.sessionUserId ? userById(state.sessionUserId) ?? null : null)
  const requireUser = () => {
    const user = current()
    if (!user) throw new ApiError('not_authenticated')
    return user
  }
  const requireAdmin = () => {
    const user = requireUser()
    if (user.role !== 'admin') throw new ApiError('not_authorized')
    return user
  }
  const canSee = (product: DemoProduct) => {
    const user = current()
    return product.status === 'published' || product.makerId === user?.id || user?.role === 'admin'
  }

  const toSummary = (user: DemoUser): ProfileSummary => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  })
  const toProfile = (user: DemoUser): Profile => ({
    ...toSummary(user),
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt,
  })
  const categoryRef = (id: string) => {
    const category = state.categories.find((c) => c.id === id)
    const user = current()
    if (!category || (!category.isActive && user?.role !== 'admin')) return null
    return { id: category.id, slug: category.slug, name: category.name }
  }
  const tagRefs = (productId: string): TagRef[] =>
    state.productTags
      .filter((pt) => pt.productId === productId)
      .map((pt) => state.tags.find((tag) => tag.id === pt.tagId))
      .flatMap((tag) => (tag ? [{ slug: tag.slug, name: tag.name }] : []))
  const toProductSummary = (p: DemoProduct): ProductSummary => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    logoUrl: p.logoUrl,
    votesCount: p.votesCount,
    commentsCount: p.commentsCount,
    viewsCount: p.viewsCount,
    publishedAt: p.publishedAt,
    category: categoryRef(p.categoryId),
    tags: tagRefs(p.id),
  })
  const toProduct = (p: DemoProduct): Product => ({
    ...toProductSummary(p),
    description: p.description,
    websiteUrl: p.websiteUrl,
    status: p.status,
    maker: toSummary(userById(p.makerId)!),
    moderationNote: p.moderationNote,
    moderatedAt: p.moderatedAt,
    moderatorName: p.moderatedBy ? userById(p.moderatedBy)?.displayName ?? null : null,
    createdAt: p.createdAt,
  })
  const toComment = (c: DemoComment): Comment => ({
    id: c.id,
    productId: c.productId,
    body: c.body,
    createdAt: c.createdAt,
    author: toSummary(userById(c.authorId)!),
  })
  const publishedProduct = (productId: string) => {
    const product = state.products.find((p) => p.id === productId)
    if (!product || product.status !== 'published') throw new ApiError('not_authorized', 'product is not published')
    return product
  }
  const emit = (event: AuthEvent) => {
    const user = current()
    const session = user ? { userId: user.id, email: user.email } : null
    for (const listener of listeners) listener(session, event)
  }

  return {
    mode: 'demo',

    async getSession() {
      const user = current()
      return user ? { userId: user.id, email: user.email } : null
    },

    onAuthChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async signUp({ email, displayName }) {
      await wait()
      const normalized = email.trim().toLowerCase()
      if (state.users.some((u) => u.email === normalized)) throw new ApiError('email_taken')
      let username = normalized.split('@')[0]!.replace(/[^a-z0-9_]/g, '').slice(0, 20)
      if (username.length < 3) username = `user${username}`
      const base = username
      while (state.users.some((u) => u.username === username)) username = `${base}_${Math.random().toString(16).slice(2, 7)}`
      const user: DemoUser = {
        id: newId('u'),
        email: normalized,
        username,
        displayName: normalizeFa(displayName.trim()) || username,
        bio: null,
        avatarUrl: null,
        role: 'user',
        createdAt: new Date().toISOString(),
      }
      state.users.push(user)
      state.sessionUserId = user.id
      persist()
      emit('SIGNED_IN')
      return { needsConfirmation: false }
    },

    async signIn({ email }) {
      await wait()
      // Demo accounts accept any password; real authentication happens in Supabase.
      const user = state.users.find((u) => u.email === email.trim().toLowerCase())
      if (!user) throw new ApiError('invalid_credentials')
      state.sessionUserId = user.id
      persist()
      emit('SIGNED_IN')
    },

    async signOut() {
      state.sessionUserId = null
      persist()
      emit('SIGNED_OUT')
    },

    async requestPasswordReset() {
      await wait()
    },

    async updatePassword() {
      await wait()
      requireUser()
    },

    async getProfile(userId) {
      const user = userById(userId)
      return user ? toProfile(user) : null
    },

    async getProfileByUsername(username) {
      await wait()
      const user = state.users.find((u) => u.username === username)
      return user ? toProfile(user) : null
    },

    async updateProfile(userId, input) {
      await wait()
      const user = requireUser()
      if (user.id !== userId) throw new ApiError('not_authorized')
      const username = input.username.trim()
      if (state.users.some((u) => u.username === username && u.id !== user.id)) throw new ApiError('username_taken')
      user.username = username
      user.displayName = normalizeFa(input.displayName.trim())
      user.bio = input.bio.trim() ? normalizeFa(input.bio.trim()) : null
      if (input.removeAvatar) user.avatarUrl = null
      if (input.avatar) user.avatarUrl = await readAsDataUrl(input.avatar)
      persist()
      return toProfile(user)
    },

    async listCategories(opts) {
      await wait()
      const includeInactive = opts?.includeInactive && current()?.role === 'admin'
      return state.categories
        .filter((c) => c.isActive || includeInactive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'))
        .map((c) => ({ ...c }))
    },

    async listTags() {
      await wait()
      return state.tags.map((tag) => ({ ...tag }))
    },

    async listProducts({ search, category, tags, sort, page }) {
      await wait()
      const term = normalizeFa(search?.trim() ?? '').toLowerCase()
      const categoryId = category ? state.categories.find((c) => c.slug === category)?.id ?? '__none__' : null
      const wantedTags = new Set(tags ?? [])
      const matches = state.products
        .filter((p) => p.status === 'published')
        .filter((p) => !categoryId || p.categoryId === categoryId)
        .filter((p) => !term || `${p.name} ${p.tagline}`.toLowerCase().includes(term))
        .filter((p) => {
          if (wantedTags.size === 0) return true
          return state.productTags.some((pt) => {
            if (pt.productId !== p.id) return false
            const tag = state.tags.find((tag) => tag.id === pt.tagId)
            return tag ? wantedTags.has(tag.slug) : false
          })
        })
        .sort((a, b) => {
          if (sort === 'popular' && b.votesCount !== a.votesCount) return b.votesCount - a.votesCount
          return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
        })
      const start = Math.max(0, page) * PAGE_SIZE
      const items = matches.slice(start, start + PAGE_SIZE).map(toProductSummary)
      return { items, total: matches.length, hasMore: start + PAGE_SIZE < matches.length }
    },

    async getProduct(slug) {
      await wait()
      const product = state.products.find((p) => p.slug === slug)
      return product && canSee(product) ? toProduct(product) : null
    },

    async listMakerProducts(makerId) {
      await wait()
      return state.products
        .filter((p) => p.makerId === makerId && canSee(p))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toProduct)
    },

    async submitProduct(input) {
      await wait()
      const user = requireUser()
      if (input.tags.length > 5) throw new ApiError('too_many_tags')
      if (input.tags.some((slug) => !state.tags.some((tag) => tag.slug === slug))) throw new ApiError('unknown_tag')
      if (state.products.filter((p) => p.makerId === user.id && p.status === 'pending').length >= 3) {
        throw new ApiError('too_many_pending')
      }
      if (!state.categories.some((c) => c.id === input.categoryId && c.isActive)) throw new ApiError('inactive_category')
      const name = normalizeFa(input.name.trim())
      const base = slugify(name) || 'product'
      let slug = base
      while (state.products.some((p) => p.slug === slug)) slug = `${base}-${Math.random().toString(16).slice(2, 7)}`
      const now = new Date().toISOString()
      const product: DemoProduct = {
        id: newId('p'),
        slug,
        name,
        tagline: normalizeFa(input.tagline.trim()),
        description: normalizeFa(input.description.trim()),
        websiteUrl: input.websiteUrl.trim(),
        logoUrl: input.logo ? await readAsDataUrl(input.logo) : null,
        categoryId: input.categoryId,
        makerId: user.id,
        status: 'pending',
        moderationNote: null,
        moderatedBy: null,
        moderatedAt: null,
        publishedAt: null,
        votesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
      }
      state.products.push(product)
      state.productTags.push(
        ...input.tags.map((slug) => ({ productId: product.id, tagId: state.tags.find((tag) => tag.slug === slug)!.id })),
      )
      persist()
      return toProduct(product)
    },

    async deleteProduct(productId) {
      await wait()
      const user = requireUser()
      const product = state.products.find((p) => p.id === productId)
      if (!product) throw new ApiError('not_found')
      const allowed = user.role === 'admin' || (product.makerId === user.id && product.status !== 'published')
      if (!allowed) throw new ApiError('not_authorized')
      state.products = state.products.filter((p) => p.id !== productId)
      state.votes = state.votes.filter((v) => v.productId !== productId)
      state.comments = state.comments.filter((c) => c.productId !== productId)
      state.saved = state.saved.filter((save) => save.productId !== productId)
      state.views = state.views.filter((view) => view.productId !== productId)
      state.productTags = state.productTags.filter((pt) => pt.productId !== productId)
      persist()
    },

    async setProductTags(productId, slugs) {
      await wait()
      const user = requireUser()
      const product = state.products.find((p) => p.id === productId)
      if (!product) throw new ApiError('not_found')
      const allowed = user.role === 'admin' || (product.makerId === user.id && product.status !== 'published')
      if (!allowed) throw new ApiError('not_authorized')
      if (slugs.length > 5) throw new ApiError('too_many_tags')
      if (slugs.some((slug) => !state.tags.some((tag) => tag.slug === slug))) throw new ApiError('unknown_tag')
      state.productTags = state.productTags.filter((pt) => pt.productId !== productId)
      state.productTags.push(...slugs.map((slug) => ({ productId, tagId: state.tags.find((tag) => tag.slug === slug)!.id })))
      persist()
    },

    async listDailyProducts({ date, page }) {
      await wait()
      const target = date ?? tehranDateLabel()
      const matches = state.products
        .filter((p) => p.status === 'published' && p.publishedAt && tehranDateLabel(new Date(p.publishedAt)) === target)
        .sort((a, b) => b.votesCount - a.votesCount || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      const start = Math.max(0, page) * PAGE_SIZE
      const items: RankedProduct[] = matches.slice(start, start + PAGE_SIZE).map((p, index) => ({
        ...toProductSummary(p),
        rank: start + index + 1,
        score: null,
      }))
      return { items, total: matches.length, hasMore: start + PAGE_SIZE < matches.length }
    },

    async listLeaderboard({ period, page }) {
      await wait()
      const startAt = leaderboardWindowStart(period as LeaderboardPeriod).getTime()
      const scores = new Map<string, number>()
      for (const vote of state.votes) {
        if (new Date(vote.createdAt).getTime() >= startAt) scores.set(vote.productId, (scores.get(vote.productId) ?? 0) + 1)
      }
      const matches = state.products
        .filter((p) => p.status === 'published' && (scores.get(p.id) ?? 0) > 0)
        .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      const start = Math.max(0, page) * PAGE_SIZE
      const items: RankedProduct[] = matches.slice(start, start + PAGE_SIZE).map((p, index) => ({
        ...toProductSummary(p),
        rank: start + index + 1,
        score: scores.get(p.id) ?? 0,
      }))
      return { items, total: matches.length, hasMore: start + PAGE_SIZE < matches.length }
    },

    async listTrending(page) {
      await wait()
      const cutoff = Date.now() - 48 * 3600 * 1000
      const votes = new Map<string, number>()
      for (const vote of state.votes) {
        if (new Date(vote.createdAt).getTime() > cutoff) votes.set(vote.productId, (votes.get(vote.productId) ?? 0) + 1)
      }
      const comments = new Map<string, number>()
      for (const comment of state.comments) {
        if (new Date(comment.createdAt).getTime() > cutoff) comments.set(comment.productId, (comments.get(comment.productId) ?? 0) + 1)
      }
      const matches = state.products
        .filter((p) => p.status === 'published' && p.publishedAt && new Date(p.publishedAt).getTime() > Date.now() - 30 * 24 * 3600 * 1000)
        .map((p) => ({ p, score: (votes.get(p.id) ?? 0) * 3 + (comments.get(p.id) ?? 0) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || (b.p.publishedAt ?? '').localeCompare(a.p.publishedAt ?? ''))
      const start = Math.max(0, page) * PAGE_SIZE
      const items: RankedProduct[] = matches.slice(start, start + PAGE_SIZE).map(({ p, score }, index) => ({
        ...toProductSummary(p),
        rank: start + index + 1,
        score,
      }))
      return { items, total: matches.length, hasMore: start + PAGE_SIZE < matches.length }
    },

    async recordProductView(productId, viewerKey) {
      await wait()
      const product = state.products.find((p) => p.id === productId)
      if (!product || product.status !== 'published') throw new ApiError('not_found')
      if (!viewerKey.trim()) throw new ApiError('invalid_input')
      const cutoff = Date.now() - 24 * 3600 * 1000
      const exists = state.views.some(
        (view) => view.productId === productId && view.viewerKey === viewerKey && new Date(view.createdAt).getTime() > cutoff,
      )
      if (exists) return
      state.views.push({ productId, viewerKey: viewerKey.slice(0, 64), createdAt: new Date().toISOString() })
      product.viewsCount += 1
      persist()
    },

    async listMySavedProductIds(productIds) {
      await wait()
      const user = current()
      if (!user) return []
      return state.saved
        .filter((save) => save.userId === user.id && productIds.includes(save.productId))
        .map((save) => save.productId)
    },

    async listMySavedProducts(page) {
      await wait()
      const user = requireUser()
      const matches = state.saved
        .filter((save) => save.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((save) => state.products.find((product) => product.id === save.productId))
        .flatMap((product) => (product ? [product] : []))
      const start = Math.max(0, page) * PAGE_SIZE
      const items = matches.slice(start, start + PAGE_SIZE).map(toProductSummary)
      return { items, total: matches.length, hasMore: start + PAGE_SIZE < matches.length }
    },

    async saveProduct(productId) {
      await wait()
      const user = requireUser()
      publishedProduct(productId)
      if (state.saved.some((save) => save.userId === user.id && save.productId === productId)) throw new ApiError('duplicate')
      state.saved.push({ userId: user.id, productId, createdAt: new Date().toISOString() })
      persist()
    },

    async unsaveProduct(productId) {
      await wait()
      const user = requireUser()
      const before = state.saved.length
      state.saved = state.saved.filter((save) => !(save.userId === user.id && save.productId === productId))
      if (state.saved.length === before) throw new ApiError('not_found')
      persist()
    },

    async listMyVotes(productIds) {
      const user = current()
      if (!user) return []
      return state.votes.filter((v) => v.userId === user.id && productIds.includes(v.productId)).map((v) => v.productId)
    },

    async vote(productId) {
      await wait()
      const user = requireUser()
      const product = publishedProduct(productId)
      if (state.votes.some((v) => v.userId === user.id && v.productId === productId)) throw new ApiError('duplicate')
      state.votes.push({ userId: user.id, productId, createdAt: new Date().toISOString() })
      product.votesCount += 1
      persist()
    },

    async unvote(productId) {
      await wait()
      const user = requireUser()
      const before = state.votes.length
      state.votes = state.votes.filter((v) => !(v.userId === user.id && v.productId === productId))
      const product = state.products.find((p) => p.id === productId)
      if (product && state.votes.length < before) product.votesCount = Math.max(0, product.votesCount - 1)
      persist()
    },

    async listComments(productId) {
      await wait()
      const product = state.products.find((p) => p.id === productId)
      if (!product || (product.status !== 'published' && current()?.role !== 'admin')) return []
      return state.comments
        .filter((c) => c.productId === productId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(toComment)
    },

    async addComment(productId, body) {
      await wait()
      const user = requireUser()
      const product = publishedProduct(productId)
      const text = normalizeFa(body.trim())
      if (!text || text.length > 1000) throw new ApiError('invalid_input')
      const minuteAgo = new Date(Date.now() - 60_000).toISOString()
      if (state.comments.filter((c) => c.authorId === user.id && c.createdAt > minuteAgo).length >= 5) {
        throw new ApiError('rate_limited')
      }
      const comment: DemoComment = { id: newId('m'), productId, authorId: user.id, body: text, createdAt: new Date().toISOString() }
      state.comments.push(comment)
      product.commentsCount += 1
      persist()
      return toComment(comment)
    },

    async deleteComment(commentId) {
      await wait()
      const user = requireUser()
      const comment = state.comments.find((c) => c.id === commentId)
      if (!comment) throw new ApiError('not_found')
      if (comment.authorId !== user.id && user.role !== 'admin') throw new ApiError('not_authorized')
      state.comments = state.comments.filter((c) => c.id !== commentId)
      state.reports = state.reports.filter((r) => r.commentId !== commentId)
      const product = state.products.find((p) => p.id === comment.productId)
      if (product) product.commentsCount = Math.max(0, product.commentsCount - 1)
      persist()
    },

    async reportContent({ productId, commentId, reason, details }) {
      await wait()
      const user = requireUser()
      if (Boolean(productId) === Boolean(commentId)) throw new ApiError('invalid_input')
      const duplicate = state.reports.some(
        (r) => r.reporterId === user.id && ((productId && r.productId === productId) || (commentId && r.commentId === commentId)),
      )
      if (duplicate) throw new ApiError('duplicate')
      state.reports.push({
        id: newId('r'),
        reporterId: user.id,
        productId: productId ?? null,
        commentId: commentId ?? null,
        reason,
        details: details.trim() || null,
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
      })
      persist()
    },

    async listProductsByStatus(status, page) {
      await wait()
      requireAdmin()
      const matches = state.products
        .filter((p) => p.status === status)
        .sort((a, b) =>
          status === 'published'
            ? (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
            : status === 'pending'
              ? a.createdAt.localeCompare(b.createdAt)
              : (b.moderatedAt ?? '').localeCompare(a.moderatedAt ?? ''),
        )
      const start = page * PAGE_SIZE
      return {
        items: matches.slice(start, start + PAGE_SIZE).map(toProduct),
        total: matches.length,
        hasMore: start + PAGE_SIZE < matches.length,
      }
    },

    async moderateProduct(productId, action, note) {
      await wait()
      const admin = requireAdmin()
      const product = state.products.find((p) => p.id === productId)
      if (!product) throw new ApiError('not_found')
      const cleanNote = note?.trim() || null
      if (action === 'approve') {
        if (product.status === 'published') throw new ApiError('invalid_transition')
        product.status = 'published'
        product.publishedAt ??= new Date().toISOString()
      } else {
        const expected = action === 'reject' ? 'pending' : 'published'
        if (product.status !== expected) throw new ApiError('invalid_transition')
        if (!cleanNote) throw new ApiError('note_required')
        product.status = 'rejected'
      }
      product.moderationNote = cleanNote
      product.moderatedBy = admin.id
      product.moderatedAt = new Date().toISOString()
      persist()
    },

    async saveCategory(input) {
      await wait()
      requireAdmin()
      const clash = state.categories.find((c) => (c.slug === input.slug || c.name === input.name) && c.id !== input.id)
      if (clash) throw new ApiError('duplicate')
      const values: Omit<Category, 'id'> = {
        slug: input.slug.trim(),
        name: normalizeFa(input.name.trim()),
        description: input.description.trim() || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      }
      if (input.id) {
        const category = state.categories.find((c) => c.id === input.id)
        if (!category) throw new ApiError('not_found')
        Object.assign(category, values)
        persist()
        return { ...category }
      }
      const category: Category = { id: newId('c'), ...values }
      state.categories.push(category)
      persist()
      return { ...category }
    },

    async deleteCategory(categoryId) {
      await wait()
      requireAdmin()
      if (state.products.some((p) => p.categoryId === categoryId)) throw new ApiError('category_in_use')
      state.categories = state.categories.filter((c) => c.id !== categoryId)
      persist()
    },

    async listReports(filter) {
      await wait()
      requireAdmin()
      return state.reports
        .filter((r) => filter === 'all' || r.status === 'open')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r): Report => {
          const product = r.productId ? state.products.find((p) => p.id === r.productId) : undefined
          const comment = r.commentId ? state.comments.find((c) => c.id === r.commentId) : undefined
          const commentProduct = comment ? state.products.find((p) => p.id === comment.productId) : undefined
          const reporter = userById(r.reporterId)
          return {
            id: r.id,
            reason: r.reason,
            details: r.details,
            status: r.status,
            createdAt: r.createdAt,
            resolvedAt: r.resolvedAt,
            reporter: reporter ? toSummary(reporter) : null,
            product: product ? { id: product.id, slug: product.slug, name: product.name, status: product.status } : null,
            comment: comment
              ? {
                  id: comment.id,
                  body: comment.body,
                  product: commentProduct ? { slug: commentProduct.slug, name: commentProduct.name } : null,
                }
              : null,
          }
        })
    },

    async resolveReport(reportId, status) {
      await wait()
      const admin = requireAdmin()
      const report = state.reports.find((r) => r.id === reportId)
      if (!report) throw new ApiError('not_found')
      report.status = status
      report.resolvedBy = admin.id
      report.resolvedAt = new Date().toISOString()
      persist()
    },
  }
}

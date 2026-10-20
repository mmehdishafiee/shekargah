import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoApi } from './demoApi'
import { DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL, createDemoState } from './demoSeed'
import type { ShekargahApi } from './types'

let api: ShekargahApi

const input = {
  name: 'ابزار تازه',
  tagline: 'یک ابزار آزمایشی برای تست',
  description: 'توضیح کامل‌تر ابزار آزمایشی که از سی نویسه بیشتر است.',
  websiteUrl: 'https://example.com/new',
  categoryId: 'c-01',
  tags: [] as string[],
  logo: null,
}

beforeEach(() => {
  api = createDemoApi({ storage: null, state: createDemoState() })
})

describe('demo backend mirrors the database rules', () => {
  it('lists only published products, sorted and filtered', async () => {
    const popular = await api.listProducts({ sort: 'popular', page: 0 })
    expect(popular.items.length).toBeGreaterThan(5)
    const counts = popular.items.map((p) => p.votesCount)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(popular.items.some((p) => p.name === 'کارنما')).toBe(false)

    const openSource = await api.listProducts({ sort: 'newest', category: 'open-source', page: 0 })
    expect(openSource.items.every((p) => p.category?.slug === 'open-source')).toBe(true)

    const search = await api.listProducts({ sort: 'popular', search: 'دفترچه', page: 0 })
    expect(search.items.map((p) => p.name)).toEqual(['دفترچه'])
  })

  it('requires sign-in to submit, and saves submissions as pending', async () => {
    await expect(api.submitProduct(input)).rejects.toMatchObject({ code: 'not_authenticated' })
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct(input)
    expect(product.status).toBe('pending')
    expect(product.slug).toBe('ابزار-تازه')
    const feed = await api.listProducts({ sort: 'newest', page: 0 })
    expect(feed.items.some((p) => p.id === product.id)).toBe(false)
  })

  it('does not let regular users moderate', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct(input)
    await expect(api.moderateProduct(product.id, 'approve')).rejects.toMatchObject({ code: 'not_authorized' })
  })

  it('lets admins approve (and requires a note to reject)', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct(input)
    await api.signIn({ email: DEMO_ADMIN_EMAIL, password: 'x' })
    await expect(api.moderateProduct(product.id, 'reject')).rejects.toMatchObject({ code: 'note_required' })
    await api.moderateProduct(product.id, 'approve')
    const published = await api.getProduct(product.slug)
    expect(published).toMatchObject({ status: 'published', moderatorName: 'مدیر شکارگاه' })
  })

  it('allows one vote per user and keeps counts in sync', async () => {
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    await api.vote(first!.id)
    await expect(api.vote(first!.id)).rejects.toMatchObject({ code: 'duplicate' })
    expect((await api.getProduct(first!.slug))!.votesCount).toBe(first!.votesCount + 1)
    await api.unvote(first!.id)
    expect((await api.getProduct(first!.slug))!.votesCount).toBe(first!.votesCount)
  })

  it('refuses votes and comments on unpublished products', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct(input)
    await expect(api.vote(product.id)).rejects.toMatchObject({ code: 'not_authorized' })
    await expect(api.addComment(product.id, 'سلام')).rejects.toMatchObject({ code: 'not_authorized' })
  })

  it('hides private submissions from other users', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct(input)
    await api.signOut()
    expect(await api.getProduct(product.slug)).toBeNull()
    const makerProducts = await api.listMakerProducts('u-sara')
    expect(makerProducts.every((p) => p.status === 'published')).toBe(true)
  })

  it('lets only authors or admins delete comments', async () => {
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    const [comment] = await api.listComments(first!.id)
    await api.signIn({ email: 'mina@demo.shekargah', password: 'x' })
    await expect(api.deleteComment(comment!.id)).rejects.toMatchObject({ code: 'not_authorized' })
    await api.signIn({ email: DEMO_ADMIN_EMAIL, password: 'x' })
    await api.deleteComment(comment!.id)
    expect((await api.listComments(first!.id)).some((c) => c.id === comment!.id)).toBe(false)
  })

  it('filters feed by tags and maps tags onto products', async () => {
    const feed = await api.listProducts({ sort: 'newest', tags: ['open-source'], page: 0 })
    expect(feed.items.length).toBeGreaterThan(0)
    expect(feed.items.every((p) => p.tags.some((tag) => tag.slug === 'open-source'))).toBe(true)

    const empty = await api.listProducts({ sort: 'newest', tags: ['unknown'], page: 0 })
    expect(empty.items).toHaveLength(0)
  })

  it('enforces tag limits and validates tag slugs', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    await expect(api.submitProduct({ ...input, tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).rejects.toMatchObject({
      code: 'too_many_tags',
    })
    await expect(api.submitProduct({ ...input, tags: ['not-a-tag'] })).rejects.toMatchObject({ code: 'unknown_tag' })
  })

  it('stores tags on submitted products', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct({ ...input, tags: ['open-source', 'persian'] })
    const saved = await api.getProduct(product.slug)
    expect(saved?.tags.map((tag) => tag.slug).sort()).toEqual(['open-source', 'persian'])
  })

  it('lets makers tag their own pending products only', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const product = await api.submitProduct({ ...input, tags: [] })
    await api.setProductTags(product.id, ['ai'])
    expect((await api.getProduct(product.slug))?.tags.map((tag) => tag.slug)).toEqual(['ai'])
  })

  it('rejects tag edits on someone elses product or a published one', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const own = await api.submitProduct({ ...input, tags: [] })
    await api.signIn({ email: 'mina@demo.shekargah', password: 'x' })
    await expect(api.setProductTags(own.id, ['ai'])).rejects.toMatchObject({ code: 'not_authorized' })
    const published = (await api.listProducts({ sort: 'popular', page: 0 })).items[0]
    await api.signIn({ email: DEMO_ADMIN_EMAIL, password: 'x' })
    await api.setProductTags(published!.id, ['ai'])
    expect((await api.getProduct(published!.slug))?.tags.map((tag) => tag.slug)).toContain('ai')
  })

  it('saves and unsaves only published products, privately', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await api.saveProduct(first!.id)
    await expect(api.saveProduct(first!.id)).rejects.toMatchObject({ code: 'duplicate' })
    expect(await api.listMySavedProductIds([first!.id])).toEqual([first!.id])
    const saved = await api.listMySavedProducts(0)
    expect(saved.items.some((p) => p.id === first!.id)).toBe(true)
    await api.signOut()
    expect(await api.listMySavedProductIds([first!.id])).toEqual([])
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    await api.unsaveProduct(first!.id)
    expect(await api.listMySavedProductIds([first!.id])).toEqual([])
  })

  it('rejects saving unpublished products', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const pending = await api.submitProduct({ ...input, tags: [] })
    await expect(api.saveProduct(pending.id)).rejects.toMatchObject({ code: 'not_authorized' })
  })

  it('counts a view once per viewer per day', async () => {
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await api.recordProductView(first!.id, 'viewer-1')
    const afterOne = (await api.getProduct(first!.slug))!.viewsCount
    await api.recordProductView(first!.id, 'viewer-1')
    expect((await api.getProduct(first!.slug))!.viewsCount).toBe(afterOne)
    await api.recordProductView(first!.id, 'viewer-2')
    expect((await api.getProduct(first!.slug))!.viewsCount).toBe(afterOne + 1)
  })

  it('rejects views on pending products and blank viewer keys', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const pending = await api.submitProduct({ ...input, tags: [] })
    await expect(api.recordProductView(pending.id, 'v')).rejects.toMatchObject({ code: 'not_found' })
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await expect(api.recordProductView(first!.id, '')).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('ranks leaderboard by window votes, not lifetime totals', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const [first] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await api.vote(first!.id)
    const board = await api.listLeaderboard({ period: 'daily', page: 0 })
    expect(board.items[0]?.id).toBe(first!.id)
    expect(board.items[0]?.score).toBe(1)
  })

  it('ranks trending by recent votes and comments', async () => {
    await api.signIn({ email: DEMO_USER_EMAIL, password: 'x' })
    const [first, second] = (await api.listProducts({ sort: 'popular', page: 0 })).items
    await api.vote(second!.id)
    await api.addComment(first!.id, 'تست ترند')
    const trending = await api.listTrending(0)
    expect(trending.items.length).toBeGreaterThan(0)
    expect(trending.items[0]?.score).toBeGreaterThanOrEqual(1)
  })

  it('returns only products published on the requested day', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const daily = await api.listDailyProducts({ date: today, page: 0 })
    expect(daily.items.every((p) => p.publishedAt?.startsWith(today))).toBe(true)
    const other = await api.listDailyProducts({ date: '2000-01-01', page: 0 })
    expect(other.items).toHaveLength(0)
  })
})

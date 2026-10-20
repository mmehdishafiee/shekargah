import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { ANON, as, createTestDatabase, createUser, errorOf, promoteToAdmin, type Actor } from './harness.ts'

type Row = Record<string, unknown>

let db: PGlite
let admin: Actor & { kind: 'user' }
let alice: Actor & { kind: 'user' }
let bob: Actor & { kind: 'user' }
let categoryId: string

async function submit(actor: Actor, name: string, extra: Partial<Record<string, string>> = {}) {
  return as(db, actor, async (tx) => {
    const { rows } = await tx.query<Row>(
      `insert into public.products (name, tagline, description, website_url, category_id)
       values ($1, $2, $3, $4, $5) returning *`,
      [
        name,
        extra.tagline ?? 'یک توضیح کوتاه برای آزمایش',
        extra.description ?? 'این یک توضیح کامل‌تر برای محصول آزمایشی است که از سی نویسه بیشتر است.',
        extra.website_url ?? 'https://example.ir',
        extra.category_id ?? categoryId,
      ],
    )
    return rows[0]!
  })
}

async function moderate(actor: Actor, productId: string, action: string, note: string | null = null) {
  return as(db, actor, async (tx) => {
    const { rows } = await tx.query<Row>(`select * from public.moderate_product($1, $2, $3)`, [productId, action, note])
    return rows[0]!
  })
}

async function publish(name: string, maker: Actor = alice) {
  const product = await submit(maker, name)
  return moderate(admin, product.id as string, 'approve')
}

beforeAll(async () => {
  db = await createTestDatabase()
  admin = await createUser(db, 'admin@shekargah.test', 'مدیر')
  alice = await createUser(db, 'alice@shekargah.test', 'آلیس')
  bob = await createUser(db, 'bob@shekargah.test', 'باب')
  await promoteToAdmin(db, 'admin@shekargah.test')
  const { rows } = await db.query<{ id: string }>(`select id from public.categories where slug = 'web-apps'`)
  categoryId = rows[0]!.id
})

describe('profiles', () => {
  it('creates a profile for every new auth user with a safe username', async () => {
    const { rows } = await db.query<Row>(`select username, display_name, role from public.profiles where id = $1`, [alice.id])
    expect(rows[0]).toMatchObject({ username: 'alice', display_name: 'آلیس', role: 'user' })
  })

  it('lets users update their own public fields', async () => {
    await as(db, alice, (tx) => tx.query(`update public.profiles set bio = 'سازنده‌ی محصول' where id = $1`, [alice.id]))
    const { rows } = await db.query<Row>(`select bio from public.profiles where id = $1`, [alice.id])
    expect(rows[0]!.bio).toBe('سازنده‌ی محصول')
  })

  it('does not let users change their role', async () => {
    const message = await errorOf(
      as(db, alice, (tx) => tx.query(`update public.profiles set role = 'admin' where id = $1`, [alice.id])),
    )
    expect(message).toMatch(/permission denied/)
  })

  it('does not let users edit other profiles', async () => {
    const result = await as(db, alice, (tx) =>
      tx.query(`update public.profiles set display_name = 'هک شده' where id = $1`, [bob.id]),
    )
    expect(result.affectedRows).toBe(0)
  })

  it('rejects avatar paths outside the owner folder', async () => {
    const message = await errorOf(
      as(db, alice, (tx) =>
        tx.query(`update public.profiles set avatar_path = $1 where id = $2`, [`${bob.id}/avatar.png`, alice.id]),
      ),
    )
    expect(message).toMatch(/check constraint/)
  })
})

describe('product submissions', () => {
  it('saves new products as pending, owned by the caller, with a Persian slug', async () => {
    const product = await submit(alice, 'دفترچه ابری')
    expect(product).toMatchObject({ status: 'pending', maker_id: alice.id, slug: 'دفترچه-ابری', votes_count: 0 })
  })

  it('generates unique slugs for duplicate names', async () => {
    const product = await submit(bob, 'دفترچه ابری')
    expect(product.slug).toMatch(/^دفترچه-ابری-[0-9a-f]{5}$/)
  })

  it('does not let clients set status, maker or counters', async () => {
    for (const column of ['status', 'maker_id', 'votes_count', 'published_at']) {
      const value = column === 'maker_id' ? bob.id : column === 'status' ? 'published' : column === 'votes_count' ? '999' : new Date().toISOString()
      const message = await errorOf(
        as(db, alice, (tx) =>
          tx.query(
            `insert into public.products (name, tagline, description, website_url, category_id, ${column})
             values ('تقلب', 'یک توضیح کوتاه برای آزمایش', 'این یک توضیح کامل‌تر برای محصول آزمایشی است که طولانی است.', 'https://x.ir', $1, $2)`,
            [categoryId, value],
          ),
        ),
      )
      expect(message, column).toMatch(/permission denied/)
    }
  })

  it('does not let makers update or publish their own products', async () => {
    const product = await submit(bob, 'محصول باب')
    const message = await errorOf(
      as(db, bob, (tx) => tx.query(`update public.products set status = 'published' where id = $1`, [product.id])),
    )
    expect(message).toMatch(/permission denied/)
    const rpc = await errorOf(moderate(bob, product.id as string, 'approve'))
    expect(rpc).toMatch(/not_authorized/)
  })

  it('rejects non-http URLs and too-short text', async () => {
    expect(await errorOf(submit(alice, 'لینک بد', { website_url: 'javascript:alert(1)' }))).toMatch(/check constraint/)
    expect(await errorOf(submit(alice, 'متن کوتاه', { tagline: 'کوتاه' }))).toMatch(/check constraint/)
  })

  it('blocks anonymous submissions', async () => {
    expect(await errorOf(submit(ANON, 'ناشناس'))).toMatch(/permission denied/)
  })

  it('limits each user to three pending submissions', async () => {
    const carol = await createUser(db, 'carol@shekargah.test')
    await submit(carol, 'اول')
    await submit(carol, 'دوم')
    await submit(carol, 'سوم')
    expect(await errorOf(submit(carol, 'چهارم'))).toMatch(/too_many_pending_submissions/)
  })

  it('hides pending products from the public and from other users', async () => {
    const product = await submit(alice, 'محصول مخفی')
    const visible = async (actor: Actor) =>
      as(db, actor, async (tx) => (await tx.query(`select 1 from public.products where id = $1`, [product.id])).rows.length)
    expect(await visible(ANON)).toBe(0)
    expect(await visible(bob)).toBe(0)
    expect(await visible(alice)).toBe(1)
    expect(await visible(admin)).toBe(1)
  })

  it('lets makers delete unpublished submissions but not published ones', async () => {
    const pending = await submit(alice, 'برای حذف')
    const deleted = await as(db, alice, (tx) => tx.query(`delete from public.products where id = $1`, [pending.id]))
    expect(deleted.affectedRows).toBe(1)

    const published = await publish('منتشرشده برای حذف')
    const kept = await as(db, alice, (tx) => tx.query(`delete from public.products where id = $1`, [published.id]))
    expect(kept.affectedRows).toBe(0)
  })
})

describe('moderation', () => {
  it('records the acting admin and timestamps when approving', async () => {
    const product = await submit(alice, 'برای تأیید')
    const approved = await moderate(admin, product.id as string, 'approve')
    expect(approved).toMatchObject({ status: 'published', moderated_by: admin.id })
    expect(approved.moderated_at).toBeTruthy()
    expect(approved.published_at).toBeTruthy()

    const { rows } = await db.query<Row>(`select actor_id, action from public.moderation_events where product_id = $1`, [product.id])
    expect(rows).toEqual([{ actor_id: admin.id, action: 'approve' }])
  })

  it('requires a note to reject or unpublish', async () => {
    const product = await submit(bob, 'برای رد')
    expect(await errorOf(moderate(admin, product.id as string, 'reject'))).toMatch(/note_required/)
    const rejected = await moderate(admin, product.id as string, 'reject', 'اطلاعات ناقص است')
    expect(rejected).toMatchObject({ status: 'rejected', moderation_note: 'اطلاعات ناقص است' })
  })

  it('can unpublish a published product', async () => {
    const product = await publish('برای لغو انتشار')
    const result = await moderate(admin, product.id as string, 'unpublish', 'محتوای نامناسب')
    expect(result.status).toBe('rejected')
    const visible = await as(db, ANON, (tx) => tx.query(`select 1 from public.products where id = $1`, [product.id]))
    expect(visible.rows).toHaveLength(0)
  })

  it('hides the moderation log from regular users', async () => {
    const rows = await as(db, alice, async (tx) => (await tx.query(`select * from public.moderation_events`)).rows)
    expect(rows).toHaveLength(0)
  })
})

describe('votes', () => {
  it('counts one vote per user per product and prevents duplicates', async () => {
    const product = await publish('محصول محبوب')
    await as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [product.id]))
    await as(db, bob, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [product.id]))
    const duplicate = await errorOf(
      as(db, bob, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [product.id])),
    )
    expect(duplicate).toMatch(/votes_user_product_unique/)

    const count = async () =>
      (await db.query<{ votes_count: number }>(`select votes_count from public.products where id = $1`, [product.id])).rows[0]!.votes_count
    expect(await count()).toBe(2)

    await as(db, bob, (tx) => tx.query(`delete from public.votes where product_id = $1`, [product.id]))
    expect(await count()).toBe(1)
  })

  it('does not let a user vote on behalf of someone else', async () => {
    const product = await publish('رأی جعلی')
    const message = await errorOf(
      as(db, alice, (tx) => tx.query(`insert into public.votes (user_id, product_id) values ($1, $2)`, [bob.id, product.id])),
    )
    expect(message).toMatch(/permission denied/)
  })

  it('rejects votes on unpublished products and anonymous votes', async () => {
    const pending = await submit(bob, 'هنوز منتشر نشده')
    const message = await errorOf(
      as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [pending.id])),
    )
    expect(message).toMatch(/row-level security/)

    const published = await publish('رأی ناشناس')
    expect(
      await errorOf(as(db, ANON, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [published.id]))),
    ).toMatch(/permission denied/)
  })

  it('keeps individual votes private', async () => {
    const rows = await as(db, ANON, async (tx) => errorOf(tx.query(`select * from public.votes`)))
    expect(rows).toMatch(/permission denied/)
    const own = await as(db, bob, async (tx) => (await tx.query<Row>(`select user_id from public.votes`)).rows)
    expect(own.every((row) => row.user_id === bob.id)).toBe(true)
  })
})

describe('comments', () => {
  it('lets users comment on published products and keeps the count in sync', async () => {
    const product = await publish('محصول پربحث')
    const comment = await as(db, bob, async (tx) =>
      (await tx.query<Row>(`insert into public.comments (product_id, body) values ($1, $2) returning *`, [product.id, '  عالیه!  '])).rows[0]!,
    )
    expect(comment).toMatchObject({ author_id: bob.id, body: 'عالیه!' })
    const { rows } = await db.query<Row>(`select comments_count from public.products where id = $1`, [product.id])
    expect(rows[0]!.comments_count).toBe(1)

    // Another user cannot delete it; the author can.
    const denied = await as(db, alice, (tx) => tx.query(`delete from public.comments where id = $1`, [comment.id]))
    expect(denied.affectedRows).toBe(0)
    const allowed = await as(db, bob, (tx) => tx.query(`delete from public.comments where id = $1`, [comment.id]))
    expect(allowed.affectedRows).toBe(1)
  })

  it('lets admins remove comments and logs it', async () => {
    const product = await publish('محصول با نظر نامناسب')
    const comment = await as(db, bob, async (tx) =>
      (await tx.query<Row>(`insert into public.comments (product_id, body) values ($1, 'اسپم') returning id`, [product.id])).rows[0]!,
    )
    const removed = await as(db, admin, (tx) => tx.query(`delete from public.comments where id = $1`, [comment.id]))
    expect(removed.affectedRows).toBe(1)
    const { rows } = await db.query<Row>(`select actor_id from public.moderation_events where comment_id = $1`, [comment.id])
    expect(rows).toEqual([{ actor_id: admin.id }])
  })

  it('rejects comments on pending products', async () => {
    const erin = await createUser(db, 'erin@shekargah.test')
    const pending = await submit(erin, 'بدون نظر')
    const message = await errorOf(
      as(db, alice, (tx) => tx.query(`insert into public.comments (product_id, body) values ($1, 'سلام')`, [pending.id])),
    )
    expect(message).toMatch(/row-level security/)
  })

  it('rate limits comment bursts', async () => {
    const product = await publish('محصول پرنظر')
    const dave = await createUser(db, 'dave@shekargah.test')
    for (let i = 0; i < 5; i++) {
      await as(db, dave, (tx) => tx.query(`insert into public.comments (product_id, body) values ($1, $2)`, [product.id, `نظر ${i}`]))
    }
    const message = await errorOf(
      as(db, dave, (tx) => tx.query(`insert into public.comments (product_id, body) values ($1, 'یکی دیگر')`, [product.id])),
    )
    expect(message).toMatch(/comment_rate_limited/)
  })
})

describe('categories', () => {
  it('only admins can manage categories', async () => {
    const message = await errorOf(
      as(db, alice, (tx) => tx.query(`insert into public.categories (slug, name) values ('games', 'بازی')`)),
    )
    expect(message).toMatch(/row-level security/)

    await as(db, admin, (tx) =>
      tx.query(`insert into public.categories (slug, name, is_active) values ('games', 'بازی', false)`),
    )
    const publicRows = await as(db, ANON, async (tx) => (await tx.query(`select 1 from public.categories where slug = 'games'`)).rows)
    expect(publicRows).toHaveLength(0)
    const adminRows = await as(db, admin, async (tx) => (await tx.query(`select 1 from public.categories where slug = 'games'`)).rows)
    expect(adminRows).toHaveLength(1)
  })

  it('refuses submissions into inactive categories', async () => {
    const { rows } = await db.query<{ id: string }>(`select id from public.categories where slug = 'games'`)
    const frank = await createUser(db, 'frank@shekargah.test')
    expect(await errorOf(submit(frank, 'بازی مخفی', { category_id: rows[0]!.id }))).toMatch(/inactive_category/)
  })
})

describe('reports', () => {
  it('lets users report content once and only admins resolve it', async () => {
    const product = await publish('محصول گزارش‌شده')
    const report = await as(db, bob, async (tx) =>
      (await tx.query<Row>(`insert into public.reports (product_id, reason) values ($1, 'spam') returning *`, [product.id])).rows[0]!,
    )
    expect(report).toMatchObject({ reporter_id: bob.id, status: 'open' })

    expect(
      await errorOf(as(db, bob, (tx) => tx.query(`insert into public.reports (product_id, reason) values ($1, 'spam')`, [product.id]))),
    ).toMatch(/duplicate key/)

    const seenByAlice = await as(db, alice, async (tx) => (await tx.query(`select 1 from public.reports where id = $1`, [report.id])).rows)
    expect(seenByAlice).toHaveLength(0)

    expect(
      await errorOf(as(db, bob, (tx) => tx.query(`select public.resolve_report($1, 'resolved')`, [report.id]))),
    ).toMatch(/not_authorized/)

    const resolved = await as(db, admin, async (tx) =>
      (await tx.query<Row>(`select * from public.resolve_report($1, 'resolved')`, [report.id])).rows[0]!,
    )
    expect(resolved).toMatchObject({ status: 'resolved', resolved_by: admin.id })
  })
})

describe('feed listing', () => {
  it('returns only published products, supports search, category filter and bounded pages', async () => {
    await publish('ویرایشگر کد سبز')
    await submit(alice, 'ویرایشگر کد پنهان')

    const rows = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select name, total_count from public.list_products('ویرایشگر', null, 'newest', 20, 0)`)).rows,
    )
    expect(rows.map((r) => r.name)).toEqual(['ویرایشگر کد سبز'])

    const arabicYeh = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select name from public.list_products('ويرايشگر', null, 'newest', 20, 0)`)).rows,
    )
    expect(arabicYeh).toHaveLength(1)

    const otherCategory = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select name from public.list_products('ویرایشگر', 'mobile-apps', 'newest', 20, 0)`)).rows,
    )
    expect(otherCategory).toHaveLength(0)

    const page = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select name from public.list_products(null, null, 'popular', 10000, 0)`)).rows,
    )
    expect(page.length).toBeLessThanOrEqual(50)
  })

  it('treats LIKE wildcards in search as plain text', async () => {
    const rows = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select name from public.list_products('%', null, 'newest', 20, 0)`)).rows,
    )
    expect(rows).toHaveLength(0)
  })

  it('orders by votes for the popular sort', async () => {
    const rows = await as(db, ANON, async (tx) =>
      (await tx.query<{ votes_count: number }>(`select votes_count from public.list_products(null, null, 'popular', 50, 0)`)).rows,
    )
    const counts = rows.map((r) => r.votes_count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })
})

describe('engagement: tags, saves, views and rankings', () => {
  it('seeds public tags and lets anon read product tags but not write them', async () => {
    const { rows: tags } = await as(db, ANON, (tx) => tx.query<Row>(`select slug, name from public.tags order by slug`))
    expect(tags.length).toBeGreaterThanOrEqual(20)
    expect(tags.map((t) => t.slug)).toContain('open-source')

    const { rows: productTags } = await as(db, ANON, (tx) => tx.query<Row>(`select * from public.product_tags`))
    expect(productTags).toBeDefined()

    expect(
      await errorOf(as(db, alice, (tx) => tx.query(`insert into public.tags (slug, name) values ('hack', 'هک')`))),
    ).toMatch(/row-level security|permission denied/)
  })

  it('lets makers tag their own pending products only through the RPC', async () => {
    const maker = await createUser(db, 'tagger@shekargah.test', 'برچسب‌ساز')
    const product = await submit(maker, 'محصول برچسب‌دار')
    await as(db, maker, (tx) => tx.query(`select public.set_product_tags($1, $2)`, [product.id, ['open-source', 'persian']]))
    const { rows } = await db.query<Row>(
      `select t.slug from public.product_tags pt join public.tags t on t.id = pt.tag_id where pt.product_id = $1 order by t.slug`,
      [product.id],
    )
    expect(rows.map((r) => r.slug)).toEqual(['open-source', 'persian'])
  })

  it('blocks tag edits on other users products and caps the count', async () => {
    const maker = await createUser(db, 'tagger2@shekargah.test', 'برچسب‌ساز دو')
    const product = await submit(maker, 'برچسب محدود')
    expect(await errorOf(as(db, bob, (tx) => tx.query(`select public.set_product_tags($1, $2)`, [product.id, ['ai']])))).toMatch(
      /not_authorized/,
    )
    expect(
      await errorOf(
        as(db, maker, (tx) => tx.query(`select public.set_product_tags($1, $2)`, [product.id, ['a', 'b', 'c', 'd', 'e', 'f']])),
      ),
    ).toMatch(/too_many_tags/)
  })

  it('lets users save published products privately and only once', async () => {
    const maker = await createUser(db, 'saver-maker@shekargah.test', 'سازنده ذخیره')
    const product = await publish('محصول ذخیره‌شده', maker)
    await as(db, bob, (tx) => tx.query(`insert into public.saved_products (product_id) values ($1)`, [product.id]))
    expect(
      await errorOf(as(db, bob, (tx) => tx.query(`insert into public.saved_products (product_id) values ($1)`, [product.id]))),
    ).toMatch(/saved_products_unique|duplicate key/)

    const seenByAlice = await as(db, alice, (tx) =>
      tx.query<Row>(`select 1 from public.saved_products where product_id = $1`, [product.id]),
    )
    expect(seenByAlice.affectedRows ?? seenByAlice.rows.length).toBe(0)

    const pending = await submit(maker, 'ذخیره پنهان')
    expect(
      await errorOf(as(db, alice, (tx) => tx.query(`insert into public.saved_products (product_id) values ($1)`, [pending.id]))),
    ).toMatch(/row-level security/)
  })

  it('deduplicates product views per viewer for twenty four hours', async () => {
    const maker = await createUser(db, 'views@shekargah.test', 'بیننده')
    const product = await publish('محصول بازدید', maker)
    const call = (actor: Actor, key: string) =>
      as(db, actor, (tx) => tx.query(`select public.record_product_view($1, $2)`, [product.id, key]))

    await call(ANON, 'viewer-1')
    await call(ANON, 'viewer-1')
    await call(bob, 'viewer-2')

    const { rows } = await db.query<{ views_count: number }>(`select views_count from public.products where id = $1`, [product.id])
    expect(rows[0]!.views_count).toBe(2)

    const pending = await submit(maker, 'بازدید پنهان')
    expect(
      await errorOf(as(db, ANON, (tx) => tx.query(`select public.record_product_view($1, $2)`, [pending.id, 'x']))),
    ).toMatch(/product_not_found/)
  })

  it('ranks leaderboard by window votes and daily by published date', async () => {
    const maker = await createUser(db, 'leader@shekargah.test', 'سازنده برتر')
    const first = await publish('ردیف برتر', maker)
    const second = await publish('ردیف دوم', maker)
    await as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [first.id]))
    await as(db, bob, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [first.id]))
    await as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [second.id]))

    const board = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select id, score, rank from public.list_leaderboard('daily', 10, 0)`)).rows,
    )
    expect(board[0]).toMatchObject({ id: first.id, rank: 1 })
    expect(Number(board[0]!.score)).toBe(2)

    const today = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select id from public.list_daily_products(null, 50, 0)`)).rows,
    )
    expect(today.some((row) => row.id === first.id)).toBe(true)
  })

  it('orders trending by recent engagement and hides private votes', async () => {
    const maker = await createUser(db, 'trend@shekargah.test', 'سازنده ترند')
    const quiet = await publish('ساکت', maker)
    const hot = await publish('داغ', maker)
    await as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [quiet.id]))
    await as(db, alice, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [hot.id]))
    await as(db, bob, (tx) => tx.query(`insert into public.votes (product_id) values ($1)`, [hot.id]))
    await as(db, alice, (tx) => tx.query(`insert into public.comments (product_id, body) values ($1, 'کامنت')`, [hot.id]))

    const rows = await as(db, ANON, async (tx) =>
      (await tx.query<Row>(`select id, score, rank from public.list_trending(10, 0)`)).rows,
    )
    expect(rows[0]).toMatchObject({ id: hot.id, rank: 1 })
    expect(Number(rows[0]!.score)).toBeGreaterThanOrEqual(7)
  })
})

describe('storage', () => {
  const upload = (actor: Actor, bucket: string, name: string) =>
    as(db, actor, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]))

  it('creates size- and type-limited public buckets', async () => {
    const { rows } = await db.query<Row>(`select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id`)
    expect(rows).toEqual([
      { id: 'avatars', public: true, file_size_limit: 524288, allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'] },
      { id: 'product-logos', public: true, file_size_limit: 1048576, allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'] },
    ])
  })

  it('lets users upload only into their own folder and only raster images', async () => {
    await upload(alice, 'product-logos', `${alice.id}/logo.png`)
    expect(await errorOf(upload(alice, 'product-logos', `${bob.id}/logo.png`))).toMatch(/row-level security/)
    expect(await errorOf(upload(alice, 'product-logos', `${alice.id}/logo.svg`))).toMatch(/row-level security/)
    expect(await errorOf(upload(ANON, 'product-logos', `anon/logo.png`))).toMatch(/row-level security/)
  })
})

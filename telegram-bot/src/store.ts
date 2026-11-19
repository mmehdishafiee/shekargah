/** لایه‌ی دیتابیس روی Cloudflare D1 (SQLite مدیریت‌شده). */

import type { D1DatabaseLike } from "./types.ts";

export type AnnouncementSource = "auto" | "manual";
export type AnnouncementStatus = "posted" | "scheduled" | "skipped";

export interface Announcement {
  id: number;
  product_id: string;
  product_slug: string;
  product_name: string;
  source: AnnouncementSource;
  status: AnnouncementStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  message_id: number | null;
  post_count: number;
  created_at: string;
}

export type PostKind = "text" | "photo" | "video" | "document" | "audio" | "animation";

export interface ChannelPostButton {
  text: string;
  url: string;
}

export interface ChannelPost {
  id: number;
  kind: PostKind;
  content: string | null;
  file_id: string | null;
  caption: string | null;
  buttons: ChannelPostButton[];
  status: "posted" | "scheduled";
  scheduled_at: string | null;
  posted_at: string | null;
  post_count: number;
}

export interface OverallStats {
  users: number;
  linked: number;
  subscribers: number;
  announcements: number;
  scheduled: number;
  channelPosts: number;
  productViews: number;
}

interface ChannelPostRow {
  id: number;
  kind: string;
  content: string | null;
  file_id: string | null;
  caption: string | null;
  buttons: string;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  post_count: number;
}

const CHANNEL_POST_COLUMNS =
  "id, kind, content, file_id, caption, buttons, status, scheduled_at, posted_at, post_count";

const ANNOUNCEMENT_COLUMNS =
  "id, product_id, product_slug, product_name, source, status, " +
  "scheduled_at, posted_at, message_id, post_count, created_at";

/** دسترسی به داده‌ها. همه‌ی کوئری‌ها پارامتری‌اند (جلوگیری از SQL injection). */
export class Store {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  // ---------- کاربران ----------

  async saveUser(
    userId: number,
    username: string | null,
    firstName: string | null,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO users (user_id, username, first_name)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
             username    = excluded.username,
             first_name  = excluded.first_name,
             blocked_at  = NULL`,
      )
      .bind(userId, username, firstName)
      .run();
  }

  async usersCount(): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS c FROM users")
      .first<{ c: number }>();
    return row ? Number(row.c) : 0;
  }

  /** وضعیت اشتراک اعلان محصولات تازه در چت خصوصی. */
  async setWantsNewProducts(userId: number, wants: boolean): Promise<void> {
    await this.db
      .prepare("UPDATE users SET wants_new_products = ? WHERE user_id = ?")
      .bind(wants ? 1 : 0, userId)
      .run();
  }

  async wantsNewProducts(userId: number): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT wants_new_products AS w FROM users WHERE user_id = ?")
      .bind(userId)
      .first<{ w: number }>();
    return Number(row?.w ?? 0) === 1;
  }

  async markBlocked(userId: number): Promise<void> {
    await this.db
      .prepare("UPDATE users SET blocked_at = datetime('now') WHERE user_id = ?")
      .bind(userId)
      .run();
  }

  /** مشترکان اعلان‌ها (کاربرانی که ربات را بلاک نکرده‌اند). */
  async listSubscribers(limit = 200, offset = 0): Promise<number[]> {
    const result = await this.db
      .prepare(
        `SELECT user_id FROM users
         WHERE wants_new_products = 1 AND blocked_at IS NULL
         ORDER BY joined_at ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all<{ user_id: number }>();

    return (result.results ?? []).map((row) => Number(row.user_id));
  }

  async subscribersCount(): Promise<number> {
    const row = await this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM users WHERE wants_new_products = 1 AND blocked_at IS NULL",
      )
      .first<{ c: number }>();
    return row ? Number(row.c) : 0;
  }

  // ---------- اتصال تلگرام ↔ شکارگاه ----------

  async getLinkedUserId(telegramId: number): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT supabase_user_id AS id FROM telegram_users WHERE telegram_id = ?")
      .bind(telegramId)
      .first<{ id: string }>();
    return row?.id ?? null;
  }

  async saveLinkedUser(
    telegramId: number,
    supabaseUserId: string,
    email: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO telegram_users (telegram_id, supabase_user_id, email)
         VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET
             supabase_user_id = excluded.supabase_user_id,
             email            = excluded.email`,
      )
      .bind(telegramId, supabaseUserId, email)
      .run();
  }

  async linkedCount(): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS c FROM telegram_users")
      .first<{ c: number }>();
    return row ? Number(row.c) : 0;
  }

  // ---------- کدهای ورود یک‌بارمصرف ----------

  async createLoginCode(
    codeHash: string,
    telegramId: number,
    expiresAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO login_codes (code_hash, telegram_id, expires_at) VALUES (?, ?, ?)",
      )
      .bind(codeHash, telegramId, expiresAt)
      .run();
  }

  /**
   * کد را مصرف می‌کند.
   * @returns شناسه‌ی تلگرام صاحب کد، یا `null` اگر کد نامعتبر/منقضی/مصرف‌شده باشد.
   */
  async consumeLoginCode(codeHash: string, nowIso: string): Promise<number | null> {
    const row = await this.db
      .prepare(
        `SELECT telegram_id AS id FROM login_codes
         WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .bind(codeHash, nowIso)
      .first<{ id: number }>();

    if (!row) return null;

    await this.db
      .prepare("UPDATE login_codes SET used_at = datetime('now') WHERE code_hash = ?")
      .bind(codeHash)
      .run();

    return Number(row.id);
  }

  async deleteExpiredLoginCodes(): Promise<void> {
    await this.db
      .prepare("DELETE FROM login_codes WHERE expires_at < datetime('now')")
      .run();
  }

  // ---------- وضعیت سراسری ----------

  async getState(key: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT value FROM bot_state WHERE key = ?")
      .bind(key)
      .first<{ value: string }>();
    return row?.value ?? null;
  }

  async setState(key: string, value: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO bot_state (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
             value      = excluded.value,
             updated_at = excluded.updated_at`,
      )
      .bind(key, value)
      .run();
  }

  // ---------- معرفی محصولات ----------

  async hasAnnouncement(productId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 AS ok FROM announcements WHERE product_id = ? LIMIT 1")
      .bind(productId)
      .first<{ ok: number }>();
    return Boolean(row);
  }

  async addAnnouncement(input: {
    productId: string;
    productSlug: string;
    productName: string;
    source: AnnouncementSource;
    status: AnnouncementStatus;
    scheduledAt?: string | null;
  }): Promise<number> {
    const result = await this.db
      .prepare(
        `INSERT INTO announcements
             (product_id, product_slug, product_name, source, status, scheduled_at, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.productId,
        input.productSlug,
        input.productName,
        input.source,
        input.status,
        input.scheduledAt ?? null,
        input.status === "posted" ? new Date().toISOString() : null,
      )
      .run();

    return Number(result.meta?.last_row_id ?? 0);
  }

  async markAnnouncementPosted(
    id: number,
    messageId: number | null,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE announcements SET
             status     = 'posted',
             posted_at  = datetime('now'),
             message_id = COALESCE(?, message_id),
             post_count = post_count + 1
         WHERE id = ?`,
      )
      .bind(messageId, id)
      .run();
  }

  async listDueAnnouncements(nowIso: string, limit = 10): Promise<Announcement[]> {
    const result = await this.db
      .prepare(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements
         WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
         ORDER BY scheduled_at ASC LIMIT ?`,
      )
      .bind(nowIso, limit)
      .all<Announcement>();
    return result.results ?? [];
  }

  async listScheduledAnnouncements(): Promise<Announcement[]> {
    const result = await this.db
      .prepare(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements
         WHERE status = 'scheduled' ORDER BY scheduled_at ASC`,
      )
      .all<Announcement>();
    return result.results ?? [];
  }

  async listRecentAnnouncements(limit = 5): Promise<Announcement[]> {
    const result = await this.db
      .prepare(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements ORDER BY id DESC LIMIT ?`,
      )
      .bind(limit)
      .all<Announcement>();
    return result.results ?? [];
  }

  async getAnnouncement(id: number): Promise<Announcement | null> {
    return this.db
      .prepare(`SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements WHERE id = ?`)
      .bind(id)
      .first<Announcement>();
  }

  async cancelAnnouncementSchedule(id: number): Promise<void> {
    await this.db
      .prepare(
        "UPDATE announcements SET scheduled_at = NULL WHERE id = ? AND status = 'scheduled'",
      )
      .bind(id)
      .run();
    await this.db
      .prepare("DELETE FROM announcements WHERE id = ? AND status = 'scheduled' AND scheduled_at IS NULL")
      .bind(id)
      .run();
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM announcements WHERE id = ?")
      .bind(id)
      .run();
    return Number(result.meta?.changes ?? 0) > 0;
  }

  // ---------- پست‌های عادی کانال ----------

  async addChannelPost(
    payload: {
      kind: PostKind;
      content: string | null;
      fileId: string | null;
      caption: string | null;
    },
    buttons: ChannelPostButton[],
    options: { scheduledAt?: string | null } = {},
  ): Promise<number> {
    const scheduledAt = options.scheduledAt ?? null;
    const status = scheduledAt ? "scheduled" : "posted";

    const result = await this.db
      .prepare(
        `INSERT INTO channel_posts (kind, content, file_id, caption, buttons, status, scheduled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        payload.kind,
        payload.content,
        payload.fileId,
        payload.caption,
        JSON.stringify(buttons),
        status,
        scheduledAt,
      )
      .run();

    return Number(result.meta?.last_row_id ?? 0);
  }

  async getChannelPost(postId: number): Promise<ChannelPost | null> {
    const row = await this.db
      .prepare(`SELECT ${CHANNEL_POST_COLUMNS} FROM channel_posts WHERE id = ?`)
      .bind(postId)
      .first<ChannelPostRow>();

    return row ? toChannelPost(row) : null;
  }

  async listChannelPosts(limit = 5): Promise<ChannelPost[]> {
    const result = await this.db
      .prepare(
        `SELECT ${CHANNEL_POST_COLUMNS} FROM channel_posts ORDER BY id DESC LIMIT ?`,
      )
      .bind(limit)
      .all<ChannelPostRow>();

    return (result.results ?? []).map(toChannelPost);
  }

  async listDueChannelPosts(nowIso: string, limit = 10): Promise<ChannelPost[]> {
    const result = await this.db
      .prepare(
        `SELECT ${CHANNEL_POST_COLUMNS} FROM channel_posts
         WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
         ORDER BY scheduled_at ASC LIMIT ?`,
      )
      .bind(nowIso, limit)
      .all<ChannelPostRow>();

    return (result.results ?? []).map(toChannelPost);
  }

  async markChannelPostPosted(postId: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE channel_posts SET
             status     = 'posted',
             posted_at  = datetime('now'),
             post_count = post_count + 1
         WHERE id = ?`,
      )
      .bind(postId)
      .run();
  }

  async cancelChannelPostSchedule(postId: number): Promise<void> {
    await this.db
      .prepare("UPDATE channel_posts SET status = 'posted', scheduled_at = NULL WHERE id = ?")
      .bind(postId)
      .run();
  }

  async deleteChannelPost(postId: number): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM channel_posts WHERE id = ?")
      .bind(postId)
      .run();
    return Number(result.meta?.changes ?? 0) > 0;
  }

  // ---------- آمار ----------

  async recordProductView(productId: string, userId: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO product_views (product_id, user_id) VALUES (?, ?)")
      .bind(productId, userId)
      .run();
  }

  async overallStats(): Promise<OverallStats> {
    const row = await this.db
      .prepare(
        `SELECT
             (SELECT COUNT(*) FROM users)                                  AS users,
             (SELECT COUNT(*) FROM telegram_users)                         AS linked,
             (SELECT COUNT(*) FROM users
               WHERE wants_new_products = 1 AND blocked_at IS NULL)        AS subscribers,
             (SELECT COUNT(*) FROM announcements)                          AS announcements,
             (SELECT COUNT(*) FROM announcements WHERE status = 'scheduled') AS scheduled,
             (SELECT COUNT(*) FROM channel_posts)                          AS channelPosts,
             (SELECT COUNT(*) FROM product_views)                          AS productViews`,
      )
      .first<Record<string, number>>();

    return {
      users: Number(row?.users ?? 0),
      linked: Number(row?.linked ?? 0),
      subscribers: Number(row?.subscribers ?? 0),
      announcements: Number(row?.announcements ?? 0),
      scheduled: Number(row?.scheduled ?? 0),
      channelPosts: Number(row?.channelPosts ?? 0),
      productViews: Number(row?.productViews ?? 0),
    };
  }
}

function toChannelPost(row: ChannelPostRow): ChannelPost {
  let buttons: ChannelPostButton[] = [];

  try {
    const parsed = JSON.parse(row.buttons) as unknown;
    if (Array.isArray(parsed)) {
      buttons = parsed.filter(
        (item): item is ChannelPostButton =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ChannelPostButton).text === "string" &&
          typeof (item as ChannelPostButton).url === "string",
      );
    }
  } catch {
    buttons = [];
  }

  return {
    id: row.id,
    kind: row.kind as PostKind,
    content: row.content,
    file_id: row.file_id,
    caption: row.caption,
    buttons,
    status: (row.status as "posted" | "scheduled") ?? "posted",
    scheduled_at: row.scheduled_at,
    posted_at: row.posted_at,
    post_count: Number(row.post_count ?? 0),
  };
}
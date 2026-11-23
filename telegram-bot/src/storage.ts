/** وضعیت فرم‌ها و نشست پنل ادمین (ذخیره‌شده در D1). */

import type { StorageAdapter } from "grammy";
import type { D1DatabaseLike } from "./types.ts";

/** محتوای یک پست عادی کانال (متن یا مدیا). */
export interface DraftPayload {
  kind: "text" | "photo" | "video" | "document" | "audio" | "animation";
  content: string | null;
  fileId: string | null;
  caption: string | null;
}

export interface SessionData {
  // ---- پست عادی کانال ----
  channelStep?: "content" | "buttons" | "schedule";
  channelDraft?: DraftPayload;
  channelButtons?: { text: string; url: string }[];

  // ---- زمان‌بندی معرفی یک محصول ----
  schedulingProductId?: string;
  schedulingProductName?: string;

  // ---- زمان‌بندی پست عادی ----
  schedulingChannelPost?: number;

  // ---- افزودن تعداد محصول برای بک‌فیل ----
  backfillCount?: boolean;
}

/** آداپتور ذخیره‌ی نشست روی D1 (رابط StorageAdapter گرام‌جی). */
export class D1SessionStorage implements StorageAdapter<SessionData> {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async read(key: string): Promise<SessionData | undefined> {
    const row = await this.db
      .prepare("SELECT value FROM sessions WHERE key = ?")
      .bind(key)
      .first<{ value: string }>();

    if (!row) return undefined;

    try {
      return JSON.parse(row.value) as SessionData;
    } catch {
      // داده‌ی خراب → نشست را نادیده بگیر (بهتر از کرش‌کردن ربات)
      return undefined;
    }
  }

  async write(key: string, value: SessionData): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sessions (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
             value      = excluded.value,
             updated_at = excluded.updated_at`,
      )
      .bind(key, JSON.stringify(value))
      .run();
  }

  async delete(key: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE key = ?").bind(key).run();
  }
}
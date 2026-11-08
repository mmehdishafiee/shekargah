/**
 * ابزارهای تست: آداپتور D1 روی `node:sqlite` + fetch جعلی برای تلگرام و Supabase.
 * هیچ درخواست واقعی شبکه‌ای زده نمی‌شود.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type {
  D1DatabaseLike,
  D1PreparedStatement,
  D1Result,
} from "../src/types.ts";

/** آداپتور حداقلی D1 روی دیتابیس درون‌حافظه‌ای node:sqlite. */
export function createTestDb(schemaPath = "./schema.sql"): D1DatabaseLike {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(schemaPath, "utf8"));

  return {
    prepare(query: string): D1PreparedStatement {
      const statement = db.prepare(query);
      let bound: unknown[] = [];

      const wrapper: D1PreparedStatement = {
        bind(...values: unknown[]) {
          bound = values;
          return wrapper;
        },
        async first<T>(colName?: string): Promise<T | null> {
          const row = statement.get(...(bound as never[])) as
            | Record<string, unknown>
            | undefined;
          if (!row) return null;
          return (colName ? row[colName] : row) as T;
        },
        async all<T>(): Promise<D1Result<T>> {
          const rows = statement.all(...(bound as never[])) as T[];
          return { results: rows, success: true };
        },
        async run<T>(): Promise<D1Result<T>> {
          const info = statement.run(...(bound as never[]));
          return {
            success: true,
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid),
            },
          };
        },
      };

      return wrapper;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
    async batch<T>(statements: D1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      for (const statement of statements) results.push(await statement.run<T>());
      return results;
    },
  };
}

// ---------- fetch جعلی ----------

export interface RecordedCall {
  method: string;
  body: Record<string, unknown>;
}

export interface FakeApi {
  fetch: typeof fetch;
  telegram: RecordedCall[];
  calls: { url: string; method: string }[];
}

export interface FakeOptions {
  products?: unknown[];
  categories?: unknown[];
  /** آیدی کاربرانی که عضو کانال نیستند (getChatMember → left). */
  nonMembers?: number[];
  /** پاسخ POST /auth/v1/token */
  onPasswordGrant?: () => { status: number; body: string };
}

/** fetch جعلی: تلگرام و Supabase را شبیه‌سازی می‌کند. */
export function createFakeFetch(options: FakeOptions = {}): FakeApi {
  const telegram: RecordedCall[] = [];
  const calls: { url: string; method: string }[] = [];

  const fake: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();
    const rawBody = typeof init?.body === "string" ? init.body : "{}";
    calls.push({ url, method });

    // ---- Telegram Bot API ----
    if (url.includes("api.telegram.org")) {
      const name = url.split("/").pop() ?? "";
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
      telegram.push({ method: name, body });

      if (name === "getMe") {
        return json({ ok: true, result: { id: 1, is_bot: true, username: "ShekargahBot", first_name: "شکارگاه" } });
      }
      if (name === "getChatMember") {
        const userId = Number(body.user_id ?? 0);
        const member = !(options.nonMembers ?? []).includes(userId);
        return json({ ok: true, result: { status: member ? "member" : "left" } });
      }
      return json({
        ok: true,
        result: { message_id: telegram.length, chat: { id: 1, type: "private" } },
      });
    }

    // ---- Supabase ----
    if (url.includes("/rest/v1/categories")) {
      return json(options.categories ?? []);
    }

    if (url.includes("/rest/v1/products")) {
      const products = options.products ?? [];

      // شمارش محصولات هر دسته (select=categories(slug))
      if (url.includes("select=categories(slug)")) {
        return json(
          products.map((product) => ({
            categories: (product as { categories?: unknown }).categories ?? null,
          })),
        );
      }

      // فیلتر دسته: categories.slug=eq.<slug>
      if (url.includes("categories.slug=eq.")) {
        const raw = url.split("categories.slug=eq.")[1] ?? "";
        const slug = decodeURIComponent(raw.split("&")[0] ?? "");
        return json(
          products.filter((product) => {
            const relation = (product as { categories?: unknown }).categories;
            const value = Array.isArray(relation)
              ? (relation[0] as { slug?: string } | undefined)?.slug
              : (relation as { slug?: string } | null | undefined)?.slug;
            return value === slug;
          }),
        );
      }

      if (url.includes("count=exact")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-range": `0-0/${products.length}` },
        });
      }

      return json(products);
    }

    if (url.includes("/auth/v1/admin/users")) {
      return json({ id: "11111111-1111-4111-8111-111111111111" });
    }

    if (url.includes("/auth/v1/token")) {
      const custom = options.onPasswordGrant?.();
      if (custom) return new Response(custom.body, { status: custom.status });
      return json({
        access_token: fakeJwt("11111111-1111-4111-8111-111111111111"),
        refresh_token: "refresh-token",
      });
    }

    return json({});
  };

  return { fetch: fake, telegram, calls };
}

/** JWT بدون امضا (فقط برای تست). */
export function fakeJwt(subject: string): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: subject, role: "authenticated" })}.sig`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** یک آپدیت تلگرام با دستور متنی. */
export function textUpdate(text: string, userId = 555) {
  // تلگرام دستورها را با entity از نوع bot_command می‌فرستد؛ grammY برای
  // تطبیق دستور به همین entity تکیه می‌کند.
  const commandLength = text.startsWith("/") ? (text.split(/\s/)[0] ?? text).length : 0;

  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      text,
      ...(commandLength > 0
        ? { entities: [{ type: "bot_command", offset: 0, length: commandLength }] }
        : {}),
      chat: { id: userId, type: "private" },
      from: { id: userId, is_bot: false, first_name: "آزمون", username: "tester" },
    },
  };
}

/** یک آپدیت کال‌بک دکمه. */
export function callbackUpdate(data: string, userId = 555) {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    callback_query: {
      id: String(Math.floor(Math.random() * 1_000_000)),
      from: { id: userId, is_bot: false, first_name: "آزمون" },
      chat_instance: "1",
      data,
      message: {
        message_id: 9,
        date: Math.floor(Date.now() / 1000),
        text: "پیام قبلی",
        chat: { id: userId, type: "private" },
      },
    },
  };
}

/** محیط پیش‌فرض برای ساخت ربات در تست. */
export function testEnv(db: D1DatabaseLike) {
  return {
    DB: db,
    BOT_TOKEN: "123456:TEST-TOKEN",
    WEBHOOK_SECRET: "test-secret",
    BOT_USERNAME: "ShekargahBot",
    CHANNEL_ID: "@shekargah",
    CHANNEL_URL: "https://t.me/shekargah",
    SITE_URL: "https://shekargah.mmehdi.ir",
    ADMIN_IDS: "555",
    REQUIRE_JOIN: "0",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_test",
    SUPABASE_SERVICE_KEY: "service-key",
    AUTH_SECRET: "test-auth-secret",
  };
}
/**
 * نقطه‌ی ورود Worker.
 *
 * مسیرها:
 *   GET  /health          → سلامت سرویس (بدون نیاز به توکن ربات)
 *   POST /                → آپدیت‌های تلگرام (webhook)
 *   POST /auth/exchange   → تبدیل کد یک‌بارمصرف ربات به نشست Supabase
 *   POST /auth/miniapp    → ورود مینی‌اپ با initData (پایه‌ی مینی‌اپ آینده)
 *   scheduled             → کرون: انتشار زمان‌بندی‌شده‌ها + معرفی محصول تازه
 */

import { webhookCallback } from "grammy";

import { consumeLoginCode, signInTelegramUser, verifyInitData } from "./auth.ts";
import { createDeps } from "./bot.ts";
import type { BotDeps } from "./bot.ts";
import { describeError, log } from "./log.ts";
import { announceNewProducts, publishDue } from "./schedule.ts";
import type { Env, ExecutionContextLike } from "./types.ts";

const SERVICE = "shekargah-bot";

/** آپدیت‌هایی که به این ربات مربوط‌اند */
export const ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "my_chat_member"] as const;

export type DepsProvider = (env: Env) => Promise<BotDeps> | BotDeps;
type WebhookHandler = (request: Request) => Promise<Response>;

export interface ScheduledEventLike {
  scheduledTime: number;
  cron: string;
}

/**
 * مبدأهای مجاز برای CORS.
 *
 * `SITE_URL` (دامنهٔ فعلی سایت) همیشه مجاز است، به‌علاوهٔ دامنهٔ pages.dev پروژه
 * و هر چیزی که در `ALLOWED_ORIGINS` آمده باشد. با این کار تغییر دامنهٔ سایت
 * فقط به‌روزرسانی `SITE_URL` در wrangler.toml لازم دارد.
 */
function allowedOrigins(env: Env): string[] {
  const normalize = (value: string) => value.trim().replace(/\/+$/, "");
  const site = normalize(env.SITE_URL ?? "");
  const extra = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(normalize)
    .filter(Boolean);

  return [...new Set([site, "https://shekargah.pages.dev", ...extra].filter(Boolean))];
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allow = allowedOrigins(env);
  const allowed =
    origin && (allow.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))
      ? origin
      : allow[0];

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = allowed;
  return headers;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export function makeWorker(depsFor: DepsProvider) {
  // در Workers ایزوله بین درخواست‌ها بازاستفاده می‌شود؛ ربات و هندلر یک‌بار
  // ساخته و کش می‌شوند (شامل getMe که فقط یک‌بار صدا زده می‌شود).
  let cached: BotDeps | null = null;
  let cachedHandler: WebhookHandler | null = null;

  async function prepare(env: Env): Promise<BotDeps> {
    if (!cached) {
      const deps = await depsFor(env);
      await deps.bot.init();
      cached = deps;
    }
    return cached;
  }

  async function webhook(env: Env): Promise<WebhookHandler> {
    const deps = await prepare(env);

    if (!cachedHandler) {
      const secretToken = (env.WEBHOOK_SECRET ?? "").trim();
      cachedHandler = webhookCallback(deps.bot, "cloudflare-mod", {
        secretToken: secretToken || undefined,
        onTimeout: "throw",
      });
    }

    return cachedHandler;
  }

  /** تبدیل کد ورود به توکن‌های Supabase. */
  async function exchange(env: Env, request: Request): Promise<Response> {
    const headers = corsHeaders(env, request.headers.get("origin"));

    let payload: { code?: string };
    try {
      payload = (await request.json()) as { code?: string };
    } catch {
      return json({ error: "invalid_body" }, 400, headers);
    }

    const code = (payload.code ?? "").trim();
    if (!code) return json({ error: "missing_code" }, 400, headers);

    const deps = await prepare(env);
    const telegramId = await consumeLoginCode(deps.store, code);

    if (telegramId === null) {
      return json({ error: "invalid_code" }, 400, headers);
    }

    try {
      const tokens = await signInTelegramUser(deps.config, deps.store, deps.site, {
        id: telegramId,
        firstName: null,
      });

      return json(
        {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          user_id: tokens.supabaseUserId,
        },
        200,
        headers,
      );
    } catch (error) {
      log.error("تبدیل کد ورود شکست خورد", describeError(error));
      return json({ error: "login_failed" }, 502, headers);
    }
  }

  /** ورود مینی‌اپ تلگرام (پایه‌ی مینی‌اپ آینده). */
  async function miniapp(env: Env, request: Request): Promise<Response> {
    const headers = corsHeaders(env, request.headers.get("origin"));

    let payload: { initData?: string };
    try {
      payload = (await request.json()) as { initData?: string };
    } catch {
      return json({ error: "invalid_body" }, 400, headers);
    }

    const deps = await prepare(env);
    const initData = payload.initData ?? "";
    if (!initData) return json({ error: "missing_init_data" }, 400, headers);

    const user = await verifyInitData(deps.config.botToken, initData);
    if (!user) return json({ error: "invalid_init_data" }, 401, headers);

    try {
      const tokens = await signInTelegramUser(deps.config, deps.store, deps.site, {
        id: user.id,
        firstName: user.firstName,
      });

      return json(
        {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          user_id: tokens.supabaseUserId,
        },
        200,
        headers,
      );
    } catch (error) {
      log.error("ورود مینی‌اپ شکست خورد", describeError(error));
      return json({ error: "login_failed" }, 502, headers);
    }
  }

  return {
    async fetch(
      request: Request,
      env: Env,
      _ctx: ExecutionContextLike,
    ): Promise<Response> {
      const url = new URL(request.url);

      // سلامت — پیش از هر چیز و بدون init ربات
      if (url.pathname === "/health") {
        return json({ status: "ok", service: SERVICE });
      }

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("origin")) });
      }

      if (request.method === "POST" && url.pathname === "/auth/exchange") {
        return exchange(env, request);
      }

      if (request.method === "POST" && url.pathname === "/auth/miniapp") {
        return miniapp(env, request);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return new Response("🤖 ربات شکارگاه در حال اجراست.", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      try {
        const handler = await webhook(env);
        return await handler(request);
      } catch (error) {
        log.error("پردازش آپدیت شکست خورد", describeError(error));
        // ۵۰۰ برمی‌گردانیم تا تلگرام همان آپدیت را دوباره بفرستد.
        return new Response("internal error", { status: 500 });
      }
    },

    /** کرون: زمان‌بندی‌ها + بررسی محصول تازه. */
    async scheduled(
      _event: ScheduledEventLike,
      env: Env,
      _ctx: ExecutionContextLike,
    ): Promise<void> {
      try {
        const deps = await prepare(env);

        const due = await publishDue(deps.bot.api, deps.store, deps.config, deps.site);
        if (due.published > 0 || due.failed > 0) {
          log.info(`کرون: ${due.published} منتشر شد، ${due.failed} شکست خورد.`);
        }

        const fresh = await announceNewProducts(
          deps.bot.api,
          deps.store,
          deps.config,
          deps.site,
        );
        if (fresh.announced > 0 || fresh.failed > 0) {
          log.info(
            `کرون: ${fresh.announced} محصول تازه معرفی شد، ${fresh.failed} شکست خورد، ${fresh.skipped} تکراری.`,
          );
        }

        await deps.store.deleteExpiredLoginCodes();
      } catch (error) {
        log.error("اجرای کرون شکست خورد", describeError(error));
      }
    },
  };
}

export default makeWorker((env) => createDeps(env));
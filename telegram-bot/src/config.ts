/** خواندن و اعتبارسنجی تنظیمات از متغیرهای محیطی ورکر. */

import type { Env } from "./types.ts";

export interface Config {
  botToken: string;
  botUsername: string;
  channelId: string;
  channelUrl: string;
  /** هندل کانال که به انتهای پست‌ها اضافه می‌شود، مثل `@shekargah` */
  channelHandle: string;
  /** آدرس سایت شکارگاه */
  siteUrl: string;
  adminIds: Set<number>;
  webhookSecret: string;

  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  authSecret: string;

  /** آیا پیش از استفاده از ربات، عضویت در کانال اجباری است؟ */
  requireJoin: boolean;
  announceIntervalMinutes: number;
}

/** توکن‌هایی که یعنی کاربر هنوز مقدار واقعی را نگذاشته */
const PLACEHOLDER_TOKENS = new Set([
  "",
  "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
]);

/**
 * آیدی ادمین‌ها را از رشته‌ای مثل "111,222;333" به مجموعه‌ی عددی تبدیل می‌کند.
 * مقادیر نامعتبر بی‌صدا رد می‌شوند.
 */
export function parseAdminIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  if (!raw) return ids;

  for (const chunk of raw.replace(/;/g, ",").split(",")) {
    const value = chunk.trim();
    if (/^-?\d+$/.test(value)) ids.add(Number(value));
  }
  return ids;
}

/** آیا رشته یک قاعده‌ی درست (boolean-ish) است؟ */
function parseFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

/** اطمینان از اینکه آدرس یک URL معتبر است. */
function normalizeUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim() || fallback;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** هندل کانال برای فوتر پست‌ها. */
function channelHandleOf(channelId: string, channelUrl: string): string {
  if (channelId.startsWith("@")) return channelId;

  const tail = channelUrl.replace(/\/+$/, "").split("/").pop() ?? "";
  const handle = tail.replace(/^@/, "");
  return handle ? `@${handle}` : "@shekargah";
}

export function loadConfig(env: Env): Config {
  const botToken = (env.BOT_TOKEN ?? "").trim();
  if (PLACEHOLDER_TOKENS.has(botToken)) {
    throw new Error(
      "BOT_TOKEN تنظیم نشده است. مقدار آن را با «wrangler secret put BOT_TOKEN» ست کن.",
    );
  }

  const channelId = (env.CHANNEL_ID ?? "@shekargah").trim();
  const channelUrl = normalizeUrl(env.CHANNEL_URL, "https://t.me/shekargah");

  const interval = Number(env.ANNOUNCE_INTERVAL_MINUTES ?? 5);

  return {
    botToken,
    botUsername: (env.BOT_USERNAME ?? "ShekargahBot").trim().replace(/^@/, ""),
    channelId,
    channelUrl,
    channelHandle: channelHandleOf(channelId, channelUrl),
    siteUrl: normalizeUrl(env.SITE_URL, "https://shekargaah.ir").replace(/\/+$/, ""),
    adminIds: parseAdminIds(env.ADMIN_IDS),
    webhookSecret: (env.WEBHOOK_SECRET ?? "").trim(),
    supabaseUrl: normalizeUrl(env.SUPABASE_URL, "").replace(/\/+$/, ""),
    supabaseAnonKey: (env.SUPABASE_ANON_KEY ?? "").trim(),
    supabaseServiceKey: (env.SUPABASE_SERVICE_KEY ?? "").trim(),
    authSecret: (env.AUTH_SECRET ?? "").trim(),
    requireJoin: parseFlag(env.REQUIRE_JOIN, true),
    announceIntervalMinutes:
      Number.isFinite(interval) && interval > 0 ? interval : 5,
  };
}
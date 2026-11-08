/**
 * ورود به سایت با تلگرام.
 *
 * جریان کار:
 *   1. کاربر در ربات «🔐 ورود به سایت» را می‌زند.
 *   2. ورکر یک کد یکبارمصرف می‌سازد و لینک `SITE/login/telegram?code=…` را می‌دهد.
 *   3. سایت کد را به `POST /auth/exchange` می‌فرستد و توکن‌های Supabase را می‌گیرد.
 *
 * حساب Supabase هر کاربر تلگرام یک ایمیل داخلی (`tg<id>@…`) و رمزی دارد که از
 * روی `AUTH_SECRET` مشتق می‌شود؛ بنابراین هیچ رمزی ذخیره نمی‌شود.
 */

import type { Config } from "./config.ts";
import { log } from "./log.ts";
import type { SiteClient } from "./site.ts";
import type { Store } from "./store.ts";

const LOGIN_CODE_TTL_MS = 10 * 60_000;

/** کد تصادفی URL-safe. */
export function randomCode(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** رمز حساب تلگرامی؛ قطعی و بدون ذخیره‌سازی. */
export async function derivePassword(authSecret: string, telegramId: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`shekargah:telegram:${telegramId}`),
  );
  return base64Url(new Uint8Array(signature));
}

export function telegramEmail(telegramId: number): string {
  return `tg${telegramId}@telegram.shekargah.ir`;
}

/** نام نمایشی از روی پروفایل تلگرام. */
export function displayNameOf(firstName: string | null, lastName?: string | null): string {
  const value = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (value.length < 2) return "کاربر شکارگاه";
  return value.slice(0, 50);
}

export interface TelegramUser {
  id: number;
  firstName: string | null;
  lastName?: string | null;
  username?: string | null;
}

/** کد یکبارمصرف می‌سازد و لینک ورود را برمی‌گرداند. */
export async function createLoginLink(
  config: Config,
  store: Store,
  site: SiteClient,
  user: TelegramUser,
): Promise<string> {
  // حساب Supabase را همین‌جا می‌سازیم تا اگر مشکلی هست، کاربر در ربات
  // پیام خطا بگیرد نه در سایت.
  await ensureTelegramAccount(config, store, site, user);

  const code = randomCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS).toISOString();

  await store.createLoginCode(codeHash, user.id, expiresAt);

  return `${config.siteUrl}/login/telegram?code=${encodeURIComponent(code)}`;
}

/**
 * حساب Supabase کاربر تلگرام را (اگر نبود) می‌سازد و شناسه‌اش را برمی‌گرداند.
 */
export async function ensureTelegramAccount(
  config: Config,
  store: Store,
  site: SiteClient,
  user: TelegramUser,
): Promise<string> {
  const existing = await store.getLinkedUserId(user.id);
  if (existing) return existing;

  const email = telegramEmail(user.id);
  const password = await derivePassword(config.authSecret, user.id);

  const created = await site.createAuthUser({
    email,
    password,
    displayName: displayNameOf(user.firstName, user.lastName),
  });

  if (created) {
    await store.saveLinkedUser(user.id, created, email);
    return created;
  }

  // حساب از قبل در Supabase هست ولی اتصالش را نداریم؛ با ورود، شناسه را پیدا می‌کنیم.
  const tokens = await site.passwordGrant(email, password);
  const userId = tokens ? jwtSubject(tokens.accessToken) : null;

  if (userId) {
    await store.saveLinkedUser(user.id, userId, email);
    return userId;
  }

  throw new Error("account_exists_unlinked");
}

/** کد را مصرف می‌کند و شناسه‌ی تلگرام را برمی‌گرداند (یا null). */
export async function consumeLoginCode(
  store: Store,
  code: string,
): Promise<number | null> {
  const codeHash = await sha256Hex(code.trim());
  return store.consumeLoginCode(codeHash, new Date().toISOString());
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  supabaseUserId: string;
}

/** شناسه‌ی کاربر را از payload توکن JWT می‌خواند (بدون اعتبارسنجی امضا). */
export function jwtSubject(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;

  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * حساب Supabase کاربر تلگرام را تضمین می‌کند و یک نشست تازه می‌سازد.
 */
export async function signInTelegramUser(
  config: Config,
  store: Store,
  site: SiteClient,
  user: TelegramUser,
): Promise<SessionTokens> {
  const email = telegramEmail(user.id);
  const password = await derivePassword(config.authSecret, user.id);

  let userId: string | null = await store.getLinkedUserId(user.id);

  if (!userId) {
    const created = await site.createAuthUser({
      email,
      password,
      displayName: displayNameOf(user.firstName, user.lastName),
    });

    if (created) {
      userId = created;
      await store.saveLinkedUser(user.id, created, email);
    }
  }

  let tokens = await site.passwordGrant(email, password);

  // رمز جواب نداد (مثلاً AUTH_SECRET عوض شده): رمز را بازنشانی می‌کنیم.
  if (!tokens && userId) {
    await site.resetPassword(userId, password);
    tokens = await site.passwordGrant(email, password);
  }

  if (tokens && !userId) {
    // حساب از قبل بود ولی اتصالش را نداشتیم؛ شناسه را از توکن می‌خوانیم.
    userId = jwtSubject(tokens.accessToken);
    if (userId) await store.saveLinkedUser(user.id, userId, email);
  }

  if (!tokens || !userId) {
    log.error("ورود تلگرامی شکست خورد", { telegramId: user.id, hasUserId: Boolean(userId) });
    throw new Error("login_failed");
  }

  return { ...tokens, supabaseUserId: userId };
}

/**
 * اعتبارسنجی `initData` مینی‌اپ تلگرام.
 *
 * پایه‌ی مینی‌اپ آینده: هر زمان صفحه‌ی مینی‌اپ ساخته شد، با همین تابع
 * می‌شود بدون رمز داخل سایت شد.
 */
export async function verifyInitData(
  botToken: string,
  initData: string,
): Promise<{ id: number; firstName: string | null; username: string | null } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, new TextEncoder().encode(botToken));

  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataCheckString),
  );
  const expected = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== hash) return null;

  // داده نباید قدیمی باشد (۱ روز).
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86_400) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    } | null;
    if (!user?.id) return null;
    return {
      id: user.id,
      firstName: user.first_name ?? null,
      username: user.username ?? null,
    };
  } catch {
    return null;
  }
}
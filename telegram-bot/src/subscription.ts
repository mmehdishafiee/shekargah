/**
 * گیت عضویت اختیاری کانال.
 *
 * اگر `REQUIRE_JOIN=1` باشد، کاربر عادی تا عضو کانال نشود به بخش‌های ربات
 * دسترسی ندارد. خطای گذرا هرگز کاربر را قفل نمی‌کند (fail-open).
 */

import { GrammyError, HttpError } from "grammy";
import type { Api, MiddlewareFn } from "grammy";
import type { Config } from "./config.ts";
import type { BotContext } from "./context.ts";
import { joinKeyboard } from "./keyboards.ts";
import { log } from "./log.ts";

/** کالبک‌هایی که حتی بدون عضویت هم باید کار کنند (وگرنه کاربر گیر می‌کند) */
export const ALLOWED_CALLBACKS = new Set(["check_join", "help"]);

export const JOIN_REQUIRED_TEXT =
  "🔒 <b>برای استفاده از ربات، اول باید عضو کانال شکارگاه بشی.</b>\n\n" +
  "یه سر به کانال بزن، عضو شو، بعد برگرد و دکمهٔ «✅ عضو شدم، بررسی کن» رو بزن:\n\n" +
  "👇";

export interface ChatMemberLike {
  status: string;
  /** فقط برای status=restricted معنا دارد */
  is_member?: boolean;
}

/**
 * آیا این وضعیت عضویت یعنی کاربر «عضو» است؟
 *
 * `restricted` همیشه یعنی عضو بودن نیست؛ تلگرام برای کاربر محدودشده‌ای که
 * عضو نیست هم `restricted` برمی‌گرداند و آن‌جا `is_member=false` است.
 */
export function isMemberStatus(member: ChatMemberLike): boolean {
  switch (member.status) {
    case "creator":
    case "administrator":
    case "member":
      return true;
    case "restricted":
      return member.is_member === true;
    default:
      return false;
  }
}

const TRANSIENT_ERROR_CODES = new Set([429, 500, 502, 503, 504]);

function isTransient(error: unknown): boolean {
  if (error instanceof HttpError) return true;
  if (error instanceof GrammyError) return TRANSIENT_ERROR_CODES.has(error.error_code);
  return true;
}

export type GateReason = "member" | "not_member" | "gate_error";

export interface GateResult {
  allowed: boolean;
  reason: GateReason;
}

const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkMembership(
  api: Api,
  channelId: string,
  userId: number,
): Promise<GateResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const member = (await api.getChatMember(channelId, userId)) as ChatMemberLike;
      const allowed = isMemberStatus(member);
      return { allowed, reason: allowed ? "member" : "not_member" };
    } catch (error) {
      if (isTransient(error) && attempt === 0) {
        log.warn("خطای گذرا در چک عضویت — یک‌بار دیگر تلاش می‌شود", error);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      log.warn(
        "چک عضویت شکست خورد — دسترسی باز گذاشته شد (fail-open). " +
          "مطمئن شو ربات در کانال ادمین است و CHANNEL_ID درست است.",
        error,
      );
      return { allowed: true, reason: "gate_error" };
    }
  }

  return { allowed: true, reason: "gate_error" };
}

async function askToJoin(ctx: BotContext, config: Config): Promise<void> {
  const reply_markup = joinKeyboard(config.channelUrl);
  try {
    if (ctx.message) {
      await ctx.reply(JOIN_REQUIRED_TEXT, { reply_markup });
    } else if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "اول عضو کانال شو! 🔒", show_alert: true });
    }
  } catch (error) {
    log.error("ارسال پیام عضویت شکست خورد", error);
  }
}

/** میدل‌ور گیت عضویت. */
export function subscriptionGate(config: Config): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (!config.requireJoin) return next();

    const userId = ctx.from?.id;
    if (userId === undefined) return next();

    // ادمین‌ها معاف
    if (config.adminIds.has(userId)) return next();

    // /start خودش تصمیم می‌گیرد (باید دیپ‌لینک را ببیند)
    if (ctx.message?.text?.startsWith("/start")) return next();

    const callbackData = ctx.callbackQuery?.data;
    if (callbackData && ALLOWED_CALLBACKS.has(callbackData)) return next();

    if (ctx.chatMember || ctx.myChatMember) return next();

    const result = await checkMembership(ctx.api, config.channelId, userId);
    if (result.allowed) return next();

    await askToJoin(ctx, config);
  };
}
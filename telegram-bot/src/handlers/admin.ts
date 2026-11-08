/** پنل ادمین: معرفی محصول، پست دستی کانال، زمان‌بندی و آمار. */

import { Composer, InlineKeyboard, session } from "grammy";
import type { Message } from "grammy/types";

import type { Config } from "../config.ts";
import type { BotContext } from "../context.ts";
import { postCustomToChannel } from "../delivery.ts";
import { escapeHtml, faNumber, formatTehran } from "../html.ts";
import {
  adminMenuKeyboard,
  adminProductKeyboard,
  adminProductsKeyboard,
  backfillKeyboard,
  cancelKeyboard,
  channelPostMenuKeyboard,
  channelPostsKeyboard,
  draftChannelPostKeyboard,
} from "../keyboards.ts";
import { describeError, log } from "../log.ts";
import {
  SCHEDULE_HINT,
  announceProduct,
  backfillProducts,
  isAnnouncePaused,
  isFuture,
  parseScheduleInput,
  setAnnouncePaused,
} from "../schedule.ts";
import type { SiteClient } from "../site.ts";
import type { ChannelPostButton, ChannelPost, Store } from "../store.ts";
import type { D1SessionStorage, DraftPayload, SessionData } from "../storage.ts";
import { HTML } from "../ui.ts";

const ADMIN_PAGE = 5;
const MAX_CUSTOM_BUTTONS = 8;

/** لینک معتبر: دامنه‌دار، با یا بدون scheme */
const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!URL_PATTERN.test(value)) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** قالب: `متن دکمه | لینک` — یا فقط لینک (متن پیش‌فرض «🔗 لینک»). */
export function parseButton(raw: string): ChannelPostButton | null {
  const value = raw.trim();
  if (!value) return null;

  const separator = value.indexOf("|");

  if (separator === -1) {
    const url = normalizeUrl(value);
    return url ? { text: "🔗 لینک", url } : null;
  }

  const text = value.slice(0, separator).trim();
  const url = normalizeUrl(value.slice(separator + 1));
  if (!text || !url) return null;

  return { text: text.slice(0, 64), url };
}

const KIND_FA: Record<string, string> = {
  text: "متن",
  photo: "عکس",
  video: "ویدیو",
  document: "فایل",
  audio: "صدا",
  animation: "گیف",
};

/** نوع و محتوای پیام تلگرام را درمی‌آورد. */
function extractContent(message: Message): DraftPayload | null {
  if (message.text) {
    return { kind: "text", content: message.text, fileId: null, caption: null };
  }

  const photo = message.photo?.at(-1);
  if (photo) {
    return { kind: "photo", content: null, fileId: photo.file_id, caption: message.caption ?? null };
  }
  if (message.video) {
    return { kind: "video", content: null, fileId: message.video.file_id, caption: message.caption ?? null };
  }
  if (message.animation) {
    return { kind: "animation", content: null, fileId: message.animation.file_id, caption: message.caption ?? null };
  }
  if (message.audio) {
    return { kind: "audio", content: null, fileId: message.audio.file_id, caption: message.caption ?? null };
  }
  if (message.document) {
    return { kind: "document", content: null, fileId: message.document.file_id, caption: message.caption ?? null };
  }

  return null;
}

function postPreview(post: ChannelPost): string {
  const body = post.kind === "text" ? (post.content ?? "") : (post.caption ?? "");
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 34) : `(${KIND_FA[post.kind] ?? post.kind})`;
}

function adminHelp(config: Config, paused: boolean): string {
  return (
    "🛠 <b>پنل ادمین شکارگاه</b>\n\n" +
    "معرفی محصولات در کانال، پست دستی، زمان‌بندی و آمار.\n" +
    `📢 کانال مقصد: <code>${escapeHtml(config.channelId)}</code>\n` +
    `🔄 اعلان خودکار: ${paused ? "⏸ متوقف" : "▶️ فعال"}`
  );
}

async function safeEdit(ctx: BotContext, text: string, keyboard: InlineKeyboard): Promise<void> {
  try {
    await ctx.editMessageText(text, { ...HTML, reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { ...HTML, reply_markup: keyboard });
  }
}

function callbackId(ctx: BotContext, group = 1): number | null {
  const raw = ctx.match?.[group];
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export function createAdminComposer(
  config: Config,
  store: Store,
  site: SiteClient,
  storage: D1SessionStorage,
): Composer<BotContext> {
  const admin = new Composer<BotContext>();

  /** گارد ادمین: برای غیرادمین همیشه به کال‌بک جواب می‌دهد تا اسپینر نماند. */
  admin.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId !== undefined && config.adminIds.has(userId)) return next();

    const text = ctx.message?.text ?? "";
    const isPanelUpdate =
      ctx.callbackQuery?.data?.startsWith("admin:") === true || text.startsWith("/admin");

    if (!isPanelUpdate) return next();

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: "⛔️ این بخش فقط برای ادمین‌هاست.",
        show_alert: true,
      });
      return;
    }
    await ctx.reply("⛔️ این دستور فقط برای ادمین‌هاست.", HTML);
  });

  admin.use(
    session<SessionData, BotContext>({
      initial: () => ({}),
      storage,
      getSessionKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
    }),
  );

  async function showHome(ctx: BotContext): Promise<void> {
    const paused = await isAnnouncePaused(store);
    await safeEdit(ctx, adminHelp(config, paused), adminMenuKeyboard(paused));
  }

  // ---------- خانه ----------

  admin.command("admin", async (ctx) => {
    const paused = await isAnnouncePaused(store);
    await ctx.reply(adminHelp(config, paused), {
      ...HTML,
      reply_markup: adminMenuKeyboard(paused),
    });
  });

  admin.callbackQuery("admin:home", async (ctx) => {
    ctx.session = {};
    await ctx.answerCallbackQuery();
    await showHome(ctx);
  });

  admin.callbackQuery("admin:close", async (ctx) => {
    ctx.session = {};
    await ctx.answerCallbackQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      await ctx.reply("بستن پنل ✅", HTML);
    }
  });

  admin.callbackQuery("admin:noop", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "این محصول قبلاً در کانال معرفی شده است." });
  });

  // ---------- آمار ----------

  admin.callbackQuery("admin:stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    const stats = await store.overallStats();

    await safeEdit(
      ctx,
      "📊 <b>آمار ربات</b>\n\n" +
        `👥 کاربران ربات: <b>${faNumber(stats.users)}</b>\n` +
        `🔗 حساب‌های متصل به سایت: <b>${faNumber(stats.linked)}</b>\n` +
        `🔔 مشترکان اعلان: <b>${faNumber(stats.subscribers)}</b>\n` +
        `📣 معرفی‌های کانال: <b>${faNumber(stats.announcements)}</b>\n` +
        `⏰ زمان‌بندی‌شده: <b>${faNumber(stats.scheduled)}</b>\n` +
        `✍️ پست‌های دستی: <b>${faNumber(stats.channelPosts)}</b>\n` +
        `👀 بازدید محصول در ربات: <b>${faNumber(stats.productViews)}</b>`,
      adminMenuKeyboard(await isAnnouncePaused(store)),
    );
  });

  // ---------- تعلیق اعلان خودکار ----------

  admin.callbackQuery("admin:toggle_auto", async (ctx) => {
    const paused = await isAnnouncePaused(store);
    await setAnnouncePaused(store, !paused);
    await ctx.answerCallbackQuery({
      text: paused ? "اعلان خودکار فعال شد ▶️" : "اعلان خودکار متوقف شد ⏸",
      show_alert: true,
    });
    await showHome(ctx);
  });

  // ---------- لیست محصولات سایت ----------

  async function showProducts(ctx: BotContext, page: number): Promise<void> {
    const products = await site.listPublished(ADMIN_PAGE + 1, page * ADMIN_PAGE);
    const hasNext = products.length > ADMIN_PAGE;

    if (products.length === 0) {
      await safeEdit(
        ctx,
        "📭 محصولی برای نمایش نیست.",
        adminMenuKeyboard(await isAnnouncePaused(store)),
      );
      return;
    }

    await safeEdit(
      ctx,
      "📣 <b>محصولات اخیر سایت</b>\n\nروی هر محصول بزن تا به کانال بفرستی یا زمان‌بندی کنی:",
      adminProductsKeyboard(products.slice(0, ADMIN_PAGE), page, hasNext),
    );
  }

  admin.callbackQuery("admin:products", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showProducts(ctx, 0);
  });

  admin.callbackQuery(/^admin:products:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showProducts(ctx, callbackId(ctx) ?? 0);
  });

  admin.callbackQuery(/^admin:product:([0-9a-f-]{36})$/i, async (ctx) => {
    const productId = ctx.match?.[1];
    if (!productId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const product = await site.getProduct(productId);
    if (!product) {
      await ctx.answerCallbackQuery({ text: "محصول پیدا نشد.", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📦 <b>${escapeHtml(product.name)}</b>\n` +
        `${escapeHtml(product.tagline)}\n\n` +
        `🗂 ${escapeHtml(product.categoryName ?? "بدون دسته")}\n` +
        `👍 ${faNumber(product.votesCount)} رأی`,
      {
        ...HTML,
        reply_markup: adminProductKeyboard(product.id, await store.hasAnnouncement(product.id)),
      },
    );
  });

  // ---------- ارسال فوری محصول ----------

  admin.callbackQuery(/^admin:post_product:([0-9a-f-]{36})$/i, async (ctx) => {
    const productId = ctx.match?.[1];
    if (!productId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const product = await site.getProduct(productId);
    if (!product) {
      await ctx.answerCallbackQuery({ text: "محصول پیدا نشد.", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: "داره ارسال می‌شه…" });

    try {
      await announceProduct(ctx.api, store, config, product, "manual");
    } catch (error) {
      log.error("ارسال محصول به کانال شکست خورد", error);
      await ctx.reply(
        "❌ ارسال به کانال نشد.\n\n" +
          "چک کن:\n" +
          "• ربات توی کانال <b>ادمین</b> باشه و اجازه‌ی پست داشته باشه\n" +
          "• آیدی کانال در <code>wrangler.toml</code> درست باشه\n\n" +
          `<code>${escapeHtml(describeError(error))}</code>`,
        HTML,
      );
      return;
    }

    await ctx.reply(`✅ <b>${escapeHtml(product.name)}</b> در کانال پست شد.`, HTML);
  });

  // ---------- زمان‌بندی معرفی محصول ----------

  admin.callbackQuery(/^admin:schedule_product:([0-9a-f-]{36})$/i, async (ctx) => {
    const productId = ctx.match?.[1];
    if (!productId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const product = await site.getProduct(productId);
    if (!product) {
      await ctx.answerCallbackQuery({ text: "محصول پیدا نشد.", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    ctx.session = { schedulingProductId: product.id, schedulingProductName: product.name };

    await safeEdit(
      ctx,
      `⏰ <b>زمان‌بندی معرفی ${escapeHtml(product.name)}</b>\n\n${SCHEDULE_HINT}`,
      cancelKeyboard(),
    );
  });

  admin.callbackQuery(/^admin:unschedule_ann:(\d+)$/, async (ctx) => {
    const id = callbackId(ctx);
    if (id === null) {
      await ctx.answerCallbackQuery();
      return;
    }

    await store.cancelAnnouncementSchedule(id);
    await ctx.answerCallbackQuery({ text: "زمان‌بندی لغو شد." });
    await showScheduled(ctx);
  });

  // ---------- لیست زمان‌بندی‌ها ----------

  async function showScheduled(ctx: BotContext): Promise<void> {
    const announcements = await store.listScheduledAnnouncements();
    const posts = (await store.listChannelPosts(20)).filter(
      (post) => post.status === "scheduled",
    );

    if (announcements.length === 0 && posts.length === 0) {
      await safeEdit(
        ctx,
        "⏰ هیچ چیزی زمان‌بندی نشده.",
        adminMenuKeyboard(await isAnnouncePaused(store)),
      );
      return;
    }

    const lines = ["⏰ <b>زمان‌بندی‌ها</b>", ""];

    for (const item of announcements.slice(0, 5)) {
      lines.push(
        `📣 معرفی #${item.id} — ${escapeHtml(item.product_name)}`,
        `   🕐 ${item.scheduled_at ? formatTehran(item.scheduled_at) : "—"} (تهران)`,
      );
    }

    for (const post of posts.slice(0, 5)) {
      lines.push(
        `✍️ پست #${post.id} — ${escapeHtml(postPreview(post))}`,
        `   🕐 ${post.scheduled_at ? formatTehran(post.scheduled_at) : "—"} (تهران)`,
      );
    }

    await safeEdit(ctx, lines.join("\n"), scheduledKeyboardOf(announcements, posts));
  }

  admin.callbackQuery("admin:scheduled", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showScheduled(ctx);
  });

  // ---------- بک‌فیل ----------

  admin.callbackQuery("admin:backfill", async (ctx) => {
    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      "📦 <b>معرفی محصولات قبلی</b>\n\n" +
        "چند محصول اخیر را در کانال معرفی کنم؟ محصولاتی که قبلاً معرفی شده‌اند رد می‌شوند.",
      backfillKeyboard(),
    );
  });

  admin.callbackQuery(/^admin:backfill:(\d+)$/, async (ctx) => {
    const count = callbackId(ctx);
    if (count === null) {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery({ text: "در حال ارسال…" });

    try {
      const result = await backfillProducts(ctx.api, store, config, site, count);
      await ctx.reply(
        `✅ ${faNumber(result.announced)} محصول معرفی شد` +
          (result.skipped > 0 ? `، ${faNumber(result.skipped)} مورد از قبل بود` : "") +
          (result.failed > 0 ? `، ${faNumber(result.failed)} خطا` : ""),
        { ...HTML, reply_markup: adminMenuKeyboard(await isAnnouncePaused(store)) },
      );
    } catch (error) {
      log.error("بک‌فیل شکست خورد", error);
      await ctx.reply(`❌ خطا: <code>${escapeHtml(describeError(error))}</code>`, HTML);
    }
  });

  // ---------- پست دستی کانال ----------

  admin.callbackQuery("admin:cp", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session = {};
    await safeEdit(
      ctx,
      "✍️ <b>پست دستی کانال</b>\n\n" +
        "این پست‌ها مستقل از محصولات سایت هستند و با دکمه‌های دلخواه منتشر می‌شوند.\n" +
        "در ربات به کاربران نشان داده نمی‌شوند.",
      channelPostMenuKeyboard(),
    );
  });

  admin.callbackQuery("admin:cp:new", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session = { channelStep: "content", channelButtons: [] };

    await safeEdit(
      ctx,
      "✍️ <b>پست دستی — مرحله ۱ از ۲</b>\n\n" +
        "محتوای پست را بفرست (متن، یا عکس/ویدیو/فایل با کپشن).",
      cancelKeyboard(),
    );
  });

  admin.callbackQuery("admin:cp:clear", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "دکمه‌ها پاک شد." });
    ctx.session.channelButtons = [];
    await safeEdit(
      ctx,
      "🧹 دکمه‌ها پاک شدند. می‌تونی دکمه‌های جدید بفرستی یا منتشر کنی.",
      draftChannelPostKeyboard(false),
    );
  });

  admin.callbackQuery("admin:cp:publish", async (ctx) => {
    await ctx.answerCallbackQuery();

    const draft = ctx.session.channelDraft;
    const buttons = ctx.session.channelButtons ?? [];

    if (!draft) {
      ctx.session = {};
      await ctx.reply("⚠️ چیزی برای انتشار نیست. از «✍️ پست دستی کانال» شروع کن.", HTML);
      return;
    }

    try {
      await postCustomToChannel(ctx.api, config, draft, buttons);
    } catch (error) {
      log.error("ارسال پست دستی شکست خورد", error);
      await ctx.reply(
        "❌ ارسال نشد.\n\n" +
          "چک کن ربات در کانال ادمین باشد و اجازه‌ی پست داشته باشد.\n\n" +
          `<code>${escapeHtml(describeError(error))}</code>`,
        HTML,
      );
      return;
    }

    const postId = await store.addChannelPost(draft, buttons);
    await store.markChannelPostPosted(postId);
    ctx.session = {};

    await ctx.reply(
      `✅ پست <b>#${postId}</b> در کانال منتشر شد (${faNumber(buttons.length)} دکمه).`,
      { ...HTML, reply_markup: adminMenuKeyboard(await isAnnouncePaused(store)) },
    );
  });

  admin.callbackQuery("admin:cp:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showChannelPosts(ctx);
  });

  async function showChannelPosts(ctx: BotContext): Promise<void> {
    const posts = await store.listChannelPosts(5);

    if (posts.length === 0) {
      await safeEdit(ctx, "🗂 هنوز پست دستی‌ای ثبت نشده.", channelPostMenuKeyboard());
      return;
    }

    const lines = ["🗂 <b>پست‌های دستی اخیر</b>", ""];
    for (const post of posts) {
      lines.push(`#${post.id} — ${escapeHtml(postPreview(post))}`);

      if (post.status === "scheduled") {
        const when = post.scheduled_at ? formatTehran(post.scheduled_at) : "—";
        lines.push(`   ⏰ زمان‌بندی: ${when} (تهران)`);
      } else if (!post.posted_at) {
        lines.push("   ⏸ منتشر نشده");
      } else {
        lines.push(
          `   📢 ${faNumber(post.post_count)} بار منتشر شده · آخرین: ${formatTehran(toIso(post.posted_at))}`,
        );
      }
    }

    await safeEdit(ctx, lines.join("\n"), channelPostsKeyboard(posts));
  }

  admin.callbackQuery(/^admin:cp:repost:(\d+)$/, async (ctx) => {
    const postId = callbackId(ctx);
    if (postId === null) {
      await ctx.answerCallbackQuery();
      return;
    }

    const post = await store.getChannelPost(postId);
    if (!post) {
      await ctx.answerCallbackQuery({ text: "پیدا نشد.", show_alert: true });
      return;
    }

    try {
      await postCustomToChannel(
        ctx.api,
        config,
        { kind: post.kind, content: post.content, fileId: post.file_id, caption: post.caption },
        post.buttons,
      );
    } catch (error) {
      log.error("ارسال مجدد پست دستی شکست خورد", error);
      await ctx.answerCallbackQuery({
        text: `ارسال نشد: ${describeError(error)}`,
        show_alert: true,
      });
      return;
    }

    await store.markChannelPostPosted(post.id);
    await ctx.answerCallbackQuery({ text: "دوباره منتشر شد ✅", show_alert: true });
  });

  admin.callbackQuery(/^admin:cp:del:(\d+)$/, async (ctx) => {
    const postId = callbackId(ctx);
    if (postId === null) {
      await ctx.answerCallbackQuery();
      return;
    }

    const deleted = await store.deleteChannelPost(postId);
    await ctx.answerCallbackQuery({
      text: deleted ? "حذف شد ✅" : "پیدا نشد",
      show_alert: true,
    });
    await showChannelPosts(ctx);
  });

  admin.callbackQuery("admin:cp:schedule", async (ctx) => {
    await ctx.answerCallbackQuery();

    if (!ctx.session.channelDraft) {
      ctx.session = {};
      await ctx.reply("⚠️ اول محتوای پست را بفرست. از «✍️ پست دستی کانال» شروع کن.", HTML);
      return;
    }

    ctx.session.channelStep = "schedule";
    await safeEdit(ctx, `⏰ <b>زمان‌بندی پست دستی</b>\n\n${SCHEDULE_HINT}`, cancelKeyboard());
  });

  admin.callbackQuery(/^admin:cp:unschedule:(\d+)$/, async (ctx) => {
    const postId = callbackId(ctx);
    if (postId === null) {
      await ctx.answerCallbackQuery();
      return;
    }

    await store.cancelChannelPostSchedule(postId);
    await ctx.answerCallbackQuery({ text: "زمان‌بندی لغو شد." });
    await showScheduled(ctx);
  });

  // ---------- هندلر پیام‌ها ----------

  admin.on("message", async (ctx, next) => {
    const state = ctx.session;

    // ---- زمان‌بندی معرفی محصول ----
    if (state.schedulingProductId !== undefined) {
      const productId = state.schedulingProductId;
      const text = ctx.message.text;

      if (!text) {
        await ctx.reply(`⚠️ زمان را به‌صورت متن بفرست.\n\n${SCHEDULE_HINT}`, HTML);
        return;
      }

      const iso = parseScheduleInput(text);
      if (!iso || !isFuture(iso)) {
        await ctx.reply(`⚠️ زمان معتبر و در آینده بفرست.\n\n${SCHEDULE_HINT}`, HTML);
        return;
      }

      const product = await site.getProduct(productId);
      if (!product) {
        ctx.session = {};
        await ctx.reply("⚠️ محصول پیدا نشد.", HTML);
        return;
      }

      await store.addAnnouncement({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        source: "manual",
        status: "scheduled",
        scheduledAt: iso,
      });

      ctx.session = {};

      await ctx.reply(
        `⏰ معرفی <b>${escapeHtml(product.name)}</b> برای <b>${formatTehran(iso)}</b> (تهران) زمان‌بندی شد.`,
        { ...HTML, reply_markup: adminMenuKeyboard(await isAnnouncePaused(store)) },
      );
      return;
    }

    // ---- پست دستی: محتوا ----
    if (state.channelStep === "content") {
      const extracted = extractContent(ctx.message);
      if (!extracted) {
        await ctx.reply("⚠️ این نوع پیام پشتیبانی نمی‌شه.", HTML);
        return;
      }

      state.channelDraft = extracted;
      state.channelButtons = [];
      state.channelStep = "buttons";

      await ctx.reply(
        "✅ محتوا ثبت شد.\n\n" +
          "🔗 <b>مرحله ۲ از ۲ — دکمه‌ها</b>\n\n" +
          "هر دکمه را در یک پیام جدا به این شکل بفرست:\n" +
          "<code>متن دکمه | لینک</code>\n\n" +
          `مثال: <code>مشاهده محصول | ${escapeHtml(config.siteUrl)}</code>\n\n` +
          "وقتی تمام شد «📢 انتشار در کانال» را بزن.",
        { ...HTML, reply_markup: draftChannelPostKeyboard(false) },
      );
      return;
    }

    // ---- پست دستی: دکمه‌ها ----
    if (state.channelStep === "buttons") {
      const buttons = state.channelButtons ?? [];

      if (buttons.length >= MAX_CUSTOM_BUTTONS) {
        await ctx.reply(
          `⚠️ حداکثر ${faNumber(MAX_CUSTOM_BUTTONS)} دکمه در یک پست مجاز است. «📢 انتشار در کانال» را بزن.`,
          HTML,
        );
        return;
      }

      const button = parseButton(ctx.message.text ?? "");
      if (!button) {
        await ctx.reply(
          "⚠️ فرمت درست نیست.\n\n" +
            "دکمه را این‌طور بفرست: <code>متن دکمه | لینک</code>",
          HTML,
        );
        return;
      }

      state.channelButtons = [...buttons, button];

      await ctx.reply(
        `✅ دکمهٔ «${escapeHtml(button.text)}» اضافه شد (${faNumber(state.channelButtons.length)} دکمه).\n\n` +
          "دکمهٔ بعدی را بفرست، یا «📢 انتشار در کانال» را بزن.",
        { ...HTML, reply_markup: draftChannelPostKeyboard(true) },
      );
      return;
    }

    // ---- پست دستی: زمان‌بندی ----
    if (state.channelStep === "schedule") {
      const draft = state.channelDraft;
      if (!draft) {
        ctx.session = {};
        await ctx.reply("⚠️ محتوای پست پیدا نشد. از اول شروع کن.", HTML);
        return;
      }

      const iso = parseScheduleInput(ctx.message.text ?? "");
      if (!iso || !isFuture(iso)) {
        await ctx.reply(`⚠️ زمان معتبر و در آینده بفرست.\n\n${SCHEDULE_HINT}`, HTML);
        return;
      }

      const postId = await store.addChannelPost(draft, state.channelButtons ?? [], {
        scheduledAt: iso,
      });
      ctx.session = {};

      await ctx.reply(
        `⏰ پست <b>#${postId}</b> برای <b>${formatTehran(iso)}</b> (تهران) زمان‌بندی شد.`,
        { ...HTML, reply_markup: adminMenuKeyboard(await isAnnouncePaused(store)) },
      );
      return;
    }

    return next();
  });

  return admin;
}

/** زمان‌های ذخیره‌شده با `datetime('now')` را به ISO تبدیل می‌کند. */
function toIso(value: string): string {
  return value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
}

/** کیبورد زمان‌بندی‌ها (برای جلوگیری از ایمپورت چرخشی در keyboards). */
function scheduledKeyboardOf(
  announcements: { id: number; product_name: string }[],
  posts: ChannelPost[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const item of announcements) {
    keyboard
      .row()
      .text(
        `🚫 معرفی #${item.id} — ${item.product_name.slice(0, 18)}`,
        `admin:unschedule_ann:${item.id}`,
      );
  }

  for (const post of posts) {
    keyboard.row().text(`🚫 پست #${post.id}`, `admin:cp:unschedule:${post.id}`);
  }

  return keyboard.row().text("🔙 بازگشت", "admin:home");
}
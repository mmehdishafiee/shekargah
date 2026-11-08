/**
 * `/start` (شامل دیپ‌لینک)، `/help`، منوی کاربر، مرور محصولات و ورود به سایت.
 */

import { Composer } from "grammy";
import { createLoginLink } from "../auth.ts";
import type { Config } from "../config.ts";
import type { BotContext } from "../context.ts";
import { sendProductCard } from "../delivery.ts";
import { escapeHtml, faNumber } from "../html.ts";
import {
  aboutKeyboard,
  categoriesKeyboard,
  categoryProductsKeyboard,
  joinKeyboard,
  productListKeyboard,
  userMenuKeyboard,
} from "../keyboards.ts";
import type { SiteClient } from "../site.ts";
import type { Store } from "../store.ts";
import { JOIN_REQUIRED_TEXT, checkMembership } from "../subscription.ts";
import { describeError, log } from "../log.ts";
import { HTML } from "../ui.ts";
import { siteUrl } from "../urls.ts";

const PER_PAGE = 5;

const welcomeText = (name: string, config: Config): string =>
  `👋 <b>سلام ${escapeHtml(name)}!</b>\n\n` +
  "به ربات <b>شکارگاه</b> خوش اومدی.\n" +
  "اینجا محصول‌های تازه‌ی سازندگان ایرانی رو می‌بینی و می‌تونی با تلگرام وارد سایت بشی.\n\n" +
  `🌐 ${siteUrl(config)}`;

const helpText = (config: Config): string =>
  "i️ <b>راهنمای ربات شکارگاه</b>\n\n" +
  "📚 <b>محصولات تازه</b>\n" +
  "آخرین محصول‌های منتشرشده را نشان می‌دهد؛ روی هر کدام بزن تا کارتش را ببینی.\n\n" +
  "🗂 <b>دسته‌بندی‌ها</b>\n" +
  "همان دسته‌بندی‌های سایت؛ دسته را انتخاب کن و محصول‌های همان دسته را ببین.\n\n" +
  "🔐 <b>ورود به سایت</b>\n" +
  "با یک کلیک وارد حسابت در شکارگاه می‌شوی — بدون رمز و بدون ایمیل.\n\n" +
  "🔔 <b>اعلان محصولات</b>\n" +
  "اگر روشنش کنی، هر محصول تازه همین‌جا در چت خصوصی بهت خبر می‌رسد.\n\n" +
  "🔒 برای استفاده از ربات باید عضو کانال " +
  `${config.channelHandle} باشی.\n\n` +
  `📢 کانال: ${config.channelUrl}`;

const ABOUT_TEXT =
  "🏷 <b>درباره شکارگاه</b>\n\n" +
  "شکارگاه یک پلتفرم باز برای کشف محصول‌های ساخته‌شده توسط سازندگان ایرانی است.\n" +
  "هر روز محصول‌های تازه منتشر می‌شوند، کاربران رأی می‌دهند و بهترین‌ها بالاتر می‌آیند.\n\n" +
  "🧭 <b>در شکارگاه چه خبر است؟</b>\n" +
  "• 📅 «محصولات امروز» — شکارِ هر روز\n" +
  "• 🏆 جدول رتبه‌بندی روزانه، هفتگی، ماهانه و سالانه\n" +
  "• 🔥 «داغ‌ترین‌ها» بر اساس سرعت رأی و تعامل\n" +
  "• 🏷 سازنده و شکارچی — می‌بینی چه کسی ساخته و چه کسی کشف کرده\n" +
  "• 💬 نظر، نقد و امتیاز روی هر محصول\n\n" +
  "🧑‍🍳 <b>سازنده‌ای؟</b>\n" +
  "محصولت را در سایت معرفی کن تا شکارچی‌ها پیدایش کنند.\n\n" +
  "🔐 <b>ورود با تلگرام</b>\n" +
  "همین‌جا در ربات دکمه‌ی «ورود به سایت با تلگرام» را بزن؛ بدون رمز و ایمیل وارد می‌شوی.\n\n" +
  "📢 کانال ما، جایی که هر محصول تازه معرفی می‌شود.";

/** الگوی دیپ‌لینک محصول: p_<uuid> */
const PRODUCT_LINK = /^p_([0-9a-f-]{36})$/i;

async function ensureMember(ctx: BotContext, config: Config): Promise<boolean> {
  const userId = ctx.from?.id;
  if (userId === undefined) return false;

  const result = await checkMembership(ctx.api, config.channelId, userId);
  if (result.allowed) return true;

  await ctx.reply(JOIN_REQUIRED_TEXT, {
    ...HTML,
    reply_markup: joinKeyboard(config.channelUrl),
  });
  return false;
}

/** لینک ورود به سایت را می‌سازد و به کاربر می‌دهد. */
export async function sendLoginLink(
  ctx: BotContext,
  config: Config,
  store: Store,
  site: SiteClient,
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  let link: string;

  try {
    link = await createLoginLink(config, store, site, {
      id: from.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
    });
  } catch (error) {
    log.error("ساخت لینک ورود شکست خورد", describeError(error));
    await ctx.reply(
      "⚠️ ساخت لینک ورود ممکن نشد. چند لحظه بعد دوباره امتحان کن.",
      HTML,
    );
    return;
  }

  await ctx.reply(
    "🔐 <b>ورود به شکارگاه</b>\n\n" +
      "روی دکمه‌ی زیر بزن تا وارد حسابت بشوی. این لینک تا ۱۰ دقیقه معتبر است و فقط یک‌بار کار می‌کند.",
    {
      ...HTML,
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 ورود به سایت", url: link }]],
      },
    },
  );
}

async function sendMenu(ctx: BotContext, config: Config, text: string): Promise<void> {
  await ctx.reply(text, { ...HTML, reply_markup: userMenuKeyboard(config) });
}

export function createStartComposer(
  config: Config,
  store: Store,
  site: SiteClient,
): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    await store.saveUser(user.id, user.username ?? null, user.first_name ?? null);

    const payload = (ctx.match ?? "").trim();

    // ---- /start login : لینک ورود ----
    if (payload === "login") {
      // عضویت کانال برای همه‌ی امکانات ربات (از جمله ورود) لازم است.
      if (!(await ensureMember(ctx, config))) return;
      await sendLoginLink(ctx, config, store, site);
      return;
    }

    // ---- /start p_<id> : کارت یک محصول ----
    const productMatch = PRODUCT_LINK.exec(payload);
    if (productMatch) {
      if (!(await ensureMember(ctx, config))) return;

      const product = await site.getProduct(productMatch[1]!);
      if (!product) {
        await ctx.reply("⚠️ این محصول پیدا نشد یا از دسترس خارج شده.", HTML);
        return;
      }

      await sendProductCard(ctx.api, ctx.chat.id, config, product);
      await store.recordProductView(product.id, user.id);
      return;
    }

    // ---- شروع ساده ----
    if (!(await ensureMember(ctx, config))) return;
    await sendMenu(ctx, config, welcomeText(user.first_name || "دوست", config));
  });

  composer.command("help", async (ctx) => {
    await ctx.reply(helpText(config), { ...HTML, reply_markup: userMenuKeyboard(config) });
  });

  // ---- «عضو شدم، بررسی کن» ----
  composer.callbackQuery("check_join", async (ctx) => {
    const userId = ctx.from.id;
    const result = await checkMembership(ctx.api, config.channelId, userId);

    if (!result.allowed) {
      await ctx.answerCallbackQuery({
        text: "❌ هنوز عضو کانال نیستی! اول عضو شو، بعد دوباره امتحان کن.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: "✅ عضویتت تأیید شد!", show_alert: true });

    try {
      await ctx.editMessageText(welcomeText(ctx.from.first_name || "دوست", config), {
        ...HTML,
        reply_markup: userMenuKeyboard(config),
      });
    } catch {
      await ctx.reply(welcomeText(ctx.from.first_name || "دوست", config), {
        ...HTML,
        reply_markup: userMenuKeyboard(config),
      });
    }
  });

  // ---- منو ----
  composer.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = welcomeText(ctx.from.first_name || "دوست", config);
    try {
      await ctx.editMessageText(text, { ...HTML, reply_markup: userMenuKeyboard(config) });
    } catch {
      await ctx.reply(text, { ...HTML, reply_markup: userMenuKeyboard(config) });
    }
  });

  composer.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageText(helpText(config), {
        ...HTML,
        reply_markup: userMenuKeyboard(config),
      });
    } catch {
      await ctx.reply(helpText(config), { ...HTML, reply_markup: userMenuKeyboard(config) });
    }
  });

  composer.callbackQuery("about", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageText(ABOUT_TEXT, { ...HTML, reply_markup: aboutKeyboard(config) });
    } catch {
      await ctx.reply(ABOUT_TEXT, { ...HTML, reply_markup: aboutKeyboard(config) });
    }
  });

  // ---- ورود به سایت ----
  composer.callbackQuery("login", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "لینک ورود ساخته شد ✅" });
    await sendLoginLink(ctx, config, store, site);
  });

  // ---- اعلان محصولات ----
  composer.callbackQuery("notify", async (ctx) => {
    const userId = ctx.from.id;
    const wants = await store.wantsNewProducts(userId);

    await ctx.answerCallbackQuery();
    await ctx.reply(
      wants
        ? "🔔 اعلان محصولات تازه <b>روشن</b> است.\n\nهر محصول جدید همین‌جا برایت فرستاده می‌شود."
        : "🔕 اعلان محصولات تازه <b>خاموش</b> است.",
      {
        ...HTML,
        reply_markup: {
          inline_keyboard: [
            [{ text: wants ? "🔕 خاموش کن" : "🔔 روشن کن", callback_data: "notify:toggle" }],
            [{ text: "🏠 منو", callback_data: "menu" }],
          ],
        },
      },
    );
  });

  composer.callbackQuery("notify:toggle", async (ctx) => {
    const userId = ctx.from.id;
    const next = !(await store.wantsNewProducts(userId));
    await store.setWantsNewProducts(userId, next);

    await ctx.answerCallbackQuery({
      text: next ? "اعلان‌ها روشن شد 🔔" : "اعلان‌ها خاموش شد 🔕",
      show_alert: true,
    });

    try {
      await ctx.editMessageText(
        next
          ? "🔔 از این به بعد هر محصول تازه را همین‌جا خبرت می‌کنم."
          : "🔕 اعلان‌ها خاموش شد. هر وقت خواستی از منو روشنش کن.",
        { ...HTML, reply_markup: userMenuKeyboard(config) },
      );
    } catch {
      // پیام قبلی حذف شده — مهم نیست
    }
  });

  composer.callbackQuery("notify:off", async (ctx) => {
    await store.setWantsNewProducts(ctx.from.id, false);
    await ctx.answerCallbackQuery({ text: "اعلان‌ها خاموش شد 🔕", show_alert: true });
  });

  // ---- مرور محصولات ----
  composer.callbackQuery(/^browse:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match?.[1] ?? 0);
    if (!Number.isInteger(page) || page < 0) {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery();

    // یک ردیف بیشتر می‌خوانیم تا بفهمیم صفحه‌ی بعدی هست یا نه
    const products = await site.listPublished(PER_PAGE + 1, page * PER_PAGE);
    const hasNext = products.length > PER_PAGE;
    const visible = products.slice(0, PER_PAGE);

    const text =
      "📚 <b>محصولات تازه‌ی شکارگاه</b>\n\n" +
      (visible.length === 0
        ? "هنوز محصولی منتشر نشده. به‌زودی! 🙌"
        : "روی هر محصول بزن تا کارتش را ببینی:");

    const keyboard = productListKeyboard(visible, page, hasNext);

    try {
      await ctx.editMessageText(text, { ...HTML, reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { ...HTML, reply_markup: keyboard });
    }
  });

  // ---- دسته‌بندی‌های سایت ----
  composer.callbackQuery("cats", async (ctx) => {
    await ctx.answerCallbackQuery();

    const [categories, counts] = await Promise.all([
      site.listCategories(),
      site.countsByCategory(),
    ]);

    if (categories.length === 0) {
      const text = "🗂 هنوز دسته‌بندی‌ای در سایت نیست.";
      try {
        await ctx.editMessageText(text, { ...HTML, reply_markup: userMenuKeyboard(config) });
      } catch {
        await ctx.reply(text, { ...HTML, reply_markup: userMenuKeyboard(config) });
      }
      return;
    }

    const text =
      "🗂 <b>دسته‌بندی‌های شکارگاه</b>\n\n" +
      "یکی از دسته‌ها را انتخاب کن تا محصول‌هایش را ببینی:";

    const keyboard = categoriesKeyboard(categories, counts);

    try {
      await ctx.editMessageText(text, { ...HTML, reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { ...HTML, reply_markup: keyboard });
    }
  });

  // ---- محصولات یک دسته ----
  composer.callbackQuery(/^cat:([a-z0-9-]{1,40}):(\d+)$/, async (ctx) => {
    const slug = ctx.match?.[1];
    const page = Number(ctx.match?.[2] ?? 0);

    if (!slug || !Number.isInteger(page) || page < 0) {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery();

    // یک ردیف بیشتر می‌خوانیم تا بفهمیم صفحه‌ی بعدی هست یا نه
    const products = await site.listPublishedByCategory(slug, PER_PAGE + 1, page * PER_PAGE);
    const hasNext = products.length > PER_PAGE;
    const visible = products.slice(0, PER_PAGE);

    const [categories, counts] = await Promise.all([
      site.listCategories(),
      site.countsByCategory(),
    ]);
    const category = categories.find((item) => item.slug === slug);
    const label = category ? category.name : "این دسته";
    const total = counts[slug] ?? visible.length;

    const text =
      `🗂 <b>${escapeHtml(label)}</b> — ${faNumber(total)} محصول\n\n` +
      (visible.length === 0
        ? "هنوز محصولی در این دسته منتشر نشده. 🙌"
        : "روی هر محصول بزن تا کارتش را ببینی:");

    const keyboard = categoryProductsKeyboard(visible, slug, page, hasNext);

    try {
      await ctx.editMessageText(text, { ...HTML, reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { ...HTML, reply_markup: keyboard });
    }
  });

  // ---- کارت یک محصول ----
  composer.callbackQuery(/^product:([0-9a-f-]{36})$/i, async (ctx) => {
    const productId = ctx.match?.[1];
    if (!productId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const product = await site.getProduct(productId);
    if (!product) {
      await ctx.answerCallbackQuery({ text: "این محصول دیگر در دسترس نیست.", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await sendProductCard(ctx.api, ctx.chat?.id ?? ctx.from.id, config, product);
    await store.recordProductView(product.id, ctx.from.id);
  });

  return composer;
}
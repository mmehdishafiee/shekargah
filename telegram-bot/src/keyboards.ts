/**
 * همه‌ی کیبوردهای «شیشه‌ای» (inline).
 *
 * دکمه‌های شیشه‌ای همان دکمه‌های inline تلگرام هستند که شناور زیر پیام
 * می‌نشینند — نه کیبورد پایین صفحه. هر دکمه فقط متن و یک اکشن/لینک دارد.
 */

import { InlineKeyboard } from "grammy";
import type { Config } from "./config.ts";
import type { Announcement, ChannelPost } from "./store.ts";
import type { SiteCategory, SiteProduct } from "./site.ts";
import { faNumber } from "./html.ts";
import { productUrl, siteUrl, todayUrl } from "./urls.ts";

export type { SiteProduct };

// ---------- گیت عضویت ----------

export function joinKeyboard(channelUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .url("📢 عضویت در کانال", channelUrl)
    .row()
    .text("✅ عضو شدم، بررسی کن", "check_join");
}

// ---------- منوی کاربر ----------

export function userMenuKeyboard(config: Config): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("📚 محصولات تازه", "browse:0")
    .text("🗂 دسته‌بندی‌ها", "cats")
    .row()
    .text("🔐 ورود به سایت با تلگرام", "login")
    .row()
    .text("🔔 اعلان محصولات", "notify")
    .row()
    .text("🏷 درباره", "about")
    .text("i️ راهنما", "help")
    .row()
    .url("🌐 باز کردن شکارگاه", siteUrl(config));
  return keyboard;
}

export function aboutKeyboard(config: Config): InlineKeyboard {
  return new InlineKeyboard()
    .url("🌐 سایت شکارگاه", config.siteUrl)
    .row()
    .url("📢 کانال تلگرام", config.channelUrl)
    .row()
    .text("🔙 بازگشت", "menu");
}

// ---------- دسته‌بندی‌ها ----------

/** لیست دسته‌بندی‌های سایت با تعداد محصول هرکدام. */
export function categoriesKeyboard(
  categories: SiteCategory[],
  counts: Record<string, number>,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  categories.forEach((category, index) => {
    if (index > 0) keyboard.row();
    const count = counts[category.slug] ?? 0;
    const label = count > 0 ? `${category.name} (${faNumber(count)})` : category.name;
    keyboard.text(label.slice(0, 60), `cat:${category.slug}:0`);
  });

  return keyboard.row().text("🔙 بازگشت", "menu");
}

/** لیست محصولات یک دسته با صفحه‌بندی. */
export function categoryProductsKeyboard(
  products: SiteProduct[],
  slug: string,
  page: number,
  hasNext: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  products.forEach((product, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(product.name.slice(0, 60), `product:${product.id}`);
  });

  if (page > 0 || hasNext) {
    keyboard.row();
    if (page > 0) keyboard.text("⬅️ قبلی", `cat:${slug}:${page - 1}`);
    if (hasNext) keyboard.text("بعدی ➡️", `cat:${slug}:${page + 1}`);
  }

  return keyboard.row().text("🔙 بازگشت به دسته‌ها", "cats");
}

// ---------- محصولات ----------

/** لیست محصولات با صفحه‌بندی؛ هر محصول یک دکمه. */
export function productListKeyboard(
  products: SiteProduct[],
  page: number,
  hasNext: boolean,
  backAction = "menu",
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  products.forEach((product, index) => {
    if (index > 0) keyboard.row();
    const votes = product.votesCount > 0 ? ` · ${faNumber(product.votesCount)} رأی` : "";
    keyboard.text(
      `${product.name}${votes}`.slice(0, 60),
      `product:${product.id}`,
    );
  });

  if (page > 0 || hasNext) {
    keyboard.row();
    if (page > 0) keyboard.text("⬅️ تازه‌تر", `browse:${page - 1}`);
    if (hasNext) keyboard.text("قدیمی‌تر ➡️", `browse:${page + 1}`);
  }

  return keyboard.row().text("🔙 بازگشت", backAction);
}

/** دکمه‌های زیر کارت یک محصول در چت خصوصی. */
export function productKeyboard(config: Config, product: SiteProduct): InlineKeyboard {
  return new InlineKeyboard()
    .url("🚀 دیدن در شکارگاه", productUrl(config, product.slug))
    .row()
    .text("📚 محصولات تازه", "browse:0")
    .text("🏠 منو", "menu");
}

/** دکمه‌های شیشه‌ای زیر پست کانال. */
export function announcementKeyboard(
  config: Config,
  product: Pick<SiteProduct, "slug">,
): InlineKeyboard {
  return new InlineKeyboard()
    .url("🚀 دیدن محصول", productUrl(config, product.slug))
    .row()
    .url("🔥 محصولات تازه", todayUrl(config));
}

/** کارت معرفی محصول در چت خصوصی، با دعوت به اعلان. */
export function newProductDmKeyboard(config: Config, product: SiteProduct): InlineKeyboard {
  return new InlineKeyboard()
    .url("🚀 دیدن در شکارگاه", productUrl(config, product.slug))
    .row()
    .text("🔕 قطع اعلان‌ها", "notify:off")
    .text("🏠 منو", "menu");
}

// ---------- پنل ادمین ----------

export function adminMenuKeyboard(announcePaused: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text("📣 محصولات اخیر", "admin:products")
    .text("✍️ پست دستی کانال", "admin:cp")
    .row()
    .text("⏰ زمان‌بندی‌ها", "admin:scheduled")
    .text("📊 آمار", "admin:stats")
    .row()
    .text(
      announcePaused ? "▶️ فعال‌کردن اعلان خودکار" : "⏸ تعلیق اعلان خودکار",
      "admin:toggle_auto",
    )
    .row()
    .text("📦 معرفی محصولات قبلی", "admin:backfill")
    .text("❌ بستن", "admin:close");
}

/** لیست محصولات سایت برای انتخاب و ارسال به کانال. */
export function adminProductsKeyboard(
  products: SiteProduct[],
  page: number,
  hasNext: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  products.forEach((product, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(product.name.slice(0, 34), `admin:product:${product.id}`);
  });

  keyboard.row();
  if (page > 0) keyboard.text("⬅️ قبلی", `admin:products:${page - 1}`);
  if (hasNext) keyboard.text("بعدی ➡️", `admin:products:${page + 1}`);

  return keyboard.row().text("🔙 بازگشت", "admin:home");
}

export function adminProductKeyboard(
  productId: string,
  announced: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("📢 ارسال به کانال", `admin:post_product:${productId}`)
    .row()
    .text("⏰ زمان‌بندی", `admin:schedule_product:${productId}`);

  if (announced) keyboard.row().text("✅ قبلاً معرفی شده", "admin:noop");

  return keyboard.row().text("🔙 بازگشت", "admin:products:0");
}

export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ انصراف", "admin:home");
}

/** دکمه‌های دلخواه برای پست‌های عادی کانال (هر کدام در یک ردیف). */
export function customButtonsKeyboard(
  buttons: { text: string; url: string }[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  buttons.forEach((button, index) => {
    if (index > 0) keyboard.row();
    keyboard.url(button.text.slice(0, 64), button.url);
  });

  return keyboard;
}

// ---------- پست‌های عادی ----------

export function channelPostMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✍️ نوشتن پست جدید", "admin:cp:new")
    .row()
    .text("🗂 پست‌های قبلی", "admin:cp:list")
    .row()
    .text("🔙 بازگشت", "admin:home");
}

export function draftChannelPostKeyboard(hasButtons: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("📢 انتشار در کانال", "admin:cp:publish")
    .row()
    .text("⏰ زمان‌بندی انتشار", "admin:cp:schedule");

  if (hasButtons) {
    keyboard.row().text("🧹 پاک‌کردن دکمه‌ها", "admin:cp:clear");
  }

  return keyboard.row().text("❌ انصراف", "admin:home");
}

export function channelPostsKeyboard(posts: ChannelPost[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  posts.forEach((post, index) => {
    if (index > 0) keyboard.row();
    keyboard
      .text(`📢 ارسال مجدد #${post.id}`, `admin:cp:repost:${post.id}`)
      .text(`🗑 #${post.id}`, `admin:cp:del:${post.id}`);
  });

  for (const post of posts) {
    if (post.status === "scheduled") {
      keyboard
        .row()
        .text(`🚫 لغو زمان‌بندی #${post.id}`, `admin:cp:unschedule:${post.id}`);
    }
  }

  return keyboard.row().text("🔙 بازگشت", "admin:home");
}

// ---------- زمان‌بندی‌ها ----------

export function scheduledKeyboard(
  announcements: Announcement[],
  posts: ChannelPost[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  let rows = 0;

  for (const item of announcements) {
    keyboard.row().text(
      `🚫 معرفی #${item.id} — ${item.product_name.slice(0, 18)}`,
      `admin:unschedule_ann:${item.id}`,
    );
    rows += 1;
  }

  for (const post of posts) {
    keyboard.row().text(`🚫 پست #${post.id}`, `admin:cp:unschedule:${post.id}`);
    rows += 1;
  }

  if (rows === 0) keyboard.row().text("🔙 بازگشت", "admin:home");
  else keyboard.row().text("🔙 بازگشت", "admin:home");

  return keyboard;
}

// ---------- بک‌فیل ----------

export function backfillKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("۵ محصول", "admin:backfill:5")
    .text("۱۰ محصول", "admin:backfill:10")
    .row()
    .text("❌ انصراف", "admin:home");
}
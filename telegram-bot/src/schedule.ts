/**
 * زمان‌بندی انتشار و معرفی خودکار محصولات تازه.
 *
 * زمان ورودی به وقت تهران (UTC+3:30) تفسیر و به‌صورت ISO UTC ذخیره می‌شود
 * تا مقایسه‌ی رشته‌ای در D1 درست کار کند. ایران ساعت تابستانی ندارد.
 */

import type { Api } from "grammy";
import type { Config } from "./config.ts";
import { postCustomToChannel, postProductToChannel, sendProductCard } from "./delivery.ts";
import { formatTehran } from "./html.ts";
import { newProductDmKeyboard } from "./keyboards.ts";
import { describeError, log } from "./log.ts";
import type { SiteClient, SiteProduct } from "./site.ts";
import type { Store } from "./store.ts";

const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;

/** کلید وضعیت «آخرین محصول بررسی‌شده» */
const WATERMARK_KEY = "products_watermark";
/** کلید وضعیت «اعلان خودکار متوقف است» */
const PAUSED_KEY = "announce_paused";

const ABSOLUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;
const RELATIVE_PATTERN = /^\+(\d+)([mhd])$/;

function relativeMs(amount: number, unit: string): number {
  switch (unit) {
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 3_600_000;
    default:
      return amount * 86_400_000;
  }
}

/**
 * ورودی ادمین را به ISO UTC تبدیل می‌کند.
 * @returns ISO UTC، یا `null` اگر ورودی معتبر نباشد
 */
export function parseScheduleInput(input: string): string | null {
  const value = input.trim();

  const relative = RELATIVE_PATTERN.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2] ?? "m";
    return new Date(Date.now() + relativeMs(amount, unit)).toISOString();
  }

  const absolute = ABSOLUTE_PATTERN.exec(value);
  if (!absolute) return null;

  const [, year, month, day, hour, minute] = absolute;
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  const parsed = new Date(asUtc - TEHRAN_OFFSET_MINUTES * 60_000);
  if (Number.isNaN(parsed.getTime())) return null;

  // تاریخ‌های ناموجود (مثل 2026-02-31) رد شوند
  const roundTrip = new Date(asUtc);
  if (
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    roundTrip.getUTCHours() !== Number(hour) ||
    roundTrip.getUTCMinutes() !== Number(minute)
  ) {
    return null;
  }

  return parsed.toISOString();
}

export function isFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

/** پیام راهنمای زمان‌بندی. */
export const SCHEDULE_HINT =
  "زمان انتشار را بفرست:\n\n" +
  "• تاریخ و ساعت (به وقت تهران): <code>2026-11-05 09:30</code>\n" +
  "• یا نسبی: <code>+30m</code>، <code>+2h</code>، <code>+3d</code>";

// ---------- تعلیق/فعال‌سازی اعلان خودکار ----------

export async function isAnnouncePaused(store: Store): Promise<boolean> {
  return (await store.getState(PAUSED_KEY)) === "1";
}

export async function setAnnouncePaused(store: Store, paused: boolean): Promise<void> {
  await store.setState(PAUSED_KEY, paused ? "1" : "0");
}

// ---------- معرفی در کانال ----------

/**
 * یک محصول را در کانال پست می‌کند و در جدول معرفی‌ها ثبت می‌کند.
 * @returns شناسه‌ی ردیف معرفی
 */
export async function announceProduct(
  api: Api,
  store: Store,
  config: Config,
  product: SiteProduct,
  source: "auto" | "manual" = "auto",
): Promise<number> {
  const messageId = await postProductToChannel(api, config, product);
  const id = await store.addAnnouncement({
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    source,
    status: "posted",
  });
  await store.markAnnouncementPosted(id, messageId);
  return id;
}

// ---------- اطلاع‌رسانی به مشترکان ----------

/**
 * محصول تازه را در چت خصوصی مشترکان می‌فرستد.
 *
 * خطای ارسال به یک کاربر (مثلاً بلاک‌کردن ربات) بقیه را متوقف نمی‌کند و آن
 * کاربر علامت‌گذاری می‌شود.
 */
export async function notifySubscribers(
  api: Api,
  store: Store,
  config: Config,
  products: SiteProduct[],
): Promise<number> {
  let sent = 0;

  for (const product of products) {
    const subscribers = await store.listSubscribers(200, 0);

    for (const userId of subscribers) {
      try {
        await sendProductCard(api, userId, config, product, {
          keyboard: newProductDmKeyboard(config, product),
        });
        sent += 1;
      } catch (error) {
        const message = describeError(error);
        if (/blocked|deactivated|chat not found|user is deactivated/i.test(message)) {
          await store.markBlocked(userId);
        } else {
          log.warn(`ارسال اعلان به ${userId} شکست خورد`, message);
        }
      }
    }
  }

  return sent;
}

// ---------- معرفی خودکار ----------

export interface AnnounceResult {
  announced: number;
  failed: number;
  skipped: number;
}

/**
 * محصولاتی که بعد از آخرین بررسی منتشر شده‌اند را در کانال معرفی می‌کند.
 *
 * اجرای اول فقط «علامت» می‌گذارد و چیزی نمی‌فرستد تا با روشن‌شدن ربات،
 * همه‌ی محصولات قدیمی یک‌جا در کانال نریزند. برای معرفی قدیمی‌ها از پنل
 * ادمین «📦 معرفی محصولات قبلی» را بزن.
 */
export async function announceNewProducts(
  api: Api,
  store: Store,
  config: Config,
  site: SiteClient,
): Promise<AnnounceResult> {
  const result: AnnounceResult = { announced: 0, failed: 0, skipped: 0 };

  if (await isAnnouncePaused(store)) return result;

  const watermark = await store.getState(WATERMARK_KEY);

  if (!watermark) {
    // اولین اجرا: از «الان» شروع کن
    const latest = await site.listPublished(1, 0);
    const now = latest[0]?.publishedAt ?? new Date().toISOString();
    await store.setState(WATERMARK_KEY, now);
    log.info("نقطه‌ی شروع معرفی محصولات ثبت شد", { watermark: now });
    return result;
  }

  const products = await site.listPublishedSince(watermark, 20);
  if (products.length === 0) return result;

  let latest = watermark;
  const announcedProducts: SiteProduct[] = [];

  for (const product of products) {
    try {
      if (await store.hasAnnouncement(product.id)) {
        result.skipped += 1;
      } else {
        await announceProduct(api, store, config, product, "auto");
        result.announced += 1;
        announcedProducts.push(product);
      }

      if (product.publishedAt && product.publishedAt > latest) latest = product.publishedAt;
    } catch (error) {
      result.failed += 1;
      log.error(`معرفی محصول ${product.name} شکست خورد`, describeError(error));
      // نقطه‌ی آب را جلو نمی‌بریم تا در اجرای بعد دوباره تلاش شود.
      break;
    }
  }

  if (latest !== watermark) {
    await store.setState(WATERMARK_KEY, latest);
  }

  if (announcedProducts.length > 0) {
    const sent = await notifySubscribers(api, store, config, announcedProducts);
    if (sent > 0) log.info(`اعلان محصول تازه به ${sent} کاربر فرستاده شد`);
  }

  return result;
}

/**
 * معرفی چند محصول اخیر به‌صورت دستی (برای شروع کار یا جبران عقب‌ماندگی).
 * قدیمی‌ترها اول ارسال می‌شوند تا ترتیب زمانی حفظ شود.
 */
export async function backfillProducts(
  api: Api,
  store: Store,
  config: Config,
  site: SiteClient,
  count: number,
): Promise<AnnounceResult> {
  const result: AnnounceResult = { announced: 0, failed: 0, skipped: 0 };
  const products = await site.listPublished(count, 0);

  for (const product of [...products].reverse()) {
    try {
      if (await store.hasAnnouncement(product.id)) {
        result.skipped += 1;
        continue;
      }

      await announceProduct(api, store, config, product, "manual");
      result.announced += 1;
    } catch (error) {
      result.failed += 1;
      log.error(`بک‌فیل محصول ${product.name} شکست خورد`, describeError(error));
      break;
    }
  }

  return result;
}

// ---------- کرون ----------

/** همه‌ی چیزهایی که زمانشان رسیده را منتشر می‌کند. */
export async function publishDue(
  api: Api,
  store: Store,
  config: Config,
  site: SiteClient,
): Promise<{ published: number; failed: number }> {
  const now = new Date().toISOString();
  let published = 0;
  let failed = 0;

  // ---- معرفی زمان‌بندی‌شده‌ی محصولات ----
  for (const item of await store.listDueAnnouncements(now)) {
    try {
      const product = await site.getProduct(item.product_id);
      if (!product) {
        await store.deleteAnnouncement(item.id);
        continue;
      }

      const messageId = await postProductToChannel(api, config, product);
      await store.markAnnouncementPosted(item.id, messageId);
      published += 1;
    } catch (error) {
      failed += 1;
      log.error(`انتشار معرفی #${item.id} شکست خورد`, describeError(error));
    }
  }

  // ---- پست‌های عادی کانال ----
  for (const post of await store.listDueChannelPosts(now)) {
    try {
      await postCustomToChannel(
        api,
        config,
        {
          kind: post.kind,
          content: post.content,
          fileId: post.file_id,
          caption: post.caption,
        },
        post.buttons,
      );
      await store.markChannelPostPosted(post.id);
      published += 1;
    } catch (error) {
      failed += 1;
      log.error(`انتشار زمان‌بندی‌شده‌ی پست #${post.id} شکست خورد`, describeError(error));
    }
  }

  return { published, failed };
}

export { formatTehran };
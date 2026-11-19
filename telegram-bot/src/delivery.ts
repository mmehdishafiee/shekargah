/**
 * ساخت و ارسال کارت محصول — هم در چت خصوصی، هم به‌عنوان پست کانال.
 *
 * دو نکته‌ی مهم:
 *   * متن‌ها همیشه با HTML فرستاده می‌شوند، پس هر مقدار ورودی (نام، شعار،
 *     توضیح) پیش از درج فرار داده می‌شود.
 *   * اگر محصول لوگو داشته باشد، پست به‌صورت عکس با کپشن می‌رود؛ وگرنه متن.
 */

import type { Api, InlineKeyboard } from "grammy";
import type { Config } from "./config.ts";
import { escapeHtml, faNumber } from "./html.ts";
import { announcementKeyboard, customButtonsKeyboard, productKeyboard } from "./keyboards.ts";
import type { SiteProduct } from "./site.ts";
import type { ChannelPostButton, PostKind } from "./store.ts";

const MAX_TEXT_LENGTH = 4096;
const MAX_CAPTION_LENGTH = 1024;

export interface MediaPayload {
  kind: PostKind;
  content: string | null;
  fileId: string | null;
  caption: string | null;
}

type ExtraOptions = { reply_markup?: InlineKeyboard };

/** توضیح کوتاه‌شده برای پست کانال (بدون شکستن وسط جمله تا جای ممکن). */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * فوتر پست‌های کانال.
 *
 * زیر هر پست، آیدی خودِ کانال می‌آید (نه آیدی ربات) تا خواننده بداند
 * پست از کجا آمده و کانال را به بقیه معرفی کند.
 */
export function footerLine(config: Config): string {
  return `🌐 <a href="${config.channelUrl}">${config.channelHandle}</a>`;
}

/**
 * فوتر را به انتهای متن اضافه می‌کند. اگر متن + فوتر از سقف بگذرد، متن
 * دست‌نخورده می‌ماند و فوتر جداگانه فرستاده می‌شود.
 */
export function withFooter(
  body: string,
  footer: string,
  limit: number,
): { text: string; footerSeparately: boolean } {
  const trimmed = body.trimEnd();
  if (!trimmed) return { text: footer, footerSeparately: false };

  const combined = `${trimmed}\n\n${footer}`;
  if (combined.length <= limit) return { text: combined, footerSeparately: false };

  return { text: trimmed, footerSeparately: true };
}

/**
 * متن کارت محصول.
 * @param forChannel در کانال، توضیح کوتاه هم می‌آید؛ در چت خصوصی نه.
 */
export function productCardText(
  product: SiteProduct,
  options: { forChannel?: boolean } = {},
): string {
  const lines = [
    options.forChannel ? "🎯 <b>محصول تازه در شکارگاه</b>" : "🎯 <b>محصول شکارگاه</b>",
    "",
    `⭕️ <b>${escapeHtml(product.name)}</b>`,
    escapeHtml(product.tagline),
  ];

  const meta: string[] = [];
  if (product.categoryName) meta.push(`🗂 ${escapeHtml(product.categoryName)}`);
  if (product.votesCount > 0) meta.push(`👍 ${faNumber(product.votesCount)} رأی`);
  if (meta.length > 0) lines.push("", meta.join(" • "));

  if (options.forChannel && product.description) {
    lines.push("", escapeHtml(shorten(product.description, 260)));
  }

  return lines.join("\n");
}

/** ارسال مدیا (عکس/ویدیو/فایل/صدا/گیف). */
async function sendMedia(
  api: Api,
  chatId: number | string,
  payload: MediaPayload,
  extra: ExtraOptions = {},
): Promise<void> {
  const file = payload.fileId;
  if (!file) throw new Error("این پست فایل دارد ولی file_id آن خالی است.");

  const options = {
    ...(payload.caption ? { caption: payload.caption } : {}),
    ...extra,
  };

  switch (payload.kind) {
    case "photo":
      await api.sendPhoto(chatId, file, options);
      break;
    case "video":
      await api.sendVideo(chatId, file, options);
      break;
    case "animation":
      await api.sendAnimation(chatId, file, options);
      break;
    case "audio":
      await api.sendAudio(chatId, file, options);
      break;
    default:
      await api.sendDocument(chatId, file, options);
  }
}

/** کارت محصول را در چت خصوصی می‌فرستد. */
export async function sendProductCard(
  api: Api,
  chatId: number | string,
  config: Config,
  product: SiteProduct,
  options: { keyboard?: InlineKeyboard } = {},
): Promise<void> {
  const reply_markup = options.keyboard ?? productKeyboard(config, product);
  const body = productCardText(product);
  const logo = product.logoPath
    ? `${config.supabaseUrl}/storage/v1/object/public/product-logos/${product.logoPath}`
    : null;

  if (logo && body.length <= MAX_CAPTION_LENGTH) {
    try {
      await api.sendPhoto(chatId, logo, { caption: body, parse_mode: "HTML", reply_markup });
      return;
    } catch {
      // اگر تلگرام نتوانست عکس را بگیرد، متن می‌فرستیم تا پیام از دست نرود.
    }
  }

  await api.sendMessage(chatId, body, { parse_mode: "HTML", reply_markup });
}

/**
 * محصول را در کانال پست می‌کند و شناسه‌ی پیام را برمی‌گرداند.
 * خطا بالا می‌آید تا فراخوان پیام واضح به ادمین بدهد.
 */
export async function postProductToChannel(
  api: Api,
  config: Config,
  product: SiteProduct,
): Promise<number | null> {
  const reply_markup = announcementKeyboard(config, product);
  const { text, footerSeparately } = withFooter(
    productCardText(product, { forChannel: true }),
    footerLine(config),
    MAX_CAPTION_LENGTH,
  );

  const logo = product.logoPath
    ? `${config.supabaseUrl}/storage/v1/object/public/product-logos/${product.logoPath}`
    : null;

  let messageId: number | null = null;

  if (logo && text.length <= MAX_CAPTION_LENGTH) {
    try {
      const message = await api.sendPhoto(config.channelId, logo, {
        caption: text,
        parse_mode: "HTML",
        reply_markup,
      });
      messageId = message.message_id;
    } catch {
      // فال‌بک به متن
    }
  }

  if (messageId === null) {
    const message = await api.sendMessage(config.channelId, text, {
      parse_mode: "HTML",
      reply_markup,
      link_preview_options: { is_disabled: true },
    });
    messageId = message.message_id;
  }

  if (footerSeparately) {
    await api.sendMessage(config.channelId, footerLine(config), { parse_mode: "HTML" });
  }

  return messageId;
}

/**
 * پست عادی کانال (بدون ارتباط با محصول) با دکمه‌های دلخواه.
 */
export async function postCustomToChannel(
  api: Api,
  config: Config,
  payload: MediaPayload,
  buttons: ChannelPostButton[],
): Promise<void> {
  const isText = payload.kind === "text";
  const body = isText ? (payload.content ?? "—") : (payload.caption ?? "");
  const limit = isText ? MAX_TEXT_LENGTH : MAX_CAPTION_LENGTH;
  const { text, footerSeparately } = withFooter(body, footerLine(config), limit);

  const reply_markup = buttons.length > 0 ? customButtonsKeyboard(buttons) : undefined;

  if (isText) {
    await api.sendMessage(config.channelId, text, {
      parse_mode: "HTML",
      reply_markup,
      link_preview_options: { is_disabled: true },
    });
  } else {
    await sendMedia(
      api,
      config.channelId,
      { ...payload, caption: text },
      { reply_markup },
    );
  }

  if (footerSeparately) {
    await api.sendMessage(config.channelId, footerLine(config), { parse_mode: "HTML" });
  }
}
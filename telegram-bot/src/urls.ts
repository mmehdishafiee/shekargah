/** ساخت آدرس‌های سایت شکارگاه. */

import type { Config } from "./config.ts";

export function siteUrl(config: Pick<Config, "siteUrl">, path = "/"): string {
  return `${config.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** صفحه‌ی عمومی یک محصول: `/products/<slug>` */
export function productUrl(
  config: Pick<Config, "siteUrl">,
  slug: string,
): string {
  return `${config.siteUrl}/products/${encodeURIComponent(slug)}`;
}

/** صفحه‌ی محصولات تازه: `/today` */
export function todayUrl(config: Pick<Config, "siteUrl">): string {
  return `${config.siteUrl}/today`;
}
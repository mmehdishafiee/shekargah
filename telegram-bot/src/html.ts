/** کمک‌کننده‌های HTML برای parse_mode تلگرام. */

/** کاراکترهای حساس HTML را فرار می‌دهد. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** رقم‌های لاتین را به رقم‌های فارسی تبدیل می‌کند. */
export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}

/** عدد را با جداکننده‌ی هزارگان و رقم فارسی نشان می‌دهد: ۱۲٬۳۴۵ */
export function faNumber(value: number): string {
  return toFaDigits(new Intl.NumberFormat("en-US").format(value).replace(/,/g, "٬"));
}

/** نمایش کوتاه تاریخ/ساعت به وقت تهران (YYYY-MM-DD HH:MM). */
export function formatTehran(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const shifted = new Date(date.getTime() + (3 * 60 + 30) * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    ` ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}
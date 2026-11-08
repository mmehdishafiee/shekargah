/** لاگر ساده — خروجی در Cloudflare Workers Logs دیده می‌شود. */

type Meta = Record<string, unknown> | unknown;

function write(level: "info" | "warn" | "error", message: string, meta?: Meta): void {
  const line = `[shekargah-bot] ${message}`;
  if (meta === undefined) {
    console[level](line);
    return;
  }
  console[level](line, meta);
}

export const log = {
  info: (message: string, meta?: Meta) => write("info", message, meta),
  warn: (message: string, meta?: Meta) => write("warn", message, meta),
  error: (message: string, meta?: Meta) => write("error", message, meta),
};

/** خطا را به رشته‌ی کوتاه و خوانا تبدیل می‌کند (برای لاگ و پیام به کاربر). */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
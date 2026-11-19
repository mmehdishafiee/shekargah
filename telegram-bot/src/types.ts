/**
 * تایپ‌های مشترک پروژه.
 *
 * برای D1 عمداً یک رابط حداقلی و «ساختاری» تعریف شده تا تایپ‌چک و تست‌ها
 * به `@cloudflare/workers-types` نیاز نداشته باشند.
 */

export interface D1Meta {
  last_row_id?: number;
  changes?: number;
  [key: string]: unknown;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<{ count: number; duration: number }>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/** حداقلی از ExecutionContext ورکرها */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** متغیرهای محیطی ورکر. */
export interface Env {
  DB: D1DatabaseLike;

  BOT_TOKEN: string;
  WEBHOOK_SECRET?: string;

  BOT_USERNAME?: string;
  CHANNEL_ID?: string;
  CHANNEL_URL?: string;
  SITE_URL?: string;
  /** مبدأهای اضافی مجاز برای CORS، جداشده با کاما. SITE_URL همیشه مجاز است. */
  ALLOWED_ORIGINS?: string;
  ADMIN_IDS?: string;
  REQUIRE_JOIN?: string;
  ANNOUNCE_INTERVAL_MINUTES?: string;

  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /** فقط برای ساخت/ورود حساب تلگرامی — هرگز به مرورگر نمی‌رود. */
  SUPABASE_SERVICE_KEY?: string;
  /** راز مشتق‌کردن رمز حساب‌های تلگرامی. */
  AUTH_SECRET?: string;
}
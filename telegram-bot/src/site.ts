/**
 * لایه‌ی ارتباط با سایت شکارگاه (Supabase).
 *
 * دو کار متفاوت:
 *   * خواندن محصولات منتشرشده با کلید عمومی (همان چیزی که سایت هم استفاده می‌کند)
 *   * ساخت/ورود حساب تلگرامی با کلید service_role (فقط سمت ورکر)
 */

import type { Config } from "./config.ts";

export interface SiteProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string | null;
  logoPath: string | null;
  categoryName: string | null;
  votesCount: number;
  publishedAt: string | null;
}

/** یک دسته‌بندی سایت (همان چیزی که در صفحه‌ی موضوعات دیده می‌شود). */
export interface SiteCategory {
  slug: string;
  name: string;
  description: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string | null;
  logo_path: string | null;
  published_at: string | null;
  votes_count: number | string | null;
  categories: { name: string } | { name: string }[] | null;
}

const PRODUCT_COLUMNS =
  "id,slug,name,tagline,description,logo_path,published_at,votes_count,categories(name)";

const PAGE_LIMIT = 50;

function categoryNameOf(row: ProductRow): string | null {
  const relation = row.categories;
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.name ?? null;
  return relation.name ?? null;
}

function toProduct(row: ProductRow): SiteProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    logoPath: row.logo_path,
    categoryName: categoryNameOf(row),
    votesCount: Number(row.votes_count ?? 0),
    publishedAt: row.published_at,
  };
}

/** خطای گفت‌وگو با Supabase (با کد وضعیت برای تصمیم‌گیری). */
export class SiteError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`supabase ${status}: ${body.slice(0, 200)}`);
    this.name = "SiteError";
    this.status = status;
    this.body = body;
  }
}

export class SiteClient {
  private readonly config: Config;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Config, fetchImpl?: typeof fetch) {
    this.config = config;
    // تست‌ها یک fetch جعلی تزریق می‌کنند تا هیچ درخواست واقعی نرود.
    // نکته‌ی Workers: `fetch` باید از globalThis صدا زده شود؛ اگر خودِ تابع
    // بدون bind روی نمونه ذخیره و صدا زده شود، خطای «Illegal invocation» می‌دهد.
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  // ---------- آدرس‌ها ----------

  /** آدرس عمومی لوگوی محصول (باکت product-logos). */
  logoUrl(path: string | null): string | null {
    if (!path) return null;
    return `${this.config.supabaseUrl}/storage/v1/object/public/product-logos/${path}`;
  }

  /** آدرس صفحه‌ی محصول در سایت. */
  productUrl(slug: string): string {
    return `${this.config.siteUrl}/products/${encodeURIComponent(slug)}`;
  }

  /** آدرس یک مسیر داخلی سایت. */
  siteUrl(path = "/"): string {
    return `${this.config.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  // ---------- خواندن محصولات (کلید عمومی) ----------

  private headers(): Record<string, string> {
    return {
      apikey: this.config.supabaseAnonKey,
      Accept: "application/json",
    };
  }

  private async rest(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const response = await this.fetchImpl(`${this.config.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });

    const body = await response.text();
    if (!response.ok) throw new SiteError(response.status, body);

    return body ? (JSON.parse(body) as unknown) : null;
  }

  /** محصولات منتشرشده، تازه‌ترین اول. */
  async listPublished(limit = PAGE_LIMIT, offset = 0): Promise<SiteProduct[]> {
    const query =
      `products?select=${PRODUCT_COLUMNS}` +
      "&status=eq.published" +
      `&order=published_at.desc&limit=${limit}&offset=${offset}`;

    const rows = (await this.rest(query)) as ProductRow[];
    return rows.map(toProduct);
  }

  /** محصولاتی که بعد از یک زمان مشخص منتشر شده‌اند (برای اعلان خودکار). */
  async listPublishedSince(sinceIso: string, limit = 20): Promise<SiteProduct[]> {
    const query =
      `products?select=${PRODUCT_COLUMNS}` +
      "&status=eq.published" +
      `&published_at=gt.${encodeURIComponent(sinceIso)}` +
      `&order=published_at.asc&limit=${limit}`;

    const rows = (await this.rest(query)) as ProductRow[];
    return rows.map(toProduct);
  }

  /** یک محصول منتشرشده با شناسه. */
  async getProduct(id: string): Promise<SiteProduct | null> {
    const query =
      `products?select=${PRODUCT_COLUMNS}` +
      `&id=eq.${encodeURIComponent(id)}` +
      "&status=eq.published&limit=1";

    const rows = (await this.rest(query)) as ProductRow[];
    return rows[0] ? toProduct(rows[0]) : null;
  }

  /** محصولات یک دسته (با اسلاگ) برای مرور موضوعی. */
  async listPublishedByCategory(
    slug: string,
    limit = 10,
    offset = 0,
  ): Promise<SiteProduct[]> {
    const query =
      `products?select=${PRODUCT_COLUMNS}` +
      "&status=eq.published" +
      `&categories.slug=eq.${encodeURIComponent(slug)}` +
      `&order=published_at.desc&limit=${limit}&offset=${offset}`;

    const rows = (await this.rest(query)) as ProductRow[];
    return rows.map(toProduct);
  }

  /** دسته‌بندی‌های فعال سایت، به ترتیب نمایش. */
  async listCategories(): Promise<SiteCategory[]> {
    const query =
      "categories?select=slug,name,description" +
      "&is_active=eq.true&order=sort_order.asc";

    const rows = (await this.rest(query)) as {
      slug: string;
      name: string;
      description: string | null;
    }[];

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
    }));
  }

  /**
   * تعداد محصولات منتشرشده در هر دسته.
   *
   * یک درخواست می‌زنیم و شمارش را همین‌جا انجام می‌دهیم تا برای هر دسته
   * یک درخواست جدا لازم نباشد.
   */
  async countsByCategory(): Promise<Record<string, number>> {
    const query = "products?select=categories(slug)&status=eq.published&limit=1000";
    const rows = (await this.rest(query)) as { categories: { slug: string } | { slug: string }[] | null }[];

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const relation = row.categories;
      const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
      if (!slug) continue;
      counts[slug] = (counts[slug] ?? 0) + 1;
    }

    return counts;
  }

  /** تعداد محصولات منتشرشده. */
  async countPublished(): Promise<number> {
    const response = await this.fetchImpl(
      `${this.config.supabaseUrl}/rest/v1/products?select=id&status=eq.published`,
      { headers: { ...this.headers(), Prefer: "count=exact", Range: "0-0" } },
    );

    if (!response.ok) {
      throw new SiteError(response.status, await response.text());
    }

    const range = response.headers.get("content-range") ?? "*/0";
    const total = Number(range.split("/")[1] ?? 0);
    return Number.isFinite(total) ? total : 0;
  }

  // ---------- حساب تلگرامی (service_role) ----------

  private serviceHeaders(): Record<string, string> {
    return {
      apikey: this.config.supabaseServiceKey,
      Authorization: `Bearer ${this.config.supabaseServiceKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * کاربر Supabase با ایمیل مشخص را می‌سازد.
   * @returns شناسه‌ی کاربر، یا `null` اگر از قبل وجود داشته باشد (۴۲۲).
   */
  async createAuthUser(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<string | null> {
    const response = await this.fetchImpl(`${this.config.supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: this.serviceHeaders(),
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { display_name: input.displayName, source: "telegram" },
      }),
    });

    const body = await response.text();

    if (response.ok) {
      const parsed = JSON.parse(body) as { id?: string };
      return parsed.id ?? null;
    }

    // 422 = کاربر از قبل هست؛ 409 هم ممکن است بسته به نسخه‌ی GoTrue برگردد.
    if (response.status === 422 || response.status === 409) return null;

    throw new SiteError(response.status, body);
  }

  /** رمز یک کاربر را بازنشانی می‌کند (وقتی راز عوض شده باشد). */
  async resetPassword(userId: string, password: string): Promise<void> {
    const response = await this.fetchImpl(
      `${this.config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: this.serviceHeaders(),
        body: JSON.stringify({ password, email_confirm: true }),
      },
    );

    if (!response.ok) throw new SiteError(response.status, await response.text());
  }

  /** با ایمیل و رمز، نشست می‌سازد و توکن‌ها را برمی‌گرداند. */
  async passwordGrant(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const response = await this.fetchImpl(
      `${this.config.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: this.config.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );

    if (response.status === 400 || response.status === 401) {
      // رمز نمی‌خورد (مثلاً AUTH_SECRET عوض شده) — با null به فراخوان خبر می‌دهیم
      return null;
    }

    const body = await response.text();
    if (!response.ok) throw new SiteError(response.status, body);

    const parsed = JSON.parse(body) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!parsed.access_token || !parsed.refresh_token) return null;
    return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
  }
}
<div dir="rtl">

# انتقال پروژه به دامنهٔ جدید

همه‌چیز برای تغییر دامنه آماده است: هیچ دامنه‌ای در کد هارد‌کد نشده و کل جابه‌جایی با یک دستور انجام می‌شود.

## تک‌منبع حقیقت

نشانی عمومی سایت فقط در یک فایل است:

```json
// site.config.json
{ "siteUrl": "https://shekargah.mmehdi.ir" }
```

از همین مقدار ساخته می‌شوند:

| خروجی | جای مصرف |
| --- | --- |
| `<link canonical>` و `og:url` در `index.html` | پلاگین Vite (`%SITE_URL%`) |
| canonical و JSON-LD همهٔ صفحه‌ها | `src/lib/env.ts` → `siteUrl` |
| `dist/sitemap.xml` | `scripts/sitemap.mjs` |
| `dist/feed.xml` | `scripts/feed.mjs` |
| `dist/llms.txt` | `scripts/llms.mjs` |
| `dist/robots.txt` | `scripts/robots.mjs` |
| لینک اشتراک محصول | `src/pages/ProductPage.tsx` |

متغیر `VITE_SITE_URL` در build می‌تواند این مقدار را برای پیش‌نمایش یا تست بازنویسی کند، ولی مقدار پیش‌فرض در همان فایل است.

ربات تلگرام (`telegram-bot/`) دامنه را از `SITE_URL` در `wrangler.toml` می‌خواند و CORS را از همان مقدار + دامنهٔ `*.pages.dev` می‌سازد؛ پس با تغییر یک خط، همه‌جا به‌روز می‌شود.

## دستور انتقال

```bash
# فقط تغییرات محلی (کد، مستندات، ریدایرکت دامنهٔ قدیمی)
npm run domain -- example.com

# تغییرات محلی + Cloudflare (DNS + Pages) + Supabase Auth
npm run domain -- example.com --remote

# همه‌چیز + build + انتشار روی Pages + دیپلوی Worker ربات
npm run domain -- example.com --remote --deploy
```

اسکریپت به‌ترتیب این کارها را می‌کند:

1. `site.config.json` را به دامنهٔ جدید تغییر می‌دهد.
2. `SITE_URL` را در `telegram-bot/wrangler.toml` به‌روز می‌کند.
3. یک بلوک ریدایرکت ۳۰۱ از دامنهٔ قدیمی به جدید در `public/_redirects` می‌نویسد.
4. همهٔ ارجاع‌های دامنهٔ قدیمی را در README و `docs/` عوض می‌کند.
5. با `--remote`: رکورد CNAME و دامنهٔ سفارشی Pages و `site_url`/`redirect URLs` سوپابیس را ست می‌کند.
6. با `--deploy`: `dist/` را می‌سازد، روی برنچ `main` منتشر می‌کند و Worker ربات را دیپلوی می‌کند.
7. در پایان چک‌لیست وضعیت را چاپ می‌کند.

## توکن‌های لازم برای `--remote`

| متغیر | از کجا |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token با دسترسی **Zone → DNS → Edit** و **Account → Cloudflare Pages → Edit** |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate new token (`sbp_...`) |
| `CLOUDFLARE_ACCOUNT_ID` | اختیاری؛ پیش‌فرض همان حساب فعلی `Mmehdishafiee` است |
| `SUPABASE_PROJECT_REF` | اختیاری؛ پیش‌فرض `lxtxjgffxtgqtdrudynd` |

بدون این توکن‌ها هم اسکریپت کارهای محلی را کامل انجام می‌دهد و فقط مراحل داشبورد را با مقادیر دقیق چاپ می‌کند.

## پیش‌نیاز دامنه

- دامنه باید اول به Cloudflare اضافه شده باشد (nameservers روی Cloudflare). در غیر این صورت اسکریپت هشدار می‌دهد که zone پیدا نشد.
- ربات تلگرام به دامنهٔ `workers.dev` خودش وصل است و با تغییر دامنه نیازی به ست‌کردن مجدد webhook ندارد، ولی `SITE_URL` و CORS باید مطابق باشند — که اسکریپت انجام می‌دهد.

## بعد از انتقال (چک نهایی)

```bash
curl -sI https://example.com | head -1                     # 200
curl -s  https://example.com/robots.txt | tail -1          # Sitemap: https://example.com/sitemap.xml
curl -s  https://example.com/sitemap.xml | head -3
```

- ورود با ایمیل: لینک تأیید/ریست پسورد باید به دامنهٔ جدید بیاید (Site URL).
- ورود با تلگرام: دکمه «ورود به سایت» در ربات باید به دامنهٔ جدید ببرد (`SITE_URL`).
- دامنهٔ قدیمی باید ۳۰۱ بدهد (تا وقتی به پروژهٔ Pages وصل بماند).
- در Google Search Console دامنهٔ جدید را verify و `sitemap.xml` را ثبت کن.

## نکات

- دامنهٔ `*.pages.dev` و پروژه‌های Supabase/Cloudflare دست نمی‌خورند.
- اگر بعداً دامنه را دوباره عوض کردی، همین دستور را با دامنهٔ تازه بزن؛ بلوک ریدایرکت به‌صورت خودکار جایگزین می‌شود.
- برای rollback کافی است `siteUrl` را در `site.config.json` به مقدار قبلی برگردانی و دوباره build/انتشار کنی.

</div>
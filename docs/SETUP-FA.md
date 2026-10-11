# راهنمای راه‌اندازی شکارگاه

این راهنما کارهایی را توضیح می‌دهد که باید خودت در حساب‌های GitHub، Supabase و Cloudflare انجام بدهی. جزئیات فنی بیشتر در [DEPLOYMENT.md](DEPLOYMENT.md) است.

> هیچ‌وقت کلید `service_role`، رمز دیتابیس یا توکن دسترسی را در گفت‌وگو، کد یا فایل‌های گیت قرار نده. اپ فقط به نشانی پروژه و کلید عمومی (publishable) نیاز دارد.

## ۱. GitHub

**راه پیشنهادی: GitHub CLI**

```bash
winget install --id GitHub.cli -e
gh auth login
```

در `gh auth login` گزینه‌های GitHub.com، سپس HTTPS و بعد «Login with a web browser» را انتخاب کن. بعد از ورود، ساخت مخزن و push را می‌شود از همین‌جا انجام داد.

**راه دستی:** به https://github.com/new برو و این تنظیمات را انتخاب کن:

- Repository name: `shekargah`
- Description: `An open-source Persian product discovery platform`
- Public
- گزینه‌های README، ‏.gitignore و License را **انتخاب نکن** (پروژه این فایل‌ها را دارد).

بعد از ساخت، نشانی مخزن را بفرست تا به پروژه‌ی محلی وصل شود.

## ۲. Supabase

1. در https://supabase.com/dashboard وارد شو و **New project** را بزن.
2. پلن **Free** را انتخاب کن. یک رمز قوی برای دیتابیس بساز و در مدیر رمزت نگه دار (اپ به آن نیازی ندارد).
3. نزدیک‌ترین منطقه (Region) را انتخاب کن.
4. وقتی پروژه آماده شد، در **SQL Editor** محتوای این سه فایل را به ترتیب اجرا کن:
   - `supabase/migrations/20261011000001_initial_schema.sql`
   - `supabase/migrations/20261011000002_storage.sql`
   - `supabase/migrations/20261011000003_default_categories.sql`
5. در **Authentication → URL Configuration**:
   - Site URL: نشانی سایت (فعلاً `https://shekargah.pages.dev` یا هر نشانی‌ای که Cloudflare داد)
   - Redirect URLs: ‏`http://localhost:5173/**` و `https://shekargah.pages.dev/**` و `https://*.shekargah.pages.dev/**`
6. از **Project Settings → API Keys** این دو مقدار را بردار:
   - Project URL
   - Publishable key (یا anon key)
7. در پوشه‌ی پروژه فایل `.env.local` بساز (از روی `.env.example`) و این دو مقدار را در آن بگذار. این فایل وارد گیت نمی‌شود.

**محدودیت‌های پلن رایگان:** پروژه‌ی بی‌استفاده بعد از حدود یک هفته متوقف (pause) می‌شود و باید از داشبورد دوباره روشنش کنی. ایمیل داخلی Supabase فقط برای آزمایش است و در هر ساعت تعداد کمی ایمیل می‌فرستد. قبل از راه‌اندازی عمومی، SMTP اختصاصی تنظیم کن.

## ۳. ساخت اولین مدیر

1. در سایت با ایمیل خودت ثبت‌نام کن و ایمیل را تأیید کن.
2. در SQL Editor این دستور را با ایمیل خودت اجرا کن:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. یک بار خارج و دوباره وارد شو. گزینه‌ی «پنل مدیریت» در منوی حساب ظاهر می‌شود.

## ۴. Cloudflare Pages

1. در https://dash.cloudflare.com/ حساب بساز یا وارد شو.
2. **Workers & Pages → Create → Pages → Connect to Git** را بزن و به GitHub اجازه‌ی دسترسی به مخزن `shekargah` را بده.
3. تنظیمات ساخت:
   - Production branch: ‏`main`
   - Build command: ‏`npm run build`
   - Build output directory: ‏`dist`
4. در بخش Environment variables (برای Production و Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_REPOSITORY_URL` (اختیاری: نشانی مخزن گیت‌هاب)
5. **Save and Deploy** را بزن.

**بررسی موفقیت:** لاگ ساخت باید با Success تمام شود. در سایت منتشرشده نوار «حالت نمایشی» نباید دیده شود. اگر دیده شد، متغیرهای محیطی تنظیم نشده‌اند. صفحه‌ای مثل `/about` را رفرش کن؛ باید باز شود.

## ۵. دامنه‌ی اختصاصی (بعداً)

بعد از خرید دامنه:

1. در پروژه‌ی Pages به **Custom domains** برو و دامنه را اضافه کن.
2. اگر DNS دامنه روی Cloudflare نیست، رکورد CNAME نمایش‌داده‌شده را در پنل ثبت‌کننده‌ی دامنه وارد کن.
3. گواهی HTTPS خودکار صادر می‌شود.
4. در Supabase، ‏Site URL را به دامنه‌ی تازه تغییر بده و `https://دامنه‌ی-تو/**` را به Redirect URLs اضافه کن.

به تغییر کد نیازی نیست.

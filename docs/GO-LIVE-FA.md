# راهنمای آنلاین کردن شکارگاه

این راهنما گامهای لازم برای منتشر کردن سایت روی اینترنت را خلاصه میکند. جزئیات بیشتر در [DEPLOYMENT.md](DEPLOYMENT.md) و [SETUP-FA.md](SETUP-FA.md) است.

## مقادیر این پروژه

| مورد | مقدار |
| --- | --- |
| ریپوی گیتهاب | `https://github.com/mmehdishafiee/shekargah` |
| ایمیل مدیر | `mmhdishafiee@gmail.com` |
| Project URL سوپابیس | `https://lxtxjgffxtgqtdrudynd.supabase.co` |
| نشانی سایت (دامنهٔ اصلی) | `https://shekargah.mmehdi.ir` |
| نشانی جایگزین (Cloudflare Pages) | `https://shekargah.pages.dev` |

> **نکتهٔ تحریم/فیلتر:** `pages.dev` و `supabase.co` در ایران تحریم‌اند. برای دسترسی مستقیم، سایت روی دامنهٔ خودت `shekargah.mmehdi.ir` قرار گرفت. در تنظیمات Auth، Site URL را همان دامنه بگذار. |

## آنچه لازم داری

- حساب GitHub با ریپوی بالا (آماده است)
- حساب Supabase (رایگان)
- حساب Cloudflare (رایگان)

> هرگز کلید `service_role` یا رمز دیتابیس را در Cloudflare، کد یا گیتهاب قرار نده. فقط دو مقدار عمومی لازم است.

## ۱. ساخت پروژه Supabase

1. در https://supabase.com/dashboard روی **New project** بزن.
2. پلن **Free** را انتخاب کن، نام `shekargah` بده و منطقهی نزدیک به کاربرانت را بگذار.
3. رمز دیتابیس را بساز و در مدیر رمز نگه دار. اپ به آن نیاز ندارد.
4. منتظر بمان تا پروژه آماده شود، و Project URL را یادداشت کن.

## ۲. اجرای migrationها

در Supabase به **SQL Editor → New query** برو. محتوای هر فایل را کامل کپی کن، در editor بگذار و **Run** بزن. این سه فایل را **به همین ترتیب** اجرا کن:

1. `supabase/migrations/20261011000001_initial_schema.sql`
2. `supabase/migrations/20261011000002_storage.sql`
3. `supabase/migrations/20261011000003_default_categories.sql`
4. `supabase/migrations/20261019000004_hunter_entries.sql`
5. `supabase/migrations/20261020000005_engagement.sql`

## ۳. گرفتن کلیدهای عمومی

در **Project Settings → API Keys** این دو مقدار را کپی کن:

- **Project URL** ← `VITE_SUPABASE_URL`
- **Publishable key** یا **anon key** ← `VITE_SUPABASE_PUBLISHABLE_KEY`

## ۴. دیپلوی روی Cloudflare Pages

1. در https://dash.cloudflare.com به **Workers & Pages → Create → Pages → Connect to Git** برو.
2. GitHub را وصل کن و ریپوی `mmehdishafiee/shekargah` را انتخاب کن.
3. تنظیمات build:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Production branch:** `main`
4. در **Environment variables** برای هم **Production** و هم **Preview** این متغیرها را اضافه کن:
   - `VITE_SUPABASE_URL` = Project URL از مرحلهٔ ۳
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = کلید publishable از مرحلهٔ ۳
   - `VITE_REPOSITORY_URL` = `https://github.com/mmehdishafiee/shekargah` (اختیاری)
5. **Save and Deploy** را بزن و منتظر بمان تا لاگ با `Success` تمام شود.

## ۵. تنظیم Auth در Supabase

بعد از گرفتن نشانی سایت، در Supabase به **Authentication → URL Configuration** برو:

- **Site URL:** `https://<اسم-پروژه>.pages.dev`
- **Redirect URLs:** اضافه کن
  - `https://<اسم-پروژه>.pages.dev/**`
  - `https://*.<اسم-پروژه>.pages.dev/**`

اگر لینک تأیید ایمیل یا بازیابی رمز کار نکرد، تقریباً همیشه این بخش مشکل دارد.

## ۶. ساخت مدیر با ایمیل `mmhdishafiee@gmail.com`

1. روی سایت آنلاین با همین ایمیل ثبتنام کن و لینک تأیید را باز کن. ردیف پروفایل بعد از ثبتنام ساخته میشود، پس این مرحله قبل از SQL لازم است.
2. در Supabase به **SQL Editor** برو و اجرا کن:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'mmhdishafiee@gmail.com');
   ```

3. اگر گزارش **۰ rows** دیدی، ایمیل پیدا نشده. یعنی یا ثبتنام نکردهای یا ایمیل در ثبتنام فرق دارد.
4. از سایت خارج و دوباره وارد شو. گزینهٔ «پنل مدیریت» ظاهر میشود.

## ۷. بررسی نهایی

- [ ] سایت بدون بنر «حالت نمایشی» باز میشود.
- [ ] صفحهای مثل `/about` را رفرش میکنی و خطای ۴۰۴ نمیدهد.
- [ ] ثبتنام و ورود کار میکند.
- [ ] یک محصول ثبت میکنی و در پنل مدیریت تأیید میشود.
- [ ] رأی دادن و نظر گذاشتن کار میکند.
- [ ] `/admin` برای کاربر عادی «دسترسی به این بخش نداری» نشان میدهد.

## نکتههای مهم

- **پروژهٔ Free بعد از حدود یک هفته بیفعالیتی pause میشود.** سایت در آن حالت خطا میدهد. برای روشن کردن دوباره، از داشبورد Supabase دکمهٔ restore را بزن.
- **ایمیل داخلی Supabase فقط برای تست است** و تعداد کمی ایمیل در ساعت میفرستد. قبل از عمومی شدن، SMTP اختصاصی تنظیم کن (Authentication → SMTP Settings).
- **دامنهٔ اختصاصی:** در Cloudflare به Custom domains برو و دامنه را اضافه کن. سپس Site URL و Redirect URLs را در Supabase عوض کن. اگر Supabase را هم روی دامنهٔ دیگری بردی، `public/_headers` را هم بهروز کن.

### دربارهٔ دامنهٔ `mmehdi.ir`

سایت روی `shekargah.mmehdi.ir` (ساب‌دامین دامنهٔ خودت) کار می‌کند چون `pages.dev` و `supabase.co` در ایران تحریم/فیلترند. برای راه‌اندازی آن:

1. در Cloudflare به **DNS** برو و رکورد `CNAME` برای `shekargah` به `shekargah.pages.dev` بساز (proxied = فعال).
2. در تنظیمات پروژه Pages → **Custom domains** → **Set up a custom domain** → `shekargah.mmehdi.ir` را بزن.
3. در Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://shekargah.mmehdi.ir`
   - Redirect URLs: `https://shekargah.mmehdi.ir/**`، `https://shekargah.pages.dev/**`، `https://*.shekargah.pages.dev/**`

اگر روزی خواستی دامنهٔ مستقل (مثل `shekargah.ir`) بگیری، رکورد CNAME را به همان دامنه تغییر بده و Custom Domain را عوض کن.
- **بکاپ:** اسکیمای دیتابیس از فایلهای migration قابل بازسازی است، ولی دادهها و فایلهای آپلودشده جدا باید بکاپ شوند (جزئیات در DEPLOYMENT.md).

## خطاهای رایج

| خطا | علت احتمالی |
| --- | --- |
| بنر «حالت نمایشی» روی سایت هست | متغیرهای `VITE_` در Cloudflare تنظیم نشدهاند، یا بعد از تنظیم دوباره دیپلوی نکردهای |
| ورود یا ثبتنام خطای شبکه میدهد | Site URL یا Redirect URLs در Supabase درست نیست |
| لینک ایمیل به localhost میرود | Site URL در Supabase هنوز `localhost` است |
| `/submit` یا محصولها خالیاند | migrationها کامل اجرا نشدهاند، یا پروژه pause شده |
| دکمهٔ «پنل مدیریت» نیست | ایمیل در SQL اشتباه است (۰ rows)، یا هنوز یک بار خارج و وارد نشدهای |

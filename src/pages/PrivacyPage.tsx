import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FileText, Lock, Mail, ShieldCheck } from 'lucide-react'
import { CONTACT_EMAIL } from './InfoPages'
import { formatDate } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { cardClass } from '@/components/ui/styles'

const UPDATED_AT = '2026-11-08'
const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline'

interface Block {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  /** Two-column rows, used by the service-provider table. */
  rows?: [string, string][]
}

interface Content {
  title: string
  subtitle: string
  updatedLabel: string
  contactTitle: string
  contactBody: string
  blocks: Block[]
}

const CONTENT: Record<'fa' | 'en', Content> = {
  fa: {
    title: 'سیاست حریم خصوصی',
    subtitle:
      'این صفحه توضیح میدهد شکارگاه چه اطلاعاتی از تو نگه میدارد، چرا، با چه کسی به اشتراک میگذارد و تو چه حقوقی داری. همهچیز را ساده و بدون زبان حقوقی پیچیده نوشتهایم.',
    updatedLabel: 'آخرین بهروزرسانی',
    contactTitle: 'پرسش یا درخواست داری؟',
    contactBody: 'برای دسترسی، اصلاح یا حذف اطلاعاتت، یا هر پرسشی دربارهی این سیاست، به ما ایمیل بزن:',
    blocks: [
      {
        id: 'summary',
        title: 'خلاصه در یک نگاه',
        paragraphs: [
          'شکارگاه یک ویترین متنباز برای کشف محصولات ایرانی است. برای اینکه بتوانی ثبتنام کنی، محصول معرفی کنی و رأی بدهی، مقدار محدودی از اطلاعاتت را نگه میداریم.',
          'اطلاعات تو را نمیفروشیم، تبلیغات شخصیسازیشده نشان نمیدهیم و از ابزارهای تحلیلی یا ردیاب رفتاری استفاده نمیکنیم. آنچه در مرورگرت ذخیره میشود محدود است به ورود، تنظیمات نمایش و جلوگیری از شمردن بازدید تکراری.',
        ],
      },
      {
        id: 'what-we-collect',
        title: 'چه اطلاعاتی جمعآوری میکنیم',
        paragraphs: ['فقط اطلاعاتی را میگیریم که برای کار کردن سایت لازم است:'],
        bullets: [
          'اطلاعات حساب: نام نمایشی، نام کاربری، نشانی ایمیل، تصویر پروفایل و بیوگرافی. رمز عبور هرگز بهصورت متن ساده ذخیره نمیشود؛ فقط نسخهی هششدهی آن نگه داشته میشود.',
          'ورود با گوگل یا گیتهاب: اگر با این سرویسها وارد شوی، فقط شناسهی عمومی، ایمیل، نام و تصویر پروفایل از طرف آنها دریافت میشود. رمز عبور گوگل یا گیتهاب هرگز به ما نمیرسد.',
          'ورود با تلگرام: شناسهی عددی تلگرام، نام و نام کاربری و عکس پروفایل عمومی برای ساختن حساب ذخیره میشود.',
          'محتوایی که خودت میسازی: محصولاتی که معرفی میکنی، رأیها، نظرها و نقدها، امتیازها، مجموعهها، درخواستهای ویرایش، گزارشها و پیامهایی که از فرم تماس یا خبرنامه میفرستی.',
          'شناسهی مرورگر: برای اینکه یک بازدید تکراری چند بار شمرده نشود، یک شناسهی تصادفی در مرورگرت ساخته و نگه داشته میشود. این شناسه به نام تو، آدرس IP یا هویت واقعیات گره نمیخورد.',
          'سجلهای فنی: سرویس میزبانی ما، مانند هر سرویسدهندهی میزبانی دیگری، ممکن است آدرس IP و درخواستها را در سجلهای امنیتی و ضدحملهی خود ثبت کند.',
        ],
      },
      {
        id: 'cookies',
        title: 'کوکیها و حافظهی مرورگر',
        paragraphs: ['شکارگاه کوکی تبلیغاتی و ردیاب بینسایتی ندارد. آنچه در مرورگرت ذخیره میشود فقط اینهاست:'],
        bullets: [
          'نشانهی ورود (نشست)، تا وقتی صفحه را میبندی از حسابت خارج نشوی.',
          'تنظیمات نمایش: حالت روشن، تیره یا سیستم.',
          'شناسهی تصادفی بازدید.',
        ],
      },
      {
        id: 'why',
        title: 'چرا این اطلاعات را داریم',
        bullets: [
          'ساختن و نگهداشتن حساب و ورود امن.',
          'تأیید نشانی ایمیل و بازیابی رمز عبور.',
          'نمایش پروفایل عمومیات، محصولاتی که معرفی کردهای و رأیها و نقدهایت.',
          'بررسی محصولات تازهپیشنهادی پیش از انتشار و ارتباط با تو دربارهی وضعیت آنها.',
          'اطلاعرسانی دربارهی رأی، نظر، نقد، دنبالکردن و محصولات تازه.',
          'جلوگیری از سوءاستفاده: رأی تکراری، حسابهای انبوه و محتوای نامناسب.',
          'پاسخ به پیامها و پرسشهایت.',
        ],
      },
      {
        id: 'public',
        title: 'چه چیزی عمومی میشود',
        paragraphs: [
          'پروفایل تو عمومی است: نام نمایشی، نام کاربری، بیوگرافی، محصولاتی که معرفی کردهای، رأیها، نظرها و نقدهایت. اگر در تنظیمات، پیوندهای عمومی (وبسایت، ایکس، تلگرام، لینکدین، گیتهاب) را پر کنی، آنها هم در پروفایلت دیده میشوند.',
          'نشانی ایمیل، شناسهی تلگرام و اطلاعات ورود تو هرگز عمومی نمایش داده نمیشود.',
        ],
      },
      {
        id: 'services',
        title: 'سرویسهای واسط',
        paragraphs: [
          'برای کار کردن سایت از سرویسهای زیر استفاده میکنیم و اطلاعات فقط در حد نیاز به آنها سپرده میشود. هیچ دادهای فروخته نمیشود و برای تبلیغات به دیگران داده نمیشود.',
        ],
        rows: [
          ['Supabase', 'پایگاه داده، احراز هویت و نگهداری تصاویر محصولات و پروفایل'],
          ['Cloudflare', 'میزبانی سایت، شبکهی توزیع محتوا و سرور ربات تلگرام'],
          ['Google', 'فقط ورود با حساب گوگل (اختیاری)'],
          ['GitHub', 'فقط ورود با حساب گیتهاب (اختیاری)'],
          ['Telegram', 'ورود با تلگرام و اطلاعرسانی رویدادهای شکارگاه (اختیاری)'],
        ],
      },
      {
        id: 'location',
        title: 'محل نگهداری اطلاعات',
        paragraphs: [
          'سرورهای این سرویسها بیرون از ایران قرار دارند، بنابراین اطلاعات تو ممکن است در کشور دیگری نگهداری شود. با استفاده از شکارگاه با همین جابهجایی موافقت میکنی.',
        ],
      },
      {
        id: 'retention',
        title: 'چه مدت نگه میداریم',
        bullets: [
          'تا وقتی حسابت فعال است، اطلاعات پروفایلت نگه داشته میشود.',
          'اگر بخواهی حسابت را حذف کنیم، پروفایل و اطلاعات شخصی مرتبط با آن پاک میشود.',
          'محصولاتی که معرفی کردهای ممکن است پس از حذف حساب هم با ذکر منبع در فهرست عمومی باقی بمانند، چون بخشی از محتوای عمومی سایت شدهاند.',
          'حداقل اطلاعات لازم برای جلوگیری از سوءاستفاده ممکن است مدت کوتاهی بیشتر نگه داشته شود.',
        ],
      },
      {
        id: 'rights',
        title: 'حقوق تو',
        paragraphs: ['هر زمان میتوانی:'],
        bullets: [
          'پروفایلت را از صفحهی تنظیمات ببینی و ویرایش کنی.',
          'نام کاربری و تصویر پروفایلت را عوض کنی.',
          'حسابت را ببندی؛ کافی است به ما ایمیل بزنی.',
          'بپرسی چه اطلاعاتی از تو نگه داشتهایم و نسخهای از آن را بگیری.',
          'درخواست اصلاح یا حذف بخشی از اطلاعاتت را بدهی.',
        ],
      },
      {
        id: 'security',
        title: 'امنیت',
        paragraphs: [
          'رمز عبور فقط بهصورت هششده ذخیره میشود، ارتباط با سایت روی HTTPS انجام میشود و دسترسی به دادهها با کنترل دسترسی سطح ردیف (RLS) محدود شده است؛ یعنی هر کاربر فقط میتواند اطلاعات خودش را تغییر دهد.',
          'با این حال هیچ سرویسی صددرصد بیخطر نیست. اگر حساب مشکوک یا مشکلی دیدی، به ما اطلاع بده.',
        ],
      },
      {
        id: 'children',
        title: 'کودکان',
        paragraphs: [
          'شکارگاه برای کودکان زیر ۱۳ سال ساخته نشده و بهعمد اطلاعاتی از آنها جمعآوری نمیکنیم. اگر بفهمیم چنین حسابی ساخته شده، آن را حذف میکنیم.',
        ],
      },
      {
        id: 'changes',
        title: 'تغییرات این سیاست',
        paragraphs: [
          'اگر این سیاست تغییر کند، همین صفحه بهروز میشود و تاریخ «آخرین بهروزرسانی» بالا میرود. تغییرهای مهم از طریق خود سایت اطلاع داده میشوند.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    subtitle:
      'This page explains what Shekargah stores about you, why, who it is shared with and what rights you have. It is written in plain language on purpose.',
    updatedLabel: 'Last updated',
    contactTitle: 'Questions or requests?',
    contactBody: 'To access, correct or delete your information, or for any question about this policy, email us at',
    blocks: [
      {
        id: 'summary',
        title: 'Summary',
        paragraphs: [
          'Shekargah is an open-source showcase for discovering Iranian products. To let you sign up, submit a product and vote, we keep a small amount of information about you.',
          'We do not sell your information, we do not show personalised advertising, and we do not use analytics or behavioural trackers. What your browser stores is limited to your session, your display preferences and a random id that keeps repeat views from being counted twice.',
        ],
      },
      {
        id: 'what-we-collect',
        title: 'What we collect',
        paragraphs: ['We only take what the site needs to work:'],
        bullets: [
          'Account details: display name, username, email address, profile picture and bio. Passwords are never stored in plain text — only a hash of yours is kept.',
          'Signing in with Google or GitHub: when you use these, we receive only the public account id, email address, name and profile picture. Your Google or GitHub password never reaches us.',
          'Signing in with Telegram: your numeric Telegram id, your name, username and public profile photo are stored to create the account.',
          'Content you create: the products you submit, your votes, comments and reviews, ratings, collections, edit requests, reports, and the messages you send through the contact form or newsletter.',
          'A browser id: so a repeated visit is not counted as another view, a random id is generated and kept in your browser. It is not linked to your name, your IP address or your real identity.',
          'Technical logs: our hosting provider, like any hosting provider, may record IP addresses and requests in its security and anti-abuse logs.',
        ],
      },
      {
        id: 'cookies',
        title: 'Cookies and browser storage',
        paragraphs: ['Shekargah has no advertising cookies and no cross-site trackers. What is stored in your browser is only:'],
        bullets: [
          'Your sign-in token (session), so you stay signed in while you browse.',
          'Display preferences: light, dark or system theme.',
          'The random view id.',
        ],
      },
      {
        id: 'why',
        title: 'Why we keep it',
        bullets: [
          'To create and maintain your account and keep sign-in secure.',
          'To confirm your email address and let you reset your password.',
          'To show your public profile, the products you submitted, your votes and your reviews.',
          'To review submitted products before publishing them and to talk to you about their status.',
          'To notify you about votes, comments, reviews, new followers and new products.',
          'To prevent abuse: duplicate votes, bulk accounts and inappropriate content.',
          'To answer your messages and questions.',
        ],
      },
      {
        id: 'public',
        title: 'What is public',
        paragraphs: [
          'Your profile is public: display name, username, bio, the products you submitted, your votes, comments and reviews. If you fill in the public links in your settings (website, X, Telegram, LinkedIn, GitHub), those show on your profile as well.',
          'Your email address, Telegram id and sign-in details are never displayed publicly.',
        ],
      },
      {
        id: 'services',
        title: 'Service providers',
        paragraphs: [
          'We rely on the services below to run the site, and they only receive what they need. Nothing is sold and nothing is handed to anyone for advertising.',
        ],
        rows: [
          ['Supabase', 'Database, authentication, and storage for product and profile images'],
          ['Cloudflare', 'Site hosting, content delivery, and the Telegram bot worker'],
          ['Google', 'Sign-in with a Google account only (optional)'],
          ['GitHub', 'Sign-in with a GitHub account only (optional)'],
          ['Telegram', 'Telegram sign-in and Shekargah event notifications (optional)'],
        ],
      },
      {
        id: 'location',
        title: 'Where the data lives',
        paragraphs: [
          'These services run outside Iran, so your information may be stored in another country. By using Shekargah you agree to that transfer.',
        ],
      },
      {
        id: 'retention',
        title: 'How long we keep it',
        bullets: [
          'Your profile is kept for as long as your account is active.',
          'If you ask us to delete your account, the profile and the personal information attached to it are removed.',
          'Products you submitted may remain in the public catalogue with attribution after your account is deleted, because they have become part of the public content of the site.',
          'The minimum information needed to prevent abuse may be kept for a short while longer.',
        ],
      },
      {
        id: 'rights',
        title: 'Your rights',
        paragraphs: ['At any time you can:'],
        bullets: [
          'View and edit your profile from the settings page.',
          'Change your username and profile picture.',
          'Close your account — just email us.',
          'Ask what information we hold about you and get a copy.',
          'Ask us to correct or delete part of your information.',
        ],
      },
      {
        id: 'security',
        title: 'Security',
        paragraphs: [
          'Passwords are stored only as hashes, traffic to the site runs over HTTPS, and access to the data is restricted with row level security (RLS) — meaning each user can only modify their own records.',
          'That said, no service is perfectly safe. If you spot a suspicious account or a problem, tell us.',
        ],
      },
      {
        id: 'children',
        title: 'Children',
        paragraphs: [
          'Shekargah is not built for children under 13 and we do not knowingly collect their information. If we find such an account, we delete it.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to this policy',
        paragraphs: [
          'If this policy changes, this page is updated and the "Last updated" date above moves forward. Significant changes are announced on the site itself.',
        ],
      },
    ],
  },
}

export function PrivacyPage() {
  const [params, setParams] = useSearchParams()
  const lang = params.get('lang') === 'en' ? 'en' : 'fa'
  const content = CONTENT[lang]
  const isEnglish = lang === 'en'

  useDocumentMeta(content.title, content.subtitle, { path: '/privacy' })

  // The rest of the site is Persian and RTL; switch the document over while the
  // English version is on screen and put it back on the way out.
  useEffect(() => {
    const { documentElement } = document
    documentElement.lang = lang
    documentElement.dir = isEnglish ? 'ltr' : 'rtl'
    return () => {
      documentElement.lang = 'fa'
      documentElement.dir = 'rtl'
    }
  }, [lang, isEnglish])

  const select = (next: 'fa' | 'en') => {
    const query = new URLSearchParams()
    if (next === 'en') query.set('lang', 'en')
    setParams(query, { replace: true })
  }

  return (
    <section className={`mx-auto max-w-3xl space-y-6 ${isEnglish ? 'text-start' : ''}`} dir={isEnglish ? 'ltr' : 'rtl'}>
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <ShieldCheck size={22} strokeWidth={1.75} className="text-brand-600" aria-hidden />
            {content.title}
          </h1>
          <div
            role="group"
            aria-label="Language / زبان"
            className="flex w-max gap-1 rounded-full bg-sunken p-1"
          >
            {(
              [
                ['fa', 'فارسی'],
                ['en', 'English'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={lang === value}
                onClick={() => select(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  lang === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm leading-7 text-ink-muted">{content.subtitle}</p>
        <p className="mt-2 text-xs text-ink-faint">
          {content.updatedLabel}: {isEnglish ? 'November 8, 2026' : formatDate(UPDATED_AT)}
        </p>
      </header>

      <div className={`${cardClass} space-y-7 p-5 sm:p-7`}>
        {content.blocks.map((block, index) => (
          <div key={block.id} id={block.id} className="scroll-mt-24">
            <h2 className="text-base font-bold">
              <span className="text-ink-faint">{index + 1}.</span> {block.title}
            </h2>

            {block.paragraphs?.map((text) => (
              <p key={text} className="mt-2 text-sm leading-7 text-ink-muted">
                {text}
              </p>
            ))}

            {block.bullets && (
              <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm leading-7 text-ink-muted">
                {block.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}

            {block.rows && (
              <dl className="mt-3 divide-y divide-line/70 overflow-hidden rounded-control border border-line/70">
                {block.rows.map(([name, purpose]) => (
                  <div key={name} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                    <dt className="text-sm font-bold text-ink">{name}</dt>
                    <dd className="text-sm leading-7 text-ink-muted">{purpose}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      <div className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Mail size={18} strokeWidth={1.75} aria-hidden />
          {content.contactTitle}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {content.contactBody}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={`ltr inline-block ${linkClass}`} dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {isEnglish ? 'You can also reach us from the ' : 'از '}
          <Link to="/contact" className={linkClass}>
            {isEnglish ? 'contact page' : 'صفحهی تماس'}
          </Link>
          {isEnglish ? '. For a quick overview of the site, see the ' : ' هم میتوانی پیام بدهی. برای آشنایی سریع با سایت، '}
          <Link to="/help" className={linkClass}>
            {isEnglish ? 'help page' : 'صفحهی راهنما'}
          </Link>
          {isEnglish ? '.' : ' را ببین.'}
        </p>
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-ink-faint">
        <Lock size={13} strokeWidth={1.75} aria-hidden />
        <FileText size={13} strokeWidth={1.75} aria-hidden />
        {isEnglish
          ? 'Shekargah is open source; you can read the code behind these claims.'
          : 'شکارگاه متنباز است؛ میتوانی کدی را که پشت این توضیحهاست ببینی.'}
      </p>
    </section>
  )
}

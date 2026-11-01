import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BookOpen, Check, Heart, Mail, Rocket, Users } from 'lucide-react'
import { env } from '@/lib/env'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { ContactForm } from '@/components/contact/ContactForm'
import { cardClass } from '@/components/ui/styles'

const CONTACT_EMAIL = 'mmhdishafiee@gmail.com'
const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline'

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">{subtitle}</p>
      </header>
      {children}
    </section>
  )
}

function InfoCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${cardClass} p-5 sm:p-6`}>
      <h2 className="flex items-center gap-2 text-base font-bold">
        {icon}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-ink-muted">{children}</div>
    </div>
  )
}

export function HelpPage() {
  useDocumentMeta('راهنما', 'راهنمای استفاده از شکارگاه: حساب، معرفی محصول، رأی، ذخیره و پروفایل.', { path: '/help' })
  return (
    <PageShell
      title="راهنمای شکارگاه"
      subtitle="شکارگاه سه کار اصلی دارد: کشف محصول تازه، رأی دادن به بهترین‌ها و معرفی محصول خودت. اینجا قدم‌به‌قدم با هر بخش آشنا می‌شوی."
    >
      <InfoCard title="ساخت حساب و ورود" icon={<Users size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          برای رأی دادن، ذخیره‌کردن و معرفی محصول باید حساب داشته باشی. از{' '}
          <Link to="/signup" className={linkClass}>
            صفحه‌ی ثبت‌نام
          </Link>{' '}
          با ایمیل حساب بساز. لینک تأیید به ایمیلت می‌رود؛ بعد از تأیید می‌توانی وارد شوی.
        </p>
        <p>رمزت را فراموش کردی؟ در صفحه‌ی ورود روی «رمزت را فراموش کرده‌ای؟» بزن تا لینک بازیابی بگیری.</p>
      </InfoCard>

      <InfoCard title="سازنده و شکارچی چه تفاوتی دارند؟" icon={<Rocket size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          <b className="text-ink">سازنده</b> کسی است که محصول را ساخته. <b className="text-ink">شکارچی</b> کسی است که محصول را کشف
          و در شکارگاه معرفی می‌کند، حتی اگر خودش آن را نساخته باشد.
        </p>
        <p>
          در صفحه‌ی هر محصول، هر دو نقش جدا نمایش داده می‌شوند. اگر محصولی را معرفی کردی که سازنده‌اش تو نیستی، آن را به‌عنوان
          شکارچی ثبت کن.
        </p>
      </InfoCard>

      <InfoCard title="معرفی محصول" icon={<Rocket size={18} strokeWidth={1.75} aria-hidden />}>
        <ol className="list-decimal space-y-2 ps-5">
          <li>از دکمه‌ی «معرفی محصول» به فرم ارسال برو.</li>
          <li>نام، تگلاین، توضیح، آدرس سایت و لوگو را وارد کن.</li>
          <li>نسبت خودت را انتخاب کن: سازنده یا شکارچی.</li>
          <li>بعد از ارسال، تیم شکارگاه محصول را بررسی می‌کند و در صورت تأیید منتشر می‌شود.</li>
        </ol>
        <ButtonLink to="/submit" size="sm" className="mt-1">
          معرفی محصول
        </ButtonLink>
      </InfoCard>

      <InfoCard title="رأی، نقد و ذخیره" icon={<Heart size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          هر کاربر به هر محصول یک رأی می‌دهد. رأی‌ها تعیین می‌کنند کدام محصول در جدول روز، هفته، ماه و سال بالا بیاید. با
          دکمه‌ی ذخیره می‌توانی محصول را برای بعد نگه داری؛ همه‌ی آن‌ها در صفحه‌ی «ذخیره‌شده‌ها» هستند.
        </p>
        <p>نقد و امتیاز هم می‌توانی بنویسی. نقدها به بقیه کمک می‌کنند تصمیم بگیرند.</p>
      </InfoCard>

      <InfoCard title="قوانین و گزارش" icon={<Check size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          محصول تکراری، تبلیغ فریب‌دهنده یا محتوای نامناسب حذف می‌شود. اگر موردی دیدی، از دکمه‌ی «گزارش» در صفحه‌ی محصول
          اطلاع بده.
        </p>
        <p>
          پرسش دیگری داری؟{' '}
          <Link to="/faq" className={linkClass}>
            سوالات متداول
          </Link>{' '}
          یا{' '}
          <Link to="/contact" className={linkClass}>
            تماس با ما
          </Link>
          .
        </p>
      </InfoCard>
    </PageShell>
  )
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'شکارگاه چیست؟',
    a: 'شکارگاه یک ویترین فارسی برای کشف محصولات، استارتاپ‌ها، اپلیکیشن‌ها و پروژه‌های متن‌باز ایرانی است. هر روز محصول تازه اضافه می‌شود و کاربران به بهترین‌ها رأی می‌دهند.',
  },
  {
    q: 'ثبت‌نام و استفاده رایگان است؟',
    a: 'بله. کشف، رأی دادن، ذخیره‌کردن و معرفی محصول رایگان است.',
  },
  {
    q: 'چطور حساب بسازم؟',
    a: (
      <>
        از{' '}
        <Link to="/signup" className={linkClass}>
          صفحه‌ی ثبت‌نام
        </Link>{' '}
        با ایمیل حساب بساز و لینکت را تأیید کن. ورود با گوگل و گیت‌هاب هم در دسترس است.
      </>
    ),
  },
  {
    q: 'رمز عبورم را فراموش کرده‌ام، چه کنم؟',
    a: 'در صفحه‌ی ورود روی «رمزت را فراموش کرده‌ای؟» بزن و ایمیلت را وارد کن. لینک انتخاب رمز تازه برایت فرستاده می‌شود.',
  },
  {
    q: 'محصولم چرا هنوز منتشر نشده؟',
    a: 'هر محصول پیش از انتشار بررسی می‌شود تا کیفیت و اصالت حفظ شود. معمولاً بررسی سریع انجام می‌شود؛ وضعیت محصولت را در داشبورد ببین.',
  },
  {
    q: 'تفاوت سازنده و شکارچی چیست؟',
    a: 'سازنده محصول را ساخته است؛ شکارچی محصول را کشف و معرفی کرده است. هر دو در صفحه‌ی محصول و پروفایل نمایش داده می‌شوند.',
  },
  {
    q: 'یک محصول را چند بار می‌توانم رأی بدهم؟',
    a: 'هر کاربر به هر محصول یک رأی دارد. می‌توانی رأیت را برداری، اما رأی تکراری ثبت نمی‌شود.',
  },
  {
    q: 'می‌توانم محصولی را که مال من نیست معرفی کنم؟',
    a: 'بله، به‌عنوان شکارچی. فقط مطمئن شو محصول واقعاً وجود دارد و اطلاعاتش درست است.',
  },
  {
    q: 'چطور محصولی را گزارش کنم؟',
    a: 'در صفحه‌ی محصول دکمه‌ی «گزارش» را بزن و دلیل را انتخاب کن. تیم بررسی می‌کند.',
  },
  {
    q: 'چطور با شکارگاه همکاری یا حمایت کنم؟',
    a: (
      <>
        صفحه‌ی{' '}
        <Link to="/sponsor" className={linkClass}>
          حامی شکارگاه شوید
        </Link>{' '}
        را ببین یا از{' '}
        <Link to="/contact" className={linkClass}>
          تماس با ما
        </Link>{' '}
        پیام بده.
      </>
    ),
  },
]

export function FaqPage() {
  useDocumentMeta('سوالات متداول', 'پاسخ پرسش‌های رایج درباره‌ی حساب، معرفی محصول، رأی و حمایت از شکارگاه.', { path: '/faq' })
  return (
    <PageShell title="سوالات متداول" subtitle="پاسخ کوتاه پرسش‌هایی که بیشتر پرسیده می‌شود. اگر جوابت را پیدا نکردی، از تماس با ما بپرس.">
      <div className={`${cardClass} divide-y divide-line/70`}>
        {FAQ.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-ink-faint transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <div className="mt-2 text-sm leading-7 text-ink-muted">{item.a}</div>
          </details>
        ))}
      </div>
      <p className="text-center text-sm text-ink-muted">
        جوابت را پیدا نکردی؟{' '}
        <Link to="/contact" className={linkClass}>
          با ما تماس بگیر
        </Link>
        .
      </p>
    </PageShell>
  )
}

export function ContactPage() {
  useDocumentMeta('تماس با ما', 'راه‌های ارتباط با تیم شکارگاه برای پرسش، گزارش و همکاری.', { path: '/contact' })
  return (
    <PageShell title="تماس با ما" subtitle="برای پرسش، گزارش محتوا، همکاری یا حمایت از شکارگاه از راه‌های زیر پیام بده. تلاش می‌کنیم سریع جواب بدهیم.">
      <ContactForm />

      <InfoCard title="ایمیل" icon={<Mail size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          سریع‌ترین راه، ایمیل است:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={`ltr inline-block ${linkClass}`} dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-[13px] text-ink-faint">برای گزارش محصول یا محتوای نامناسب، لینک صفحه و توضیح کوتاه را هم بفرست.</p>
      </InfoCard>

      <InfoCard title="گزارش از داخل سایت" icon={<Check size={18} strokeWidth={1.75} aria-hidden />}>
        <p>
          اگر محتوای نامناسبی دیدی، لازم نیست ایمیل بزنی: در صفحه‌ی همان محصول دکمه‌ی «گزارش» را بزن. گزارش مستقیم به تیم
          می‌رسد.
        </p>
      </InfoCard>

      {env.repositoryUrl && (
        <InfoCard title="کد منبع و مشارکت" icon={<BookOpen size={18} strokeWidth={1.75} aria-hidden />}>
          <p>شکارگاه متن‌باز است؛ می‌توانی کد را ببینی، ایراد گزارش کنی یا مشارکت کنی.</p>
          <a href={env.repositoryUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            مخزن کد در گیت‌هاب
          </a>
        </InfoCard>
      )}

      <InfoCard title="حمایت و همکاری" icon={<Heart size={18} strokeWidth={1.75} aria-hidden />}>
        <p>برای حمایت از شکارگاه یا همکاری تجاری، صفحه‌ی حامیان را ببین یا مستقیم ایمیل بزن.</p>
        <ButtonLink to="/sponsor" size="sm">
          حامی شکارگاه شوید
        </ButtonLink>
      </InfoCard>
    </PageShell>
  )
}

const PACKAGES = [
  { title: 'حامی سایدبار', text: 'کارت برند شما در ستون کنار صفحه‌ی اصلی، جایی که هر روز بازدیدکنندگان تازه می‌بینند.' },
  { title: 'حامی خبرنامه', text: 'معرفی کوتاه برند شما در خبرنامه‌ی هفتگی محصولات تازه.' },
  { title: 'حامی صفحه‌ی محصول', text: 'حضور برند در صفحه‌ی محصولات پرطرفدار، دقیقاً جایی که کاربر در حال تصمیم‌گیری است.' },
  { title: 'همکاری محتوایی', text: 'نوشته‌ی معرفی یا گفت‌وگو در وبلاگ شکارگاه، با حفظ صداقت و شفافیت.' },
]

export function SponsorPage() {
  useDocumentMeta('حامی شکارگاه شوید', 'شکارگاه را حمایت کنید و برندتان را به جامعه‌ی سازندگان و کشف‌کنندگان ایرانی معرفی کنید.', { path: '/sponsor' })
  return (
    <PageShell
      title="حامی شکارگاه شوید"
      subtitle="شکارگاه هر روز میزبان سازندگان، کشف‌کنندگان و سرمایه‌گذاران ایرانی است. حمایت شما کمک می‌کند سایت مستقل و رایگان بماند و برندتان را دقیقاً به همین جامعه معرفی می‌کند."
    >
      <div className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="text-base font-bold">مخاطب شکارگاه کیست؟</h2>
        <ul className="mt-3 grid gap-2 text-sm leading-7 text-ink-muted sm:grid-cols-2">
          <li className="flex gap-2">
            <Check size={16} className="mt-1.5 shrink-0 text-brand-700" aria-hidden /> سازندگان محصول و استارتاپ
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-1.5 shrink-0 text-brand-700" aria-hidden /> توسعه‌دهندگان و تیم‌های فنی
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-1.5 shrink-0 text-brand-700" aria-hidden /> علاقه‌مندان به ابزارهای تازه
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-1.5 shrink-0 text-brand-700" aria-hidden /> سرمایه‌گذاران و فعالان اکوسیستم
          </li>
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PACKAGES.map((item) => (
          <div key={item.title} className={`${cardClass} p-5`}>
            <h2 className="text-sm font-bold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-muted">{item.text}</p>
          </div>
        ))}
      </div>

      <div className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="text-base font-bold">چطور شروع کنیم؟</h2>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          کافی است ایمیل بزنی و بگویی چه نوع محصولی داری. بسته‌ها را با توجه به هدف و بودجه‌ات تنظیم می‌کنیم و شفاف می‌گوییم
          چه چیزی تحویل می‌گیری.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('حمایت از شکارگاه')}`}
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-medium text-on-brand hover:bg-brand-700"
          >
            <Mail size={16} strokeWidth={1.75} aria-hidden /> ایمیل به تیم شکارگاه
          </a>
          <ButtonLink to="/contact" variant="secondary">
            صفحه‌ی تماس
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  )
}
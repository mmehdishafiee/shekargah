import { Code2, ExternalLink, Globe, Heart, Package, Rocket, ShieldCheck, Sparkles } from 'lucide-react'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { formatNumber } from '@/lib/format'
import { env } from '@/lib/env'
import { ButtonLink } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/styles'

const RULES = [
  'محصول باید واقعی و قابل استفاده باشد و لینکش به خود محصول برسد.',
  'اگر محصول را خودت ساخته‌ای، به‌عنوان سازنده معرفی کن؛ اگر آن را پیدا کرده‌ای، به‌عنوان شکارچی ثبتش کن.',
  'توضیحات باید روشن و صادقانه باشد؛ ادعای اغراق‌آمیز و اطلاعات گمراه‌کننده پذیرفته نمی‌شود.',
  'محصولات غیرقانونی، کلاهبرداری، قمار و محتوای توهین‌آمیز منتشر نمی‌شوند.',
  'هر محصول یک بار ثبت شود. ارسال تکراری رد می‌شود.',
]

const ROLES = [
  {
    icon: Rocket,
    title: 'سازنده',
    text: 'محصولی که خودت ساخته‌ای را معرفی می‌کنی، صفحه‌ی محصول و آمار رأی و نظر را می‌بینی و به پرسش‌ها پاسخ می‌دهی.',
  },
  {
    icon: Sparkles,
    title: 'شکارچی',
    text: 'محصولی را که خودت نساخته‌ای ولی کشف کرده‌ای ثبت می‌کنی. نام سازنده‌ی واقعی روی محصول می‌ماند و نام تو به‌عنوان شکارچی ثبت می‌شود.',
  },
  {
    icon: Heart,
    title: 'کاربر',
    text: 'کشف می‌کنی، رأی می‌دهی، نقد می‌نویسی، ذخیره می‌کنی و محصول‌های موردعلاقه‌ات را دنبال می‌کنی.',
  },
]

const STEPS = [
  { title: 'حساب بساز', text: 'با ایمیل ثبت‌نام کن تا بتوانی رأی بدهی، ذخیره کنی و محصول معرفی کنی.' },
  { title: 'کشف کن و رأی بده', text: 'محصولات تازه را ببین، به بهترین‌ها رأی بده و نظر و امتیاز بنویس.' },
  { title: 'خودت هم معرفی کن', text: 'محصولی ساخته‌ای یا کشف کرده‌ای؟ معرفی‌اش کن تا بعد از بررسی منتشر شود.' },
]

export function AboutPage() {
  useDocumentMeta('درباره‌ی شکارگاه', 'شکارگاه چیست، متن‌باز بودنش، سازنده‌اش و قوانین ثبت محصول.')
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold">درباره‌ی شکارگاه</h1>
        <p className="mt-3 text-[15px] leading-8 text-ink-muted">
          شکارگاه ویترین محصولات تازه‌ی سازندگان ایرانی است: استارتاپ‌ها، وب‌سایت‌ها، اپلیکیشن‌ها، پروژه‌های متن‌باز و
          ابزارهای برنامه‌نویسی. هر روز محصول‌های تازه اینجا رونمایی می‌شوند، جامعه به آن‌ها رأی می‌دهد و بهترین‌ها بالای
          فهرست می‌ایستند.
        </p>
      </header>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">شکارگاه چطور کار می‌کند؟</h2>
        <ol className="mt-5 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                {formatNumber(index + 1)}
              </span>
              <div>
                <p className="font-bold">{step.title}</p>
                <p className="mt-0.5 text-[14px] leading-7 text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">سه نقش در شکارگاه</h2>
        <p className="mt-2 text-sm text-ink-muted">یک حساب می‌تواند هم‌زمان چند نقش داشته باشد.</p>
        <ul className="mt-5 space-y-4">
          {ROLES.map((role) => (
            <li key={role.title} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <role.icon size={19} strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className="font-bold">{role.title}</p>
                <p className="mt-0.5 text-[14px] leading-7 text-ink-muted">{role.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Package size={18} strokeWidth={2} className="text-brand-600" aria-hidden />
          متن‌باز است
        </h2>
        <p className="mt-3 text-[15px] leading-7">
          کد شکارگاه متن‌باز است. هر کسی می‌تواند آن را بخواند، اشکال را گزارش کند یا بهبود بدهد. اگر ایده یا پیشنهادی داری،
          خوشحال می‌شویم بشنویم. شکارگاه غیرتجاری است و برای جامعه‌ی سازندگان ایرانی ساخته شده؛ اما برای پوشش هزینه‌های
          توسعه و نگهداری، از راه حمایت‌های مالی درآمد جذب می‌کند و همان درآمد را دوباره خرج خودش می‌کند تا مستقل بماند.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {env.repositoryUrl && (
            <a
              href={env.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken"
            >
              <Code2 size={17} strokeWidth={1.75} aria-hidden />
              کد منبع در گیت‌هاب
              <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
            </a>
          )}
          <ButtonLink to="/blog" variant="secondary">
            وبلاگ شکارگاه
          </ButtonLink>
        </div>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">قوانین ثبت محصول</h2>
        <ul className="mt-4 list-disc space-y-2.5 ps-5 text-[15px] leading-7 marker:text-brand-600">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck size={18} strokeWidth={2} className="text-success-700" aria-hidden />
          رأی، نقد و نظارت
        </h2>
        <p className="mt-3 text-[15px] leading-7">
          هر کاربر به هر محصول فقط یک رأی می‌دهد و می‌تواند رأیش را پس بگیرد. هر کس می‌تواند یک نقد با امتیاز ۱ تا ۵ بنویسد.
          نظرها باید محترمانه و مرتبط با محصول باشند. اگر محصول یا نظری را نامناسب دیدی، با دکمه‌ی «گزارش» به مدیران خبر بده.
          محصول‌های تأییدشده با نشان «بررسی‌شده توسط انسان» مشخص می‌شوند.
        </p>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">این پروژه از کجاست؟</h2>
        <div className="mt-4 space-y-5 text-[15px] leading-7">
          <div className="flex gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
              <Globe size={19} strokeWidth={1.75} aria-hidden />
            </span>
            <p>
              شکارگاه توسط <span className="font-bold">محمد مهدی شفیعی</span> ساخته شده است. نوشته‌ها و پروژه‌های دیگرش را
              می‌توانی در{' '}
              <a href="https://mmehdi.ir" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
                mmehdi.ir
              </a>{' '}
              ببینی.
            </p>
          </div>
          <div className="flex gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
              <Rocket size={19} strokeWidth={1.75} aria-hidden />
            </span>
            <p>
              این سایت یکی از محصولات{' '}
              <a href="https://leepaak.ir" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
                لیپک
              </a>{' '}
              است؛ استودیویی که روی ساخت محصولات وب سریع و بومی برای کاربران فارسی‌زبان کار می‌کند.
            </p>
          </div>
        </div>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">بیشتر بدان</h2>
        <p className="mt-2 text-sm text-ink-muted">اگر پرسشی داری یا می‌خواهی از شکارگاه حمایت کنی، از این صفحه‌ها شروع کن.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink to="/help" variant="secondary">
            راهنما
          </ButtonLink>
          <ButtonLink to="/faq" variant="secondary">
            سوالات متداول
          </ButtonLink>
          <ButtonLink to="/contact" variant="secondary">
            تماس با ما
          </ButtonLink>
          <ButtonLink to="/sponsor" variant="secondary">
            حامی شکارگاه شوید
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}
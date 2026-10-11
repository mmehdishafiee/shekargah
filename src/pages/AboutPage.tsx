import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { env } from '@/lib/env'
import { ButtonLink } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/styles'

const RULES = [
  'محصول باید واقعی و قابل استفاده باشد و لینکش به خود محصول برسد.',
  'سازنده یا عضو تیم محصول باشید، یا محصولی را معرفی کنید که اطلاعاتش دقیق است.',
  'توضیحات باید روشن و صادقانه باشد؛ ادعای اغراق‌آمیز و اطلاعات گمراه‌کننده پذیرفته نمی‌شود.',
  'محصولات غیرقانونی، کلاهبرداری، قمار و محتوای توهین‌آمیز منتشر نمی‌شوند.',
  'هر محصول یک بار ثبت شود. ارسال تکراری رد می‌شود.',
]

export function AboutPage() {
  useDocumentMeta('درباره و قوانین', 'شکارگاه چیست، محصولات چطور منتشر می‌شوند و قوانین ثبت محصول و نظر.')
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold">درباره‌ی شکارگاه</h1>
        <p className="mt-3 text-[15px] leading-8 text-ink-muted">
          شکارگاه جایی است برای پیدا کردن محصولات تازه‌ی ایرانی: استارتاپ‌ها، وب‌سایت‌ها، اپلیکیشن‌ها، پروژه‌های متن‌باز و
          ابزارهای برنامه‌نویسی. سازنده‌ها محصولشان را معرفی می‌کنند، مدیران آن را بررسی می‌کنند و بعد از انتشار، کاربران با
          رأی و نظرشان بهترین‌ها را بالا می‌آورند. شکارگاه متن‌باز و غیرتجاری است.
        </p>
      </header>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">قوانین ثبت محصول</h2>
        <ul className="mt-4 list-disc space-y-2.5 ps-5 text-[15px] leading-7 marker:text-brand-600">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={`${cardClass} p-5 sm:p-7`}>
        <h2 className="text-lg font-bold">رأی و نظر</h2>
        <p className="mt-3 text-[15px] leading-7">
          هر کاربر به هر محصول فقط یک رأی می‌دهد و می‌تواند رأیش را پس بگیرد. نظرها باید محترمانه و مرتبط با محصول باشند. اگر محصول
          یا نظری را نامناسب دیدی، با دکمه‌ی «گزارش» به مدیران خبر بده. مدیران محتوای خلاف قوانین را حذف یا از فهرست خارج می‌کنند و همه‌ی این
          اقدام‌ها با نام مدیر و زمان ثبت می‌شود.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/submit">معرفی محصول</ButtonLink>
        {env.repositoryUrl && (
          <a
            href={env.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken"
          >
            کد منبع در گیت‌هاب
          </a>
        )}
      </div>
    </div>
  )
}

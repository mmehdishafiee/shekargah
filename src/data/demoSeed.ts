import type { Category, ProductStatus, ReportReason, ReportStatus, Role, Tag } from './types'

/**
 * Sample data for demo mode. Every product, person and address here is
 * fictional; websites point at example.com on purpose.
 */

export interface DemoUser {
  id: string
  email: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  role: Role
  createdAt: string
}

export interface DemoProduct {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  websiteUrl: string
  logoUrl: string | null
  categoryId: string
  makerId: string
  status: ProductStatus
  moderationNote: string | null
  moderatedBy: string | null
  moderatedAt: string | null
  publishedAt: string | null
  votesCount: number
  commentsCount: number
  viewsCount: number
  createdAt: string
}

export interface DemoVote {
  userId: string
  productId: string
  createdAt: string
}

export interface DemoSave {
  userId: string
  productId: string
  createdAt: string
}

export interface DemoProductView {
  productId: string
  viewerKey: string
  createdAt: string
}

export type DemoTag = Tag

export interface DemoProductTag {
  productId: string
  tagId: string
}

export interface DemoComment {
  id: string
  productId: string
  authorId: string
  body: string
  createdAt: string
}

export interface DemoReport {
  id: string
  reporterId: string
  productId: string | null
  commentId: string | null
  reason: ReportReason
  details: string | null
  status: ReportStatus
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface DemoState {
  version: 2
  users: DemoUser[]
  categories: Category[]
  tags: Tag[]
  productTags: DemoProductTag[]
  products: DemoProduct[]
  votes: DemoVote[]
  comments: DemoComment[]
  reports: DemoReport[]
  saved: DemoSave[]
  views: DemoProductView[]
  sessionUserId: string | null
}

export const DEMO_ADMIN_EMAIL = 'admin@demo.shekargah'
export const DEMO_USER_EMAIL = 'sara@demo.shekargah'

const CATEGORIES: [string, string, string][] = [
  ['web-apps', 'وب‌اپلیکیشن', 'محصولاتی که در مرورگر اجرا می‌شوند.'],
  ['mobile-apps', 'اپلیکیشن موبایل', 'اپ‌های اندروید و iOS.'],
  ['desktop-apps', 'نرم‌افزار دسکتاپ', 'برنامه‌های ویندوز، مک و لینوکس.'],
  ['open-source', 'متن‌باز', 'پروژه‌هایی که کدشان در دسترس همه است.'],
  ['developer-tools', 'ابزار برنامه‌نویسان', 'کتابخانه‌ها، فریم‌ورک‌ها و ابزارهای توسعه.'],
  ['apis', 'API و زیرساخت', 'سرویس‌های ابری، API و زیرساخت نرم‌افزاری.'],
  ['online-services', 'سرویس آنلاین', 'فروشگاه‌ها، پلتفرم‌ها و خدمات اینترنتی.'],
  ['productivity', 'بهره‌وری', 'ابزارهای مدیریت کار، یادداشت و همکاری تیمی.'],
  ['education', 'آموزش', 'پلتفرم‌ها و ابزارهای یادگیری.'],
  ['fintech', 'مالی و پرداخت', 'پرداخت، حسابداری و مدیریت مالی.'],
  ['design', 'طراحی', 'ابزارها و منابع طراحی.'],
  ['ai', 'هوش مصنوعی', 'محصولاتی که هسته‌ی اصلی‌شان هوش مصنوعی است.'],
]

const USERS: [string, string, string, string, string | null, Role][] = [
  ['u-admin', DEMO_ADMIN_EMAIL, 'admin', 'مدیر شکارگاه', 'حساب نمایشی مدیر برای دیدن پنل مدیریت.', 'admin'],
  ['u-sara', DEMO_USER_EMAIL, 'sara', 'سارا احمدی', 'طراح محصول و عاشق ابزارهای کوچک و دقیق.', 'user'],
  ['u-amir', 'amir@demo.shekargah', 'amir_dev', 'امیر کاظمی', 'برنامه‌نویس بک‌اند. روی پروژه‌های متن‌باز کار می‌کنم.', 'user'],
  ['u-neda', 'neda@demo.shekargah', 'neda', 'ندا رستمی', 'بنیان‌گذار یک استارتاپ آموزشی کوچک.', 'user'],
  ['u-reza', 'reza@demo.shekargah', 'reza_m', 'رضا موسوی', null, 'user'],
  ['u-mina', 'mina@demo.shekargah', 'mina', 'مینا صادقی', 'توسعه‌دهنده‌ی موبایل.', 'user'],
]

type SeedProduct = [
  slugName: string,
  tagline: string,
  description: string,
  category: string,
  maker: string,
  votes: number,
  daysAgo: number,
  status?: ProductStatus,
  note?: string,
]

const PRODUCTS: SeedProduct[] = [
  [
    'جلالی‌کیت',
    'کتابخانه‌ی سبک و متن‌باز تاریخ شمسی برای جاوااسکریپت',
    'جلالی‌کیت تبدیل تاریخ میلادی و شمسی، قالب‌بندی و محاسبه‌ی فاصله‌ی تاریخ‌ها را بدون وابستگی اضافه انجام می‌دهد. حجمش کمتر از ۳ کیلوبایت است و با TypeScript نوشته شده.\n\nبرای فرم‌ها، گزارش‌ها و هر جایی که کاربر ایرانی تاریخ می‌بیند مناسب است.',
    'open-source',
    'u-amir',
    214,
    2,
  ],
  [
    'رصدگر',
    'پایش در دسترس بودن سایت با هشدار تلگرامی و پیامکی',
    'رصدگر هر دقیقه سایت و API شما را از چند نقطه بررسی می‌کند و اگر پاسخ نیامد یا کند شد، در تلگرام یا با پیامک خبرتان می‌کند. صفحه‌ی وضعیت عمومی هم دارد تا کاربرانتان بدانند چه خبر است.',
    'apis',
    'u-reza',
    187,
    1,
  ],
  [
    'دفترچه',
    'یادداشت‌برداری آفلاین با همگام‌سازی رمزنگاری‌شده',
    'دفترچه یک برنامه‌ی یادداشت ساده است که اول برای کار بدون اینترنت ساخته شده. یادداشت‌ها روی دستگاه خودتان ذخیره می‌شوند و اگر بخواهید، به‌صورت رمزنگاری‌شده بین گوشی و لپ‌تاپ همگام می‌شوند. از راست‌چین و نیم‌فاصله پشتیبانی کامل دارد.',
    'productivity',
    'u-sara',
    176,
    3,
  ],
  [
    'پارسی‌نویس',
    'ویرایش خودکار نیم‌فاصله و نشانه‌گذاری متن فارسی',
    'متن را در پارسی‌نویس بچسبانید تا نیم‌فاصله‌ها، «ی» و «ک» عربی، اعداد و نشانه‌گذاری را اصلاح کند. افزونه‌ی مرورگر و نسخه‌ی خط فرمان هم دارد و کدش متن‌باز است.',
    'open-source',
    'u-amir',
    163,
    6,
  ],
  [
    'زبانچه',
    'یادگیری لغت انگلیسی با جعبه‌ی لایتنر و تلفظ صوتی',
    'زبانچه هر روز چند لغت تازه با مثال و تلفظ نشانتان می‌دهد و با روش لایتنر زمان مرور را خودش تنظیم می‌کند. بسته‌های لغت برای آزمون‌های رایج آماده است.',
    'education',
    'u-neda',
    149,
    4,
  ],
  [
    'اسکناس',
    'مدیریت هزینه‌های شخصی با دسته‌بندی خودکار پیامک‌های بانکی',
    'اسکناس پیامک‌های بانکی را می‌خواند، هزینه‌ها را دسته‌بندی می‌کند و آخر ماه نشانتان می‌دهد پولتان کجا رفته. همه‌ی پردازش روی گوشی انجام می‌شود و اطلاعاتی به سرور فرستاده نمی‌شود.',
    'fintech',
    'u-mina',
    132,
    8,
  ],
  [
    'نقشه‌راه',
    'مدیریت پروژه‌ی کانبان فارسی برای تیم‌های کوچک',
    'نقشه‌راه تخته‌ی کانبان، تقویم شمسی، گزارش زمان و یکپارچگی با گیت را در یک جا جمع کرده است. برای تیم‌های تا ده نفر رایگان است.',
    'web-apps',
    'u-sara',
    121,
    10,
  ],
  [
    'فونت‌خانه',
    'مجموعه‌ی فونت‌های فارسی آزاد با پیش‌نمایش زنده',
    'در فونت‌خانه فونت‌های فارسی با مجوز آزاد را می‌توانید کنار هم مقایسه کنید، متن خودتان را در آن‌ها ببینید و کد CSS آماده بردارید. مجوز هر فونت کنارش نوشته شده است.',
    'design',
    'u-sara',
    118,
    12,
  ],
  [
    'کدبان',
    'ویرایشگر کد سبک برای ویندوز با پشتیبانی درست از متن راست‌چین',
    'کدبان ویرایشگری سریع با بیش از ۴۰ زبان برنامه‌نویسی است که رشته‌ها و کامنت‌های فارسی را درست نمایش می‌دهد. حجم نصبش زیر ۲۰ مگابایت است.',
    'desktop-apps',
    'u-amir',
    97,
    5,
  ],
  [
    'میزبانک',
    'میزبانی رایگان سایت‌های استاتیک برای پروژه‌های دانشجویی',
    'مخزن گیت را وصل کنید تا میزبانک با هر push سایت را بسازد و منتشر کند. گواهی HTTPS خودکار و دامنه‌ی اختصاصی هم پشتیبانی می‌شود.',
    'apis',
    'u-reza',
    88,
    15,
  ],
  [
    'هم‌خوان',
    'باشگاه کتاب‌خوانی آنلاین با جلسه‌های گفت‌وگوی ماهانه',
    'در هم‌خوان با بقیه‌ی اعضا هر ماه یک کتاب می‌خوانید، یادداشت می‌گذارید و در جلسه‌ی آنلاین درباره‌اش حرف می‌زنید.',
    'online-services',
    'u-neda',
    76,
    1,
  ],
  [
    'سفارش‌یار',
    'منوی دیجیتال QR و ثبت سفارش برای کافه‌ها و رستوران‌ها',
    'سفارش‌یار منوی کافه را به یک صفحه‌ی وب سریع تبدیل می‌کند. مشتری QR را اسکن می‌کند، سفارش می‌دهد و سفارش مستقیم روی تبلت آشپزخانه می‌رسد.',
    'online-services',
    'u-mina',
    64,
    20,
  ],
  [
    'صداگیر',
    'تبدیل گفتار فارسی به متن برای جلسه‌ها و مصاحبه‌ها',
    'فایل صوتی جلسه را بارگذاری کنید تا صداگیر متن آن را با تفکیک گوینده تحویل بدهد. خروجی را می‌توانید ویرایش کنید و به‌صورت Word بگیرید.',
    'ai',
    'u-reza',
    59,
    7,
  ],
  [
    'گیت‌یار',
    'افزونه‌ی خط فرمان برای نوشتن پیام کامیت استاندارد',
    'گیت‌یار تغییرات stage‌شده را بررسی می‌کند و چند پیشنهاد پیام کامیت با قالب Conventional Commits می‌دهد. با bash، zsh و PowerShell کار می‌کند.',
    'developer-tools',
    'u-amir',
    47,
    0,
  ],
  [
    'قرارگاه',
    'نوبت‌دهی آنلاین برای مطب‌ها و آرایشگاه‌ها',
    'با قرارگاه مشتری‌ها از روی یک لینک نوبت می‌گیرند و یادآور پیامکی دریافت می‌کنند. تقویم شمسی و تعطیلات رسمی از قبل تنظیم شده است.',
    'mobile-apps',
    'u-mina',
    38,
    0,
  ],
  [
    'نقطه‌چین',
    'ساخت نمودار و دیاگرام با نوشتن متن ساده',
    'در نقطه‌چین با چند خط متن، فلوچارت و نمودار توالی بسازید و خروجی SVG بگیرید. برچسب‌های فارسی درست چیده می‌شوند.',
    'developer-tools',
    'u-sara',
    29,
    9,
  ],
  [
    'کارنما',
    'رزومه‌ساز دوزبانه با قالب‌های مناسب بازار کار ایران',
    'کارنما رزومه‌ی فارسی و انگلیسی را هم‌زمان می‌سازد و خروجی PDF تمیز تحویل می‌دهد.',
    'web-apps',
    'u-sara',
    0,
    0,
    'pending',
  ],
  [
    'شمارشگر',
    'آمار بازدید سایت بدون کوکی و سازگار با حریم خصوصی',
    'شمارشگر یک اسکریپت یک کیلوبایتی است که بازدیدها را بدون ذخیره‌ی اطلاعات شخصی می‌شمارد و داشبورد ساده‌ای نشان می‌دهد.',
    'apis',
    'u-amir',
    0,
    0,
    'pending',
  ],
  [
    'تخفیف‌بگیر',
    'جمع‌آوری کد تخفیف همه‌ی فروشگاه‌ها در یک صفحه',
    'تخفیف‌بگیر کدهای تخفیف را از سایت‌های مختلف جمع می‌کند.',
    'online-services',
    'u-reza',
    0,
    3,
    'rejected',
    'توضیحات کافی نیست و منبع کدهای تخفیف مشخص نشده است. لطفاً با توضیح کامل‌تر دوباره ارسال کنید.',
  ],
]

const COMMENTS: [product: string, author: string, body: string, hoursAgo: number][] = [
  ['جلالی‌کیت', 'u-sara', 'بالاخره یک کتابخانه‌ی شمسی که کل باندل را سنگین نمی‌کند. روی فرم ثبت‌نام امتحانش کردم و خوب کار کرد.', 30],
  ['جلالی‌کیت', 'u-reza', 'پشتیبانی از منطقه‌ی زمانی هم دارد؟ برای گزارش‌های سرور لازم دارم.', 20],
  ['جلالی‌کیت', 'u-amir', 'بله، از نسخه‌ی ۲ اضافه شده است. مثالش را در مستندات گذاشته‌ام.', 18],
  ['رصدگر', 'u-mina', 'هشدار تلگرامی خیلی به کارم آمد. یک بار نیمه‌شب سرور قطع شد و زود فهمیدم.', 12],
  ['دفترچه', 'u-neda', 'همگام‌سازی رمزنگاری‌شده برای من مهم‌ترین ویژگی است. نسخه‌ی لینوکس هم در راه است؟', 40],
  ['پارسی‌نویس', 'u-sara', 'افزونه‌ی مرورگرش را برای نوشتن ایمیل‌ها نصب کردم. نیم‌فاصله‌ها را دقیق درست می‌کند.', 100],
  ['زبانچه', 'u-mina', 'کاش امکان ساخت بسته‌ی لغت شخصی هم داشت.', 60],
]

const CATEGORY_IDS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(([slug], index) => [slug, `c-${String(index + 1).padStart(2, '0')}`]),
)

const TAGS: [string, string][] = [
  ['open-source','متن‌باز'],
  ['ai','هوش مصنوعی'],
  ['persian','فارسی'],
  ['mobile','موبایل'],
  ['web','وب'],
  ['api','API'],
  ['productivity','بهره‌وری'],
  ['education','آموزش'],
  ['fintech','مالی'],
  ['design','طراحی'],
  ['games','بازی'],
  ['health','سلامت'],
  ['ecommerce','فروشگاهی'],
  ['security','امنیت'],
  ['data','داده'],
  ['cloud','ابری'],
  ['devtools','ابزار توسعه‌دهندگان'],
  ['startup','استارتاپ'],
  ['utility','ابزارک'],
  ['content','محتوا'],
  ['automation','اتوماسیون'],
  ['privacy','حریم خصوصی'],
]

const TAG_IDS: Record<string, string> = Object.fromEntries(TAGS.map(([slug], index) => [slug, `t-${String(index + 1).padStart(2, '0')}`]))

export function createDemoState(now: Date = new Date()): DemoState {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600 * 1000).toISOString()

  const categories: Category[] = CATEGORIES.map(([slug, name, description], index) => ({
    id: CATEGORY_IDS[slug]!,
    slug,
    name,
    description,
    sortOrder: (index + 1) * 10,
    isActive: true,
  }))

  const users: DemoUser[] = USERS.map(([id, email, username, displayName, bio, role], index) => ({
    id,
    email,
    username,
    displayName,
    bio,
    avatarUrl: null,
    role,
    createdAt: ago(24 * (120 - index * 7)),
  }))

  const products: DemoProduct[] = PRODUCTS.map(
    ([name, tagline, description, category, maker, votes, daysAgo, status = 'published', note], index) => {
      const created = ago(daysAgo * 24 + 5 + index)
      const published = status === 'published' ? ago(daysAgo * 24 + index) : null
      return {
        id: `p-${String(index + 1).padStart(2, '0')}`,
        slug: name.replace(/\s+/g, '-'),
        name,
        tagline,
        description,
        websiteUrl: `https://example.com/${index + 1}`,
        logoUrl: null,
        categoryId: CATEGORY_IDS[category]!,
        makerId: maker,
        status,
        moderationNote: note ?? null,
        moderatedBy: status === 'pending' ? null : 'u-admin',
        moderatedAt: status === 'pending' ? null : (published ?? ago(daysAgo * 24)),
        publishedAt: published,
        votesCount: votes,
        commentsCount: 0,
        viewsCount: Math.max(12, votes + (index + 1) * 7),
        createdAt: created,
      }
    },
  )

  const comments: DemoComment[] = COMMENTS.map(([productName, authorId, body, hoursAgo], index) => {
    const product = products.find((p) => p.name === productName)!
    product.commentsCount += 1
    return { id: `m-${index + 1}`, productId: product.id, authorId, body, createdAt: ago(hoursAgo) }
  })

  const reports: DemoReport[] = [
    {
      id: 'r-1',
      reporterId: 'u-neda',
      productId: products.find((p) => p.name === 'سفارش‌یار')!.id,
      commentId: null,
      reason: 'misleading',
      details: 'نشانی وب‌سایت به صفحه‌ی دیگری می‌رود.',
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: ago(6),
    },
  ]

  const tags: Tag[] = TAGS.map(([slug, name]) => ({ id: TAG_IDS[slug]!, slug, name }))
  const productTags: DemoProductTag[] = products.flatMap((p, index) => {
    const mappings = [
      ['open-source','utility'],
      ['ai','automation'],
      ['productivity'],
      ['persian'],
      ['education'],
      ['fintech'],
      ['web','design'],
      ['devtools'],
      ['api'],
      ['web'],
      ['content'],
      ['ai'],
      ['utility'],
      ['security'],
      ['data'],
      ['devtools'],
    ]
    const slugs = mappings[index] ?? []
    return slugs.filter((slug) => TAG_IDS[slug]).map((slug) => ({ productId: p.id, tagId: TAG_IDS[slug]! }))
  })

  const views: DemoProductView[] = products.flatMap((p) => [
    { productId: p.id, viewerKey: `seed-${p.id}`, createdAt: ago(1) },
  ])

  return { version: 2, users, categories, tags, productTags, products, votes: [], comments, reports, saved: [], views, sessionUserId: null }
}

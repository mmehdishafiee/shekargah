import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { env } from '@/lib/env'
import { LogoMark } from '@/components/brand/Logo'
import { Header } from './Header'
import { ThemeToggle } from './ThemeToggle'

const COLUMNS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'کشف',
    links: [
      { to: '/', label: 'محصولات' },
      { to: '/today', label: 'محصولات امروز' },
      { to: '/trending', label: 'داغ‌ترین‌ها' },
      { to: '/leaderboard', label: 'جدول رتبه‌بندی' },
      { to: '/collections', label: 'مجموعه‌ها' },
    ],
  },
  {
    title: 'موضوع‌ها',
    links: [
      { to: '/topics', label: 'همه‌ی موضوع‌ها' },
      { to: '/?category=productivity', label: 'بهره‌وری' },
      { to: '/?category=ai', label: 'هوش مصنوعی' },
      { to: '/?category=open-source', label: 'متن‌باز' },
      { to: '/?category=fintech', label: 'مالی و پرداخت' },
    ],
  },
  {
    title: 'جامعه',
    links: [
      { to: '/makers', label: 'سازندگان برتر' },
      { to: '/companies', label: 'شرکت‌ها' },
      { to: '/blog', label: 'وبلاگ' },
      { to: '/about', label: 'درباره‌ی شکارگاه' },
      { to: '/help', label: 'راهنما' },
      { to: '/faq', label: 'سوالات متداول' },
      { to: '/contact', label: 'تماس با ما' },
      { to: '/changelog', label: 'تغییرات شکارگاه' },
    ],
  },
  {
    title: 'برای سازندگان',
    links: [
      { to: '/submit', label: 'معرفی محصول' },
      { to: '/dashboard', label: 'داشبورد من' },
      { to: '/feed', label: 'فید شما' },
      { to: '/sponsor', label: 'حامی شکارگاه' },
    ],
  },
]

function Footer() {
  return (
    <footer className="mt-16 border-t border-line/70 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <LogoMark size={26} />
              <span className="font-extrabold">شکارگاه</span>
            </div>
            <p className="text-[13px] leading-7 text-ink-muted">
              ویترین محصولات تازه‌ی سازندگان ایرانی. هر روز محصول تازه کشف کن، به بهترین‌ها رأی بده و محصول خودت را معرفی کن.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <ThemeToggle />
              <span className="text-xs text-ink-faint">حالت نمایش</span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-sm font-bold text-ink">{column.title}</p>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <Link to={link.to} className="text-[13px] text-ink-muted transition-colors hover:text-ink">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-line/70 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© شکارگاه — متن‌باز و غیرتجاری. ساخته‌شده برای جامعه‌ی سازندگان ایرانی.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to="/about" className="hover:text-ink">
              درباره‌ی ما
            </Link>
            <Link to="/blog" className="hover:text-ink">
              وبلاگ
            </Link>
            {env.repositoryUrl && (
              <a href={env.repositoryUrl} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                کد منبع
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

/** Sends users who opened a password recovery link to the reset form. */
function RecoveryRedirect() {
  const { passwordRecovery, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (passwordRecovery && location.pathname !== '/reset-password') {
      navigate('/reset-password', { replace: true })
      return
    }
    if (session) {
      const target = sessionStorage.getItem('shekargah:auth-target')
      if (target && target.startsWith('/') && !target.startsWith('//') && location.pathname === '/') {
        sessionStorage.removeItem('shekargah:auth-target')
        navigate(target, { replace: true })
      }
    }
  }, [passwordRecovery, session, location.pathname, navigate])
  return null
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 shadow-pop focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        رفتن به محتوای اصلی
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
      <RecoveryRedirect />
    </div>
  )
}

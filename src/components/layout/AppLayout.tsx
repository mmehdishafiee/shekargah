import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { env } from '@/lib/env'
import { LogoMark } from '@/components/brand/Logo'
import { Header } from './Header'

function Footer() {
  return (
    <footer className="mt-16 border-t border-line/70 bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span>شکارگاه، ویترین محصولات تازه‌ی ایرانی. متن‌باز و غیرتجاری.</span>
        </div>
        <nav aria-label="پیوندهای پانویس" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/about" className="hover:text-ink">
            درباره و قوانین
          </Link>
          <Link to="/today" className="hover:text-ink">
            امروز
          </Link>
          <Link to="/trending" className="hover:text-ink">
            داغ‌ترین‌ها
          </Link>
          <Link to="/leaderboard" className="hover:text-ink">
            جدول رتبه‌بندی
          </Link>
          <Link to="/submit" className="hover:text-ink">
            معرفی محصول
          </Link>
          {env.repositoryUrl && (
            <a href={env.repositoryUrl} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              کد منبع
            </a>
          )}
        </nav>
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
    <div className="flex min-h-dvh flex-col">
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

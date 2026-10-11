import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { resetDemoStorage } from '@/data/demoApi'
import { env } from '@/lib/env'
import { LogoMark } from '@/components/brand/Logo'
import { Header } from './Header'

function DemoBanner() {
  const reset = () => {
    resetDemoStorage()
    window.location.assign('/')
  }
  return (
    <div className="bg-ink text-[13px] text-white/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center">
        <span>حالت نمایشی: محصولات و افراد نمونه‌اند و تغییرات فقط در همین مرورگر ذخیره می‌شود.</span>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-semibold text-white underline-offset-4 hover:underline">
          <RotateCcw size={13} strokeWidth={2} aria-hidden />
          بازنشانی داده‌ها
        </button>
      </div>
    </div>
  )
}

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
  const { passwordRecovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (passwordRecovery && location.pathname !== '/reset-password') navigate('/reset-password', { replace: true })
  }, [passwordRecovery, location.pathname, navigate])
  return null
}

export function AppLayout() {
  const api = useApi()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 shadow-pop focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        رفتن به محتوای اصلی
      </a>
      {api.mode === 'demo' && <DemoBanner />}
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

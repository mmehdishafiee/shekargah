import { useId, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import { LogOut, Plus, Search, Settings, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { profilePath } from '@/lib/paths'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { Menu, menuItemClass } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/toast'

function SearchForm({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const inputId = useId()
  const current = location.pathname === '/' ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(current)
  const [synced, setSynced] = useState(current)
  if (current !== synced) {
    setSynced(current)
    setValue(current)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams(location.pathname === '/' ? params : undefined)
    if (value.trim()) next.set('q', value.trim())
    else next.delete('q')
    const query = next.toString()
    navigate(query ? `/?${query}` : '/')
  }

  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        جست‌وجوی محصولات
      </label>
      <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جست‌وجوی محصول…"
        className="h-10 w-full rounded-full border border-transparent bg-sunken ps-10 pe-4 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-brand-600 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-100"
      />
    </form>
  )
}

function UserMenu() {
  const { profile, isAdmin } = useAuth()
  const api = useApi()
  const navigate = useNavigate()
  const toast = useToast()
  if (!profile) return null

  const signOut = async () => {
    await api.signOut()
    toast.success('از حسابت خارج شدی.')
    navigate('/')
  }

  return (
    <Menu
      label="منوی حساب کاربری"
      triggerClassName="grid size-10 place-items-center rounded-full hover:bg-sunken"
      trigger={<Avatar name={profile.displayName} seed={profile.id} url={profile.avatarUrl} size={34} />}
    >
      {(close) => (
        <>
          <div className="border-b border-line/70 px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            <p className="ltr truncate text-start text-xs text-ink-muted">@{profile.username}</p>
          </div>
          <div className="pt-1.5">
            <Link to={profilePath(profile.username)} onClick={close} className={menuItemClass}>
              <User size={16} strokeWidth={1.75} aria-hidden />
              پروفایل و محصولات من
            </Link>
            <Link to="/settings" onClick={close} className={menuItemClass}>
              <Settings size={16} strokeWidth={1.75} aria-hidden />
              تنظیمات حساب
            </Link>
            {isAdmin && (
              <Link to="/admin" onClick={close} className={menuItemClass}>
                <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
                پنل مدیریت
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                close()
                void signOut()
              }}
              className={`${menuItemClass} text-danger-600`}
            >
              <LogOut size={16} strokeWidth={1.75} aria-hidden />
              خروج
            </button>
          </div>
        </>
      )}
    </Menu>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'}`

export function Header() {
  const { session, loading } = useAuth()

  return (
    <header
      className="sticky z-30 border-b border-line/70 bg-surface/85 backdrop-blur-md"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5">
        <Link to="/" aria-label="شکارگاه، صفحه‌ی اصلی" className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <SearchForm className="hidden max-w-xs flex-1 md:block" />
        <nav aria-label="پیمایش اصلی" className="hidden items-center lg:flex">
          <NavLink to="/" end className={navClass}>
            محصولات
          </NavLink>
          <NavLink to="/about" className={navClass}>
            درباره و قوانین
          </NavLink>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-control bg-sunken" aria-hidden />
          ) : session ? (
            <>
              <ButtonLink to="/submit" size="md" icon={<Plus size={18} strokeWidth={2} aria-hidden />} aria-label="معرفی محصول">
                <span className="hidden sm:inline">معرفی محصول</span>
              </ButtonLink>
              <UserMenu />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost">
                ورود
              </ButtonLink>
              <ButtonLink to="/signup">ثبت‌نام</ButtonLink>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchForm />
      </div>
    </header>
  )
}

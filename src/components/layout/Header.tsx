import { useId, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Bookmark, ChevronDown, LayoutDashboard, LogOut, Menu as MenuIcon, Plus, Search, Settings, ShieldCheck, Sparkles, User, X } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { useTopics } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { profilePath } from '@/lib/paths'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { Menu, menuItemClass } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/toast'
import { ThemeToggle } from './ThemeToggle'
import { NotificationsBell } from './NotificationsBell'

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
      <Search size={17} strokeWidth={1.75} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جست‌وجوی محصول، موضوع یا سازنده..."
        className="h-10 w-full rounded-full border border-transparent bg-sunken ps-10 pe-4 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-brand-600 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-500/40"
      />
    </form>
  )
}

const navTriggerClass =
  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink'

/** Grouped navigation: four dropdowns keep the header calm. */
function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const topics = useTopics()
  const hotTopics = (topics.data ?? []).filter((topic) => topic.productCount > 0).slice(0, 6)
  const after = (close: () => void) => {
    close()
    onNavigate?.()
  }

  return (
    <>
      <Menu label="محصولات" hover align="start" triggerClassName={navTriggerClass} trigger={<>محصولات<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}>
        {(close) => (
          <>
            <Link to="/" onClick={() => after(close)} className={menuItemClass}>
              همه‌ی محصولات
            </Link>
            <Link to="/today" onClick={() => after(close)} className={menuItemClass}>
              محصولات امروز
            </Link>
            <Link to="/trending" onClick={() => after(close)} className={menuItemClass}>
              داغ‌ترین‌ها
            </Link>
            <Link to="/leaderboard" onClick={() => after(close)} className={menuItemClass}>
              جدول رتبه‌بندی
            </Link>
            <Link to="/collections" onClick={() => after(close)} className={menuItemClass}>
              مجموعه‌ها
            </Link>
          </>
        )}
      </Menu>

      <Menu label="موضوع‌ها" hover align="start" triggerClassName={navTriggerClass} trigger={<>موضوع‌ها<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}>
        {(close) => (
          <>
            {hotTopics.map((topic) => (
              <Link key={topic.slug} to={`/?category=${encodeURIComponent(topic.slug)}`} onClick={() => after(close)} className={menuItemClass}>
                <span className="flex-1">{topic.name}</span>
                <span className="text-xs tabular-nums text-ink-muted">{formatNumber(topic.productCount)}</span>
              </Link>
            ))}
            <Link to="/topics" onClick={() => after(close)} className={`${menuItemClass} font-semibold text-brand-700`}>
              همه‌ی موضوع‌ها
            </Link>
          </>
        )}
      </Menu>

      <Menu label="جامعه" hover align="start" triggerClassName={navTriggerClass} trigger={<>جامعه<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}>
        {(close) => (
          <>
            <Link to="/makers" onClick={() => after(close)} className={menuItemClass}>
              سازندگان برتر
            </Link>
            <Link to="/companies" onClick={() => after(close)} className={menuItemClass}>
              شرکت‌ها
            </Link>
            <Link to="/feed" onClick={() => after(close)} className={menuItemClass}>
              <Sparkles size={16} strokeWidth={1.75} aria-hidden />
              فید شما
            </Link>
            <Link to="/about" onClick={() => after(close)} className={menuItemClass}>
              درباره‌ی شکارگاه
            </Link>
          </>
        )}
      </Menu>

      <Menu label="برای سازندگان" hover align="start" triggerClassName={navTriggerClass} trigger={<>برای سازندگان<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}>
        {(close) => (
          <>
            <Link to="/submit" onClick={() => after(close)} className={menuItemClass}>
              معرفی محصول
            </Link>
            <Link to="/dashboard" onClick={() => after(close)} className={menuItemClass}>
              داشبورد من
            </Link>
            <Link to="/blog" onClick={() => after(close)} className={menuItemClass}>
              وبلاگ
            </Link>
          </>
        )}
      </Menu>
    </>
  )
}

function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const { session } = useAuth()
  const groups: { title: string; links: { to: string; label: string }[] }[] = [
    {
      title: 'محصولات',
      links: [
        { to: '/', label: 'همه‌ی محصولات' },
        { to: '/today', label: 'محصولات امروز' },
        { to: '/trending', label: 'داغ‌ترین‌ها' },
        { to: '/leaderboard', label: 'جدول رتبه‌بندی' },
        { to: '/collections', label: 'مجموعه‌ها' },
      ],
    },
    {
      title: 'موضوع‌ها و جامعه',
      links: [
        { to: '/topics', label: 'همه‌ی موضوع‌ها' },
        { to: '/makers', label: 'سازندگان برتر' },
        { to: '/companies', label: 'شرکت‌ها' },
        { to: '/blog', label: 'وبلاگ' },
        { to: '/about', label: 'درباره‌ی شکارگاه' },
      ],
    },
    {
      title: 'برای سازندگان',
      links: [
        { to: '/submit', label: 'معرفی محصول' },
        { to: '/dashboard', label: 'داشبورد من' },
        { to: '/feed', label: 'فید شما' },
        { to: '/sponsor', label: 'حامی شکارگاه' },
        { to: '/help', label: 'راهنما' },
        { to: '/faq', label: 'سوالات متداول' },
        { to: '/contact', label: 'تماس با ما' },
      ],
    },
  ]
  if (session) {
    groups.push({
      title: 'حساب من',
      links: [
        { to: '/dashboard', label: 'داشبورد من' },
        { to: '/notifications', label: 'اعلان‌ها' },
        { to: '/saved', label: 'ذخیره‌شده‌ها' },
        { to: '/feed', label: 'فید شما' },
        { to: '/settings', label: 'تنظیمات حساب' },
      ],
    })
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-1 pb-1.5 text-xs font-bold text-ink-faint">{group.title}</p>
          <ul className="space-y-0.5">
            {group.links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-sunken" onClick={onNavigate}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
            <Link to="/dashboard" onClick={close} className={menuItemClass}>
              <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden />
              داشبورد من
            </Link>
            <Link to={profilePath(profile.username)} onClick={close} className={menuItemClass}>
              <User size={16} strokeWidth={1.75} aria-hidden />
              پروفایل و محصولات من
            </Link>
            <Link to="/saved" onClick={close} className={menuItemClass}>
              <Bookmark size={16} strokeWidth={1.75} aria-hidden />
              ذخیره‌شده‌ها
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

export function Header() {
  const { session, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header
      className="relative z-30 border-b border-line/70 bg-surface/85 backdrop-blur-md md:sticky"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-5 sm:px-4">
        <Link to="/" aria-label="شکارگاه، صفحه‌ی اصلی" className="shrink-0 rounded-lg">
          <Logo />
        </Link>

        <SearchForm className="hidden max-w-md flex-1 md:block" />

        <nav aria-label="پیمایش اصلی" className="hidden items-center lg:flex">
          <NavGroups />
        </nav>

        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-control bg-sunken" aria-hidden />
          ) : session ? (
            <>
              <ButtonLink to="/submit" size="md" icon={<Plus size={18} strokeWidth={2} aria-hidden />} aria-label="معرفی محصول">
                <span className="hidden sm:inline">معرفی محصول</span>
              </ButtonLink>
              <NotificationsBell />
              <UserMenu />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost">
                ورود
              </ButtonLink>
              <ButtonLink to="/submit" className="hidden sm:inline-flex">
                ثبت محصول
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink lg:hidden"
          >
            {mobileOpen ? <X size={20} strokeWidth={1.75} aria-hidden /> : <MenuIcon size={20} strokeWidth={1.75} aria-hidden />}
          </button>
        </div>
      </div>

      <div className="px-3 pb-2.5 sm:px-4 md:hidden">
        <SearchForm />
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto border-t border-line/70 bg-surface px-4 py-4 lg:hidden">
          <MobileNav onNavigate={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  )
}
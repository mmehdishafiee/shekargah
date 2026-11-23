import { useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Clock,
  Code2,
  Compass,
  Feather,
  Flame,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  Info,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Mail,
  Menu as MenuIcon,
  Monitor,
  Newspaper,
  Palette,
  Plus,
  Rocket,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Trophy,
  User,
  Users,
  Wallet,
  X,
  Bot,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
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
  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink aria-expanded:bg-sunken aria-expanded:text-ink'

/** Two-column dropdown panel: icon tile, title and a one-line description. */
const panelItemClass =
  'flex items-start gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none'

const iconTileClass = 'grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted'

function PanelItem({
  to,
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  to: string
  icon: LucideIcon
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <Link to={to} onClick={onSelect} className={panelItemClass}>
      <span className={iconTileClass}>
        <Icon size={17} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{description}</span>
      </span>
    </Link>
  )
}

function PanelFooter({ to, label, onSelect }: { to: string; label: string; onSelect: () => void }) {
  return (
    <Link
      to={to}
      onClick={onSelect}
      className="mt-2 flex items-center justify-between gap-2 rounded-xl border-t border-line pt-2.5 pb-1 ps-2.5 pe-2 text-xs font-semibold text-ink-muted transition-colors hover:text-brand-700"
    >
      <span>{label}</span>
      <ArrowLeft size={14} strokeWidth={2} aria-hidden />
    </Link>
  )
}

const TOPIC_STYLES: Record<string, { icon: LucideIcon; tint: string }> = {
  'web-apps': { icon: Monitor, tint: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  'mobile-apps': { icon: Smartphone, tint: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  'desktop-apps': { icon: Monitor, tint: 'bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300' },
  'open-source': { icon: Code2, tint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  'developer-tools': { icon: Feather, tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  apis: { icon: Server, tint: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' },
  'online-services': { icon: Store, tint: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  productivity: { icon: Compass, tint: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-700' },
  education: { icon: GraduationCap, tint: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  fintech: { icon: Wallet, tint: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  design: { icon: Palette, tint: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300' },
  ai: { icon: Bot, tint: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300' },
}

function topicStyle(slug: string) {
  return TOPIC_STYLES[slug] ?? { icon: Layers, tint: 'bg-sunken text-ink-muted' }
}

/** Grouped navigation: four dropdowns keep the header calm. */
function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const topics = useTopics()
  const hotTopics = (topics.data ?? []).filter((topic) => topic.productCount > 0).slice(0, 8)
  const after = (close: () => void) => {
    close()
    onNavigate?.()
  }

  const ranking: { to: string; icon: LucideIcon; title: string; description: string }[] = [
    { to: '/leaderboard/daily', icon: Sun, title: 'روزانه', description: 'برترین‌های هر روز' },
    { to: '/leaderboard/weekly', icon: CalendarDays, title: 'هفتگی', description: 'برترین‌های هفته' },
    { to: '/leaderboard/monthly', icon: CalendarRange, title: 'ماهانه', description: 'برترین‌های هر ماه' },
    { to: '/leaderboard/yearly', icon: Trophy, title: 'سالانه', description: 'تالار افتخار سال' },
  ]

  const discovery: { to: string; icon: LucideIcon; title: string; description: string }[] = [
    { to: '/today', icon: Sparkles, title: 'محصولات امروز', description: 'رونمایی‌های امروز، به ترتیب رأی' },
    { to: '/trending', icon: Flame, title: 'داغ‌ترین‌ها', description: 'محصول‌هایی که این روزها سر زبان‌هاست' },
    { to: '/', icon: Compass, title: 'همه‌ی محصولات', description: 'کتالوگ کامل شکارگاه' },
    { to: '/collections', icon: FolderOpen, title: 'مجموعه‌ها', description: 'فهرست‌های گردآوری‌شده' },
  ]

  return (
    <>
      <Menu
        label="محصولات"
        hover
        align="start"
        panelClassName="w-[40rem] max-w-[calc(100vw-1.5rem)] p-3"
        triggerClassName={navTriggerClass}
        trigger={<>محصولات<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}
      >
        {(close) => (
          <>
            <div className="flex gap-3">
              <div className="grid flex-1 grid-cols-2 gap-x-1">
                <div>
                  <p className="px-2.5 pb-1 text-[11px] font-bold text-ink-faint">کشف</p>
                  {discovery.map((item) => (
                    <PanelItem key={item.to} {...item} onSelect={() => after(close)} />
                  ))}
                </div>
                <div>
                  <p className="px-2.5 pb-1 text-[11px] font-bold text-ink-faint">رتبه‌بندی</p>
                  {ranking.map((item) => (
                    <PanelItem key={item.to} {...item} onSelect={() => after(close)} />
                  ))}
                </div>
              </div>
<div className="flex w-52 shrink-0 flex-col gap-3 self-start rounded-2xl bg-sunken p-4">
                <div>
                  <p className="text-sm font-bold text-ink">محصولی ساختهاید؟</p>
                  <p className="mt-1.5 text-xs leading-6 text-ink-muted">محصولتان را رونمایی کنید و از کاربران شکارگاه رأی و بازخورد بگیرید.</p>
                </div>
                <ButtonLink to="/submit" size="sm" className="w-full" icon={<Plus size={15} strokeWidth={2} aria-hidden />} onClick={() => after(close)}>
                  ثبت محصول
                </ButtonLink>
              </div>
            </div>
            <PanelFooter to="/leaderboard" label="همه‌ی جدول‌های رتبه‌بندی" onSelect={() => after(close)} />
          </>
        )}
      </Menu>

      <Menu
        label="موضوع‌ها"
        hover
        align="start"
        panelClassName="w-[34rem] max-w-[calc(100vw-1.5rem)] p-3"
        triggerClassName={navTriggerClass}
        trigger={<>موضوع‌ها<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}
      >
        {(close) => (
          <>
            <p className="px-2.5 pb-1.5 text-[11px] font-bold text-ink-faint">موضوع‌های داغ</p>
            <div className="grid grid-cols-2 gap-x-1">
              {hotTopics.map((topic) => {
                const style = topicStyle(topic.slug)
                const Icon = style.icon
                return (
                  <Link
                    key={topic.slug}
                    to={`/?category=${encodeURIComponent(topic.slug)}`}
                    onClick={() => after(close)}
                    className={panelItemClass}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${style.tint}`}>
                      <Icon size={17} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{topic.name}</span>
                      <span className="mt-0.5 block text-xs text-ink-faint">{formatNumber(topic.productCount)} محصول</span>
                    </span>
                  </Link>
                )
              })}
            </div>
            <PanelFooter to="/topics" label="همه‌ی موضوع‌ها را ببینید" onSelect={() => after(close)} />
          </>
        )}
      </Menu>

      <Menu
        label="جامعه"
        hover
        align="start"
        panelClassName="w-[28rem] max-w-[calc(100vw-1.5rem)] p-3"
        triggerClassName={navTriggerClass}
        trigger={<>جامعه<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}
      >
        {(close) => (
          <>
            <div className="grid grid-cols-2 gap-x-1">
              <PanelItem to="/makers" icon={Users} title="سازندگان برتر" description="پرکارترین و محبوب‌ترین سازندگان" onSelect={() => after(close)} />
              <PanelItem to="/companies" icon={Store} title="شرکت‌ها" description="استودیوها و شرکت‌های سازنده" onSelect={() => after(close)} />
              <PanelItem to="/blog" icon={Newspaper} title="وبلاگ شکارگاه" description="یادداشت‌ها و راهنماها" onSelect={() => after(close)} />
              <PanelItem to="/about" icon={Info} title="درباره‌ی شکارگاه" description="شکارگاه چیست و چطور کار می‌کند" onSelect={() => after(close)} />
            </div>
            <PanelFooter to="/changelog" label="تغییرات شکارگاه" onSelect={() => after(close)} />
          </>
        )}
      </Menu>

      <Menu
        label="برای سازندگان"
        hover
        align="end"
        panelClassName="w-[28rem] max-w-[calc(100vw-1.5rem)] p-3"
        triggerClassName={navTriggerClass}
        trigger={<>برای سازندگان<ChevronDown size={14} strokeWidth={2} aria-hidden /></>}
      >
        {(close) => (
          <>
            <div className="grid grid-cols-2 gap-x-1">
              <PanelItem to="/submit" icon={Rocket} title="ثبت محصول" description="محصولتان را برای انتشار بفرستید" onSelect={() => after(close)} />
              <PanelItem to="/sponsor" icon={HeartHandshake} title="حامی شکارگاه" description="برندتان را کنار محصولات تازه ببینید" onSelect={() => after(close)} />
              <PanelItem to="/dashboard" icon={LayoutDashboard} title="داشبورد من" description="آمار بازدید، رأی و وضعیت بررسی" onSelect={() => after(close)} />
              <PanelItem to="/help" icon={LifeBuoy} title="راهنما و پشتیبانی" description="پاسخ به پرسش‌ها و مشکلات" onSelect={() => after(close)} />
            </div>
            <PanelFooter to="/faq" label="قوانین ثبت و پرسش‌های متداول" onSelect={() => after(close)} />
          </>
        )}
      </Menu>
    </>
  )
}

const exploreTiles: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'محصولات', icon: Sparkles },
  { to: '/trending', label: 'داغ‌ترین‌ها', icon: Flame },
  { to: '/leaderboard', label: 'رتبه‌بندی', icon: Trophy },
  { to: '/today', label: 'محصولات امروز', icon: CalendarDays },
  { to: '/topics', label: 'موضوع‌ها', icon: Layers },
  { to: '/collections', label: 'مجموعه‌ها', icon: FolderOpen },
]

const moreLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/makers', label: 'سازندگان برتر', icon: Users },
  { to: '/companies', label: 'شرکت‌ها', icon: Store },
  { to: '/blog', label: 'وبلاگ شکارگاه', icon: Newspaper },
  { to: '/about', label: 'درباره‌ی شکارگاه', icon: Info },
  { to: '/help', label: 'راهنما', icon: LifeBuoy },
  { to: '/faq', label: 'سوالات متداول', icon: CircleHelp },
  { to: '/changelog', label: 'تغییرات شکارگاه', icon: Clock },
  { to: '/contact', label: 'تماس با ما', icon: Mail },
]

function MobileSheet({ onClose }: { onClose: () => void }) {
  const { session } = useAuth()
  const topics = useTopics()
  const { pathname } = useLocation()
  const hotTopics = (topics.data ?? []).filter((topic) => topic.productCount > 0).slice(0, 8)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))
  const links = session
    ? [
        { to: '/dashboard', label: 'داشبورد من', icon: LayoutDashboard },
        { to: '/saved', label: 'ذخیره‌شده‌ها', icon: Bookmark },
        { to: '/settings', label: 'تنظیمات حساب', icon: Settings },
        ...moreLinks,
      ]
    : moreLinks

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="بستن منو" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="منوی سایت"
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-3 shadow-pop"
      >
        <div className="sticky top-0 z-10 rounded-t-3xl border-b border-line/70 bg-surface px-5 pb-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold">به شکارگاه خوش آمدید</p>
              <p className="mt-0.5 text-sm text-ink-muted">محصول‌های تازه را کشف کنید.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن منو"
              className="grid size-10 shrink-0 place-items-center rounded-control bg-sunken text-ink-muted hover:text-ink"
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-5 pt-4">
          {!session && (
            <div className="flex gap-2.5">
              <ButtonLink to="/login" className="flex-1" onClick={onClose}>
                ورود
              </ButtonLink>
              <ButtonLink to="/signup" variant="secondary" className="flex-1" onClick={onClose}>
                ساخت حساب
              </ButtonLink>
            </div>
          )}

          <SearchForm />

          <section aria-labelledby="sheet-explore">
            <p id="sheet-explore" className="mb-2.5 text-sm font-bold text-ink-muted">
              کاوش
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {exploreTiles.map((tile) => {
                const active = isActive(tile.to)
                return (
                  <Link
                    key={tile.to}
                    to={tile.to}
                    onClick={onClose}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center text-[13px] font-semibold transition-colors ${
                      active ? 'border-brand-600/60 bg-brand-50/60 text-brand-700' : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-sunken'
                    }`}
                  >
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        active ? 'bg-brand-600 text-on-brand' : 'bg-sunken text-ink-muted'
                      }`}
                    >
                      <tile.icon size={19} strokeWidth={1.75} aria-hidden />
                    </span>
                    {tile.label}
                  </Link>
                )
              })}
            </div>
          </section>

          {hotTopics.length > 0 && (
            <section aria-labelledby="sheet-topics">
              <div className="mb-2.5 flex items-center justify-between">
                <p id="sheet-topics" className="text-sm font-bold text-ink-muted">
                  موضوع‌های داغ
                </p>
                <Link to="/topics" onClick={onClose} className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-brand-700">
                  همه
                  <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {hotTopics.map((topic) => (
                  <Link
                    key={topic.slug}
                    to={`/?category=${encodeURIComponent(topic.slug)}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken"
                  >
                    {topic.name}
                    <span className="text-xs tabular-nums text-ink-faint">{formatNumber(topic.productCount)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="sheet-more">
            <p id="sheet-more" className="mb-2.5 text-sm font-bold text-ink-muted">
              بیشتر
            </p>
            <div className="overflow-hidden rounded-2xl border border-line">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm font-medium text-ink transition-colors last:border-b-0 hover:bg-sunken"
                >
                  <link.icon size={17} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
                  <span className="flex-1">{link.label}</span>
                  <ChevronLeft size={15} strokeWidth={1.75} className="text-ink-faint" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 mt-5 border-t border-line bg-surface px-5 py-3">
          <ButtonLink to="/submit" className="w-full" icon={<Plus size={18} strokeWidth={2} aria-hidden />} onClick={onClose}>
            ثبت محصول
          </ButtonLink>
        </div>
      </div>
    </div>,
    document.body,
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
              <span className="hidden sm:inline-flex">
                <ButtonLink to="/submit">ثبت محصول</ButtonLink>
              </span>
            </>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
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

      {mobileOpen && <MobileSheet onClose={() => setMobileOpen(false)} />}
    </header>
  )
}
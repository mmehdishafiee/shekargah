import { NavLink, Outlet } from 'react-router'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

const TABS = [
  { to: '/admin', label: 'در انتظار بررسی', end: true },
  { to: '/admin/published', label: 'منتشرشده' },
  { to: '/admin/rejected', label: 'ردشده' },
  { to: '/admin/reports', label: 'گزارش‌ها' },
  { to: '/admin/categories', label: 'دسته‌بندی‌ها' },
]

export function AdminLayout() {
  useDocumentMeta('پنل مدیریت')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">پنل مدیریت</h1>
        <p className="mt-1 text-sm text-ink-muted">همه‌ی اقدام‌ها با نام شما و زمان انجام ثبت می‌شوند.</p>
      </div>
      <nav aria-label="بخش‌های مدیریت" className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-full bg-sunken p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  )
}

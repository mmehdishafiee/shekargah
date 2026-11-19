import { Link } from 'react-router'
import { Bell } from 'lucide-react'
import { useUnreadNotifications } from '@/data/queries'

/** Header bell with an unread badge; links to the notifications inbox. */
export function NotificationsBell() {
  const unread = useUnreadNotifications()
  const count = unread.data ?? 0

  return (
    <Link
      to="/notifications"
      aria-label={count > 0 ? `اعلان‌ها، ${count} خوانده‌نشده` : 'اعلان‌ها'}
      className="relative grid size-10 place-items-center rounded-control text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      <Bell size={19} strokeWidth={1.75} aria-hidden />
      {count > 0 && (
        <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-on-brand">
          {count > 99 ? '۹۹+' : new Intl.NumberFormat('fa-IR').format(count)}
        </span>
      )}
    </Link>
  )
}
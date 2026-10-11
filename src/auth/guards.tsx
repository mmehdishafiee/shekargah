import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

/**
 * Hides admin screens from non-admins. This is a UX guard only: every admin
 * operation is also authorized by the database (RLS + is_admin()).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, session, isAdmin } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert size={22} strokeWidth={1.75} />}
        title="دسترسی به این بخش نداری"
        description="پنل مدیریت فقط برای مدیران شکارگاه باز است."
        action={<ButtonLink to="/">بازگشت به صفحه‌ی اصلی</ButtonLink>}
      />
    )
  }
  return children
}

import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import { RequireAdmin, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { AboutPage } from '@/pages/AboutPage'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/AuthPages'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductPage } from '@/pages/ProductPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SubmitPage } from '@/pages/SubmitPage'
import { PageLoader } from '@/components/ui/Feedback'

// The admin dashboard is only downloaded by administrators.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })))

const load = (element: ReactNode) => <Suspense fallback={<PageLoader />}>{element}</Suspense>

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products/:slug', element: <ProductPage /> },
      { path: 'u/:username', element: <ProfilePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'submit', element: <RequireAuth><SubmitPage /></RequireAuth> },
      { path: 'settings', element: <RequireAuth><SettingsPage /></RequireAuth> },
      {
        path: 'admin',
        element: <RequireAdmin>{load(<AdminLayout />)}</RequireAdmin>,
        children: [
          { index: true, element: load(<AdminProductsPage key="pending" status="pending" />) },
          { path: 'published', element: load(<AdminProductsPage key="published" status="published" />) },
          { path: 'rejected', element: load(<AdminProductsPage key="rejected" status="rejected" />) },
          { path: 'reports', element: load(<AdminReportsPage />) },
          { path: 'categories', element: load(<AdminCategoriesPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

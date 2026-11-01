import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import { RequireAdmin, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { AboutPage } from '@/pages/AboutPage'
import { ContactPage, FaqPage, HelpPage, SponsorPage } from '@/pages/InfoPages'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/AuthPages'
import { DailyPage } from '@/pages/DailyPage'
import { HomePage } from '@/pages/HomePage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductPage } from '@/pages/ProductPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SavedPage } from '@/pages/SavedPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SubmitPage } from '@/pages/SubmitPage'
import { TrendingPage } from '@/pages/TrendingPage'
import { MakersPage } from '@/pages/MakersPage'
import { TopicsPage } from '@/pages/TopicsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CollectionPage, CollectionsPage } from '@/pages/CollectionsPage'
import { PersonalFeedPage } from '@/pages/PersonalFeedPage'
import { CompaniesPage, CompanyPage } from '@/pages/CompaniesPage'
import { BlogPage, BlogPostPage } from '@/pages/BlogPages'
import { PageLoader } from '@/components/ui/Feedback'

// The admin dashboard is only downloaded by administrators.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminSeoPage = lazy(() => import('@/pages/admin/AdminSeoPage').then((m) => ({ default: m.AdminSeoPage })))
const AdminBlogPage = lazy(() => import('@/pages/admin/AdminBlogPages').then((m) => ({ default: m.AdminBlogPage })))
const AdminBlogEditorPage = lazy(() => import('@/pages/admin/AdminBlogPages').then((m) => ({ default: m.AdminBlogEditorPage })))
const AdminCompaniesPage = lazy(() => import('@/pages/admin/AdminCompaniesPage').then((m) => ({ default: m.AdminCompaniesPage })))
const AdminNewsletterPage = lazy(() => import('@/pages/admin/AdminNewsletterPage').then((m) => ({ default: m.AdminNewsletterPage })))
const AdminBannedWordsPage = lazy(() => import('@/pages/admin/AdminBannedWordsPage').then((m) => ({ default: m.AdminBannedWordsPage })))
const AdminProductEditPage = lazy(() => import('@/pages/admin/AdminProductEditPage').then((m) => ({ default: m.AdminProductEditPage })))

const load = (element: ReactNode) => <Suspense fallback={<PageLoader />}>{element}</Suspense>

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'today', element: <DailyPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'leaderboard/:period', element: <LeaderboardPage /> },
      { path: 'leaderboard/:period/:date', element: <LeaderboardPage /> },
      { path: 'trending', element: <TrendingPage /> },
      { path: 'topics', element: <TopicsPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'collections/:slug', element: <CollectionPage /> },
      { path: 'feed', element: <RequireAuth><PersonalFeedPage /></RequireAuth> },
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'companies/:slug', element: <CompanyPage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'blog/:slug', element: <BlogPostPage /> },
      { path: 'makers', element: <MakersPage /> },
      { path: 'saved', element: <RequireAuth><SavedPage /></RequireAuth> },
      { path: 'dashboard', element: <RequireAuth><DashboardPage /></RequireAuth> },
      { path: 'notifications', element: <RequireAuth><NotificationsPage /></RequireAuth> },
      { path: 'products/:slug', element: <ProductPage /> },
      { path: 'u/:username', element: <ProfilePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'faq', element: <FaqPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'sponsor', element: <SponsorPage /> },
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
          { path: 'products/:slug/edit', element: load(<AdminProductEditPage />) },
          { path: 'rejected', element: load(<AdminProductsPage key="rejected" status="rejected" />) },
          { path: 'reports', element: load(<AdminReportsPage />) },
          { path: 'users', element: load(<AdminUsersPage />) },
          { path: 'banned-words', element: load(<AdminBannedWordsPage />) },
          { path: 'newsletter', element: load(<AdminNewsletterPage />) },
          { path: 'companies', element: load(<AdminCompaniesPage />) },
          { path: 'seo', element: load(<AdminSeoPage />) },
          { path: 'blog', element: load(<AdminBlogPage />) },
          { path: 'blog/:id', element: load(<AdminBlogEditorPage />) },
          { path: 'categories', element: load(<AdminCategoriesPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

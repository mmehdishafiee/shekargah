import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Package, Settings, Trash2, UserX } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { AtSign, Briefcase, Code2, Globe, Send } from 'lucide-react'
import { useMakerProducts, useMySavedIds, useMyVotes, useProfileByUsername } from '@/data/queries'
import type { Product } from '@/data/types'
import { formatDate, formatNumber } from '@/lib/format'
import { productPath } from '@/lib/paths'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ProductLogo } from '@/components/product/ProductLogo'
import { ProductRow } from '@/components/product/ProductRow'
import { StatusBadge } from '@/components/product/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/toast'
import { cardClass } from '@/components/ui/styles'

/** Social links a member chose to publish. */
function ProfileLinks({ profile }: { profile: { websiteUrl: string | null; xUsername: string | null; telegramUsername: string | null; linkedinUsername: string | null; githubUsername: string | null } }) {
  const links = [
    profile.websiteUrl && { href: profile.websiteUrl, label: 'وب‌سایت', icon: Globe, text: null },
    profile.xUsername && { href: `https://x.com/${profile.xUsername}`, label: 'ایکس', icon: AtSign, text: `@${profile.xUsername}` },
    profile.telegramUsername && { href: `https://t.me/${profile.telegramUsername}`, label: 'تلگرام', icon: Send, text: `@${profile.telegramUsername}` },
    profile.linkedinUsername && { href: `https://www.linkedin.com/in/${profile.linkedinUsername}`, label: 'لینکدین', icon: Briefcase, text: profile.linkedinUsername },
    profile.githubUsername && { href: `https://github.com/${profile.githubUsername}`, label: 'گیت‌هاب', icon: Code2, text: profile.githubUsername },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe; text: string | null }[]

  if (links.length === 0) return null

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer nofollow me"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <link.icon size={13} strokeWidth={1.75} aria-hidden />
            <span className="ltr">{link.text ?? link.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function ProfilePage() {
  const { username = '' } = useParams()
  const profile = useProfileByUsername(username)
  const { session } = useAuth()
  const products = useMakerProducts(profile.data?.id)
  const published = products.data?.filter((p) => p.status === 'published') ?? []
  const unpublished = products.data?.filter((p) => p.status !== 'published') ?? []
  const votes = useMyVotes(published.map((p) => p.id))
  const saved = useMySavedIds(published.map((p) => p.id))
  useDocumentMeta(profile.data?.displayName ?? (profile.isSuccess ? 'کاربر پیدا نشد' : undefined), profile.data?.bio ?? undefined)

  if (profile.isPending) return <PageLoader />
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  if (!profile.data) {
    return (
      <EmptyState
        icon={<UserX size={22} strokeWidth={1.75} />}
        title="کاربری با این نام پیدا نشد"
        action={<ButtonLink to="/">بازگشت به صفحه‌ی اصلی</ButtonLink>}
      />
    )
  }

  const user = profile.data
  const isSelf = session?.userId === user.id

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={user.displayName} seed={user.id} url={user.avatarUrl} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{user.displayName}</h1>
          <p className="ltr mt-0.5 text-start text-sm text-ink-muted">@{user.username}</p>
          {user.bio && (
            <p className="bidi mt-3 max-w-prose whitespace-pre-line text-[15px]">
              {user.bio}
            </p>
          )}
          <ProfileLinks profile={user} />
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <CalendarDays size={15} strokeWidth={1.75} aria-hidden />
            عضو از {formatDate(user.createdAt)}
          </p>
        </div>
        {isSelf && (
          <ButtonLink to="/settings" variant="secondary" size="sm" icon={<Settings size={16} strokeWidth={1.75} aria-hidden />}>
            ویرایش پروفایل
          </ButtonLink>
        )}
      </header>

      {isSelf && unpublished.length > 0 && (
        <section aria-labelledby="private-heading">
          <h2 id="private-heading" className="text-lg font-bold">
            ارسال‌های منتشرنشده
          </h2>
          <p className="mt-1 text-sm text-ink-muted">این بخش فقط برای خودت نمایش داده می‌شود.</p>
          <ul className={`${cardClass} mt-4 divide-y divide-line/70`}>
            {unpublished.map((product) => (
              <PrivateSubmission key={product.id} product={product} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="published-heading">
        <h2 id="published-heading" className="text-lg font-bold">
          محصولات منتشرشده
          {products.isSuccess && <span className="ms-1.5 font-medium text-ink-muted">({formatNumber(published.length)})</span>}
        </h2>
        <div className={`${cardClass} mt-4 p-1.5 sm:p-2`}>
          {products.isPending ? (
            <div className="flex justify-center py-10 text-ink-muted">
              <Spinner label="در حال بارگذاری محصولات" />
            </div>
          ) : products.isError ? (
            <ErrorState error={products.error} onRetry={() => products.refetch()} />
          ) : published.length === 0 ? (
            <EmptyState
              icon={<Package size={22} strokeWidth={1.75} />}
              title="هنوز محصول منتشرشده‌ای ندارد"
              action={isSelf ? <ButtonLink to="/submit">معرفی اولین محصول</ButtonLink> : undefined}
            />
          ) : (
            <ul>
              {published.map((product) => (
                <li key={product.id}>
                  <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function PrivateSubmission({ product }: { product: Product }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    await api.deleteProduct(product.id)
    toast.success('ارسال حذف شد.')
    await queryClient.invalidateQueries({ queryKey: ['maker-products'] })
  }

  return (
    <li className="flex items-start gap-4 p-4">
      <ProductLogo name={product.name} seed={product.slug} url={product.logoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={productPath(product.slug)} className="font-bold hover:underline">
            {product.name}
          </Link>
          <StatusBadge status={product.status} />
        </div>
        <p className="bidi mt-0.5 truncate text-sm text-ink-muted">{product.tagline}</p>
        <p className="mt-1 text-xs text-ink-muted">ثبت‌شده در {formatDate(product.createdAt)}</p>
        {product.status === 'rejected' && product.moderationNote && (
          <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
            دلیل مدیران: <span dir="auto">{product.moderationNote}</span>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 size={15} strokeWidth={1.75} />}
        onClick={() => setConfirming(true)}
        aria-label={`حذف ${product.name}`}
      >
        <span className="hidden sm:inline">حذف</span>
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف ارسال"
        description={`«${product.name}» برای همیشه حذف می‌شود.`}
        confirmLabel="حذف"
        tone="danger"
        onConfirm={remove}
      />
    </li>
  )
}

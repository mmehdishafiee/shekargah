import { Link, useParams } from 'react-router'
import { Building2, ExternalLink } from 'lucide-react'
import { useCompanies, useCompany, useCompanyProducts, useMySavedIds, useMyVotes } from '@/data/queries'
import { formatNumber } from '@/lib/format'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { hostnameOf } from '@/lib/text'
import { ProductRow } from '@/components/product/ProductRow'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader, ProductRowSkeleton } from '@/components/ui/Feedback'
import { cardClass } from '@/components/ui/styles'

export function CompaniesPage() {
  useDocumentMeta('شرکت‌ها')
  const companies = useCompanies()
  const items = companies.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <section aria-labelledby="companies-heading" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 id="companies-heading" className="text-2xl font-extrabold">
          شرکت‌ها
        </h1>
        <p className="mt-1 text-sm text-ink-muted">تیم‌ها و شرکت‌هایی که محصول می‌سازند.</p>
      </div>

      {companies.isPending ? (
        <PageLoader />
      ) : companies.isError ? (
        <ErrorState error={companies.error} onRetry={() => companies.refetch()} />
      ) : items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={<Building2 size={22} strokeWidth={1.75} />} title="هنوز شرکتی ثبت نشده" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((company) => (
            <li key={company.id}>
              <Link
                to={`/companies/${encodeURIComponent(company.slug)}`}
                className={`${cardClass} flex h-full items-start gap-3 p-4 transition-colors hover:border-line-strong`}
              >
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-sunken text-ink-muted">
                  {company.logoUrl ? <img src={company.logoUrl} alt="" className="size-full object-cover" loading="lazy" /> : <Building2 size={19} strokeWidth={1.75} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{company.name}</span>
                  {company.description && <span className="mt-0.5 block line-clamp-2 text-[13px] leading-6 text-ink-muted">{company.description}</span>}
                  <span className="mt-1 block text-xs text-ink-faint">
                    {formatNumber(company.productCount)} محصول · {formatNumber(company.memberCount)} عضو
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {companies.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => companies.fetchNextPage()} loading={companies.isFetchingNextPage}>
            شرکت‌های بیشتر
          </Button>
        </div>
      )}
    </section>
  )
}

export function CompanyPage() {
  const { slug = '' } = useParams()
  const company = useCompany(slug)
  const products = useCompanyProducts(slug)
  const items = products.data?.pages.flatMap((page) => page.items) ?? []
  const votes = useMyVotes(items.map((product) => product.id))
  const saved = useMySavedIds(items.map((product) => product.id))
  useDocumentMeta(company.data?.name ?? 'شرکت')

  if (company.isPending) return <PageLoader />
  if (company.isError) return <ErrorState error={company.error} onRetry={() => company.refetch()} />
  if (!company.data) return <div className={cardClass}><EmptyState icon={<Building2 size={22} strokeWidth={1.75} />} title="این شرکت پیدا نشد" /></div>

  return (
    <section aria-labelledby="company-heading" className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken text-ink-muted">
          {company.data.logoUrl ? <img src={company.data.logoUrl} alt="" className="size-full object-cover" /> : <Building2 size={26} strokeWidth={1.75} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="company-heading" className="text-2xl font-extrabold">
            {company.data.name}
          </h1>
          {company.data.description && <p className="mt-1 text-sm leading-7 text-ink-muted">{company.data.description}</p>}
          {company.data.websiteUrl && (
            <a
              href={company.data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="ltr mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              {hostnameOf(company.data.websiteUrl)}
              <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
            </a>
          )}
        </div>
      </header>

      <div className={`${cardClass} p-1.5 sm:p-2`}>
        {products.isPending ? (
          <div aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <ProductRowSkeleton key={index} />
            ))}
          </div>
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Building2 size={22} strokeWidth={1.75} />} title="این شرکت هنوز محصول منتشرشده‌ای ندارد" />
        ) : (
          <ol aria-label="محصولات شرکت">
            {items.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} voted={votes.data?.has(product.id) ?? false} saved={saved.data?.has(product.id) ?? false} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {products.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => products.fetchNextPage()} loading={products.isFetchingNextPage}>
            موارد بیشتر
          </Button>
        </div>
      )}
    </section>
  )
}
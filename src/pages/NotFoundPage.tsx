import { Compass } from 'lucide-react'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'

export function NotFoundPage() {
  useDocumentMeta('صفحه پیدا نشد')
  return (
    <EmptyState
      icon={<Compass size={22} strokeWidth={1.75} />}
      title="این صفحه پیدا نشد"
      description="نشانی را بررسی کن یا از صفحه‌ی اصلی محصولات را ببین."
      action={<ButtonLink to="/">رفتن به صفحه‌ی اصلی</ButtonLink>}
    />
  )
}

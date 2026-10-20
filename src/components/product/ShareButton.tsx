import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { productPath } from '@/lib/paths'
import { useToast } from '@/components/ui/toast'

interface ShareButtonProps {
  slug: string
  name: string
  tagline?: string
}

export function ShareButton({ slug, name, tagline }: ShareButtonProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const url = `${window.location.origin}${productPath(slug)}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success('لینک محصول کپی شد.')
  }

  const share = async () => {
    setBusy(true)
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: tagline ? `${tagline}\n${url}` : url, url })
      } else {
        await copy()
      }
    } catch {
      await copy()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="relative z-10 inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink transition-colors hover:border-brand-600 hover:text-brand-700 disabled:opacity-60"
      aria-label={`اشتراک‌گذاری ${name}`}
    >
      <Share2 size={18} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

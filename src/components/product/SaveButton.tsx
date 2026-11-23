import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { errorMessage, isApiError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'

interface SaveButtonProps {
  productId: string
  productName: string
  saved: boolean
  variant?: 'box' | 'wide'
}

export function SaveButton({ productId, productName, saved, variant = 'box' }: SaveButtonProps) {
  const { session } = useAuth()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  const isSaved = optimistic ?? saved

  const mutation = useMutation({
    mutationFn: (next: boolean) => (next ? api.saveProduct(productId) : api.unsaveProduct(productId)),
    onError: (error, next) => {
      if (next && isApiError(error, 'duplicate')) return
      if (!next && isApiError(error, 'not_found')) return
      toast.error(errorMessage(error))
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['saved'] }),
        queryClient.invalidateQueries({ queryKey: ['saved-products'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ])
      setOptimistic(null)
    },
  })

  const onClick = () => {
    if (!session) {
      navigate('/login', { state: { from: location.pathname + location.search } })
      return
    }
    if (mutation.isPending) return
    const next = !isSaved
    setOptimistic(next)
    mutation.mutate(next)
  }

  const label = isSaved ? `حذف ${productName} از ذخیره‌شده‌ها` : `ذخیره‌ی ${productName}`

  // The saved state must be obvious at a glance: filled icon, solid brand
  // background and a label that says what the current state is.
  const tone = isSaved
    ? 'border-brand-600 bg-brand-600 text-on-brand shadow-card'
    : 'border-line-strong bg-surface text-ink-muted hover:border-brand-600 hover:text-brand-700'

  if (variant === 'wide') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSaved}
        aria-label={label}
        title={label}
        className={`inline-flex h-11 items-center gap-2 rounded-control border-2 px-5 text-sm font-bold transition-all active:scale-[0.97] ${tone}`}
      >
        {isSaved ? <BookmarkCheck size={18} strokeWidth={2.2} aria-hidden /> : <Bookmark size={18} strokeWidth={2} aria-hidden />}
        {isSaved ? 'ذخیره شد' : 'ذخیره کن'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={label}
      title={isSaved ? 'ذخیره شده — برای برداشتن کلیک کن' : 'ذخیره کن'}
      className={`relative z-10 inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${tone}`}
    >
      {isSaved ? <BookmarkCheck size={18} strokeWidth={2.3} aria-hidden /> : <Bookmark size={17} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

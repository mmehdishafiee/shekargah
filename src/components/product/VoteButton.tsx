import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronUp } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApi } from '@/data/api'
import { errorMessage, isApiError } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { useToast } from '@/components/ui/toast'

interface VoteButtonProps {
  productId: string
  productName: string
  slug: string
  votesCount: number
  voted: boolean
  variant?: 'box' | 'wide'
}

export function VoteButton({ productId, productName, slug, votesCount, voted, variant = 'box' }: VoteButtonProps) {
  const { session } = useAuth()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  const isVoted = optimistic ?? voted
  const count = votesCount + (optimistic === null || optimistic === voted ? 0 : optimistic ? 1 : -1)

  const mutation = useMutation({
    mutationFn: (next: boolean) => (next ? api.vote(productId) : api.unvote(productId)),
    onError: (error, next) => {
      if (next && isApiError(error, 'duplicate')) return
      toast.error(errorMessage(error))
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['votes'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['product', slug] }),
        queryClient.invalidateQueries({ queryKey: ['maker-products'] }),
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
    const next = !isVoted
    setOptimistic(next)
    mutation.mutate(next)
  }

  const label = isVoted ? `پس گرفتن رأی از ${productName}` : `رأی به ${productName}`
  const tone = isVoted
    ? 'border-brand-600 bg-brand-50 text-brand-700'
    : 'border-line-strong bg-surface text-ink hover:border-brand-600 hover:text-brand-700'

  if (variant === 'wide') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isVoted}
        aria-label={label}
        className={`inline-flex h-11 items-center gap-2 rounded-control border-2 px-5 text-sm font-bold transition-colors ${tone}`}
      >
        <ChevronUp size={20} strokeWidth={2.25} aria-hidden />
        {isVoted ? 'رأی دادی' : 'رأی بده'}
        <span className="tabular-nums">{formatNumber(count)}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isVoted}
      aria-label={label}
      className={`relative z-10 flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-bold transition-colors ${tone}`}
    >
      <ChevronUp size={20} strokeWidth={2.25} aria-hidden />
      <span className="tabular-nums leading-none">{formatNumber(count)}</span>
    </button>
  )
}

import { useLocation, useNavigate } from 'react-router'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useSetCollectionSaved } from '@/data/queries'
import type { UserCollection } from '@/data/types'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'

/** Save / unsave someone else's list. Owners cannot save their own list. */
export function SaveCollectionButton({ collection }: { collection: UserCollection }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mutation = useSetCollectionSaved(collection.id, collection.slug)

  if (collection.isOwner) return null

  const saved = collection.isSaved

  const onClick = () => {
    if (!session) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    mutation.mutate(!saved)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={saved ? 'primary' : 'secondary'}
        size="sm"
        aria-pressed={saved}
        loading={mutation.isPending}
        icon={saved ? <BookmarkCheck size={16} strokeWidth={2} aria-hidden /> : <Bookmark size={16} strokeWidth={1.75} aria-hidden />}
        onClick={onClick}
      >
        {saved ? 'ذخیره شده' : 'ذخیره‌ی مجموعه'}
      </Button>
      {mutation.isError && <p className="text-xs text-danger-700">{errorMessage(mutation.error)}</p>}
    </div>
  )
}
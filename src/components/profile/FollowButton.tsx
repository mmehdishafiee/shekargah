import { useLocation, useNavigate } from 'react-router'
import { UserCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useFollowToggle, useIsFollowing } from '@/data/queries'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'

/** Follow / unfollow control shown on other members' profiles. */
export function FollowButton({ profileId, username }: { profileId: string; username: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const following = useIsFollowing(profileId)
  const toggle = useFollowToggle(profileId, username)

  const isFollowing = following.data ?? false

  if (!session) {
    return (
      <Button
        variant="primary"
        size="sm"
        icon={<UserPlus size={16} strokeWidth={1.75} aria-hidden />}
        onClick={() => navigate('/login', { state: { from: location.pathname } })}
      >
        دنبال کن
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant={isFollowing ? 'secondary' : 'primary'}
        size="sm"
        aria-pressed={isFollowing}
        loading={toggle.isPending}
        icon={isFollowing ? <UserCheck size={16} strokeWidth={1.75} aria-hidden /> : <UserPlus size={16} strokeWidth={1.75} aria-hidden />}
        onClick={() => toggle.mutate(!isFollowing)}
      >
        {isFollowing ? 'دنبال می‌کنی' : 'دنبال کن'}
      </Button>
      {toggle.isError && <p className="text-xs text-danger-700">{errorMessage(toggle.error)}</p>}
    </div>
  )
}
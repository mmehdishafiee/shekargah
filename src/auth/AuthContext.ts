import { createContext } from 'react'
import type { Profile, Session } from '@/data/types'

export interface AuthState {
  /** True until the stored session (and its profile) has been read. */
  loading: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  /** Set when the user arrived through a password recovery link. */
  passwordRecovery: boolean
  clearPasswordRecovery(): void
  refreshProfile(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

import { useCallback, useMemo } from 'react'
import type { Permission, User } from '../domain/types'
import { hasPermission } from '../domain/permissions'
import { useAppDispatch, useAppState } from '../state/Store'

export function useAuth(): {
  user: User | null
  loginAs: (userId: string) => void
  logout: () => void
  can: (permission: Permission) => boolean
} {
  const state = useAppState()
  const dispatch = useAppDispatch()
  
  const user = useMemo(() => {
    if (!state.currentUserId) return null
    return state.users.find((u) => u.id === state.currentUserId) ?? null
  }, [state.currentUserId, state.users])

  const loginAs = useCallback((userId: string) => {
    dispatch({ type: 'auth/login', userId })
  }, [dispatch])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    dispatch({ type: 'auth/logout' })
  }, [dispatch])

  const can = useCallback((permission: Permission) => {
    if (!user) return false
    if (!user.active) return false
    return hasPermission(user.role, permission)
  }, [user])

  return { user, loginAs, logout, can }
}

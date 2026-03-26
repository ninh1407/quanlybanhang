import { useCallback, useMemo } from 'react'
import type { Permission, User } from '../../shared/types/domain'
import { hasPermission } from '../../shared/domain/permissions'
import { useAppDispatch, useAppState } from '../state/Store'

export function useAuth(): {
  user: User | null
  loginAs: (userId: string) => void
  logout: () => void
  can: (permission: Permission) => boolean
  checkScope: (targetLocationId?: string) => boolean
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
    localStorage.removeItem('refresh_token')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('refresh_token')
    dispatch({ type: 'auth/logout' })
  }, [dispatch])

  const can = useCallback((permission: Permission) => {
    if (!user) return false
    if (!user.active) return false
    return hasPermission(user.role, permission)
  }, [user])

  const checkScope = useCallback((targetLocationId?: string) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'accountant') return true // Global access
      if (!targetLocationId) return true // No target?
      
      if (user.allowedLocationIds && user.allowedLocationIds.length > 0) {
          return user.allowedLocationIds.includes(targetLocationId)
      }
      return true // Default open if no restriction? Or closed? Let's say open for now unless restricted.
  }, [user])

  return { user, loginAs, logout, can, checkScope }
}

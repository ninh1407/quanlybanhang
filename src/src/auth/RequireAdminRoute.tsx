import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'

export function RequireAdminRoute(props: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !user.active) return <AccessDeniedPage />
  if (user.role !== 'admin') return <AccessDeniedPage />
  return props.children
}


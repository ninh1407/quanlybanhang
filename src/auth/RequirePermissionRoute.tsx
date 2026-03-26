import type { ReactNode } from 'react'
import type { Permission } from '../../shared/types/domain'
import { useAuth } from './auth'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'

export function RequirePermissionRoute(props: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(props.permission)) return <AccessDeniedPage />
  return props.children
}

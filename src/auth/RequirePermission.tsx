import type { ReactNode } from 'react'
import type { Permission } from '../../shared/types/domain'
import { useAuth } from './auth'

export function RequirePermission(props: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(props.permission)) return null
  return props.children
}

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { userCanAccessLocation } from '../../shared/domain/warehouseAccess'
import { useAppState } from '../state/Store'

export function RequireWarehouse(props: { children: ReactNode }) {
  const state = useAppState()
  const location = useLocation()
  const { user } = useAuth()

  const id = state.currentLocationId
  
  // If no location selected, redirect to select page without error (normal flow)
  if (!id) {
    return <Navigate to="/select-warehouse" replace state={{ from: location.pathname }} />
  }

  const ok = state.locations.some((l) => l.id === id && l.active) && userCanAccessLocation(user, id)

  if (!ok) {
    return <Navigate to="/select-warehouse" replace state={{ from: location.pathname, error: 'Không có quyền truy cập kho này' }} />
  }

  return props.children
}


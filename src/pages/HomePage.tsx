import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'

export function HomePage() {
  const { can } = useAuth()

  if (can('dashboard:read')) return <Navigate to="/dashboard" replace />
  if (can('orders:read')) return <Navigate to="/orders" replace />
  if (can('products:read')) return <Navigate to="/products" replace />
  if (can('inventory:read')) return <Navigate to="/inventory" replace />
  if (can('finance:read')) return <Navigate to="/finance/overview" replace />
  if (can('customers:read')) return <Navigate to="/customers" replace />
  if (can('staff:read')) return <Navigate to="/staff" replace />
  return <Navigate to="/login" replace />
}

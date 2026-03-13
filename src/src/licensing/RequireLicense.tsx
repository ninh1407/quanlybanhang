import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useLicense } from './useLicense'

export function RequireLicense(props: { children: ReactNode }) {
  const { loading, valid, stored } = useLicense()
  const location = useLocation()

  if (loading && !stored) {
    return (
      <div className="auth-page">
        <div className="card">
          <div className="card-title">Đang kiểm tra bản quyền...</div>
        </div>
      </div>
    )
  }

  if (!valid) {
    return <Navigate to="/license" replace state={{ from: location.pathname }} />
  }

  return props.children
}

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createEmptyWarehouseState } from '../state/seed'
import { useStore } from '../state/Store'
import { useAuth } from '../auth/auth'
import { accessibleLocations } from '../domain/warehouseAccess'
import { Store, User, Lock, ArrowRight, Settings } from 'lucide-react'
import { getServerUrl, getSavedIp, saveServerIp, DEFAULT_SERVER_IP } from '../config'

export function LoginPage() {
  const { dispatch } = useStore()
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [serverIp, setServerIp] = useState(getSavedIp())

  function onSaveConfig() {
    saveServerIp(serverIp)
    window.location.reload()
  }

  async function onLogin() {
    setError('')
    
    try {
      // API Login
      const serverUrl = getServerUrl()
      const res = await fetch(`${serverUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại')
      }

      // Save token
      localStorage.setItem('auth_token', data.accessToken)
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken)
      }
      
      const user = data.user
      const locations = data.locations
      const allowed = accessibleLocations(user, locations)
      if (!allowed.length) {
        setError('Tài khoản chưa được cấp quyền truy cập kho nào')
        return
      }

      // Important: Add user to state before login
      dispatch({ type: 'users/upsert', user })

      loginAs(user.id)

      if (allowed.length === 1) {
        const locId = allowed[0]!.id
        // Pre-load warehouse state? 
        // We might not have it yet if sync hasn't happened.
        // But Store will sync soon.
        // We can pass empty for now, Store will update via sync.
        dispatch({ type: 'session/switchLocation', locationId: locId, warehouse: createEmptyWarehouseState() })
        navigate(from, { replace: true })
        return
      }

      navigate('/select-warehouse', { replace: true, state: { from } })
    } catch (e: any) {
      setError(e.message || 'Lỗi kết nối Server')
    }
  }

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: 12, 
            background: 'var(--primary-50)', 
            borderRadius: '50%', 
            marginBottom: 16,
            color: 'var(--primary-600)'
          }}>
            <Store size={40} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>Quản lý gia dụng</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Đăng nhập để tiếp tục vào hệ thống quản lý</p>
        </div>
        
        <div className="field">
          <label>Tên đăng nhập</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Nhập tên đăng nhập"
              style={{ paddingLeft: 38 }}
            />
            <User size={18} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="field">
          <label>Mật khẩu</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Nhập mật khẩu"
              style={{ paddingLeft: 38 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLogin()
              }}
            />
            <Lock size={18} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          </div>
        </div>

        {error && (
          <div className="error" style={{ 
            background: '#fef2f2', 
            color: '#ef4444', 
            padding: '10px 12px', 
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button 
            className="btn btn-primary" 
            onClick={onLogin} 
            disabled={!username || !password}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            Vào hệ thống
            <ArrowRight size={18} />
          </button>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              fontSize: 13, 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: 0.7
            }}
          >
            <Settings size={14} />
            Cấu hình IP Server
          </button>
        </div>

        {showConfig && (
          <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, marginBottom: 4 }}>Địa chỉ IP VPS</label>
              <input 
                type="text" 
                value={serverIp} 
                onChange={(e) => setServerIp(e.target.value)} 
                placeholder={DEFAULT_SERVER_IP}
                style={{ fontSize: 13, padding: '8px 12px' }}
              />
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Mặc định: {DEFAULT_SERVER_IP}
              </p>
            </div>
            <button 
              className="btn btn-small" 
              onClick={onSaveConfig} 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Lưu & Kết nối lại
            </button>
          </div>
        )}
      </div>
      
      <div style={{ position: 'absolute', bottom: 24, color: 'var(--text-muted)', fontSize: 13 }}>
        © 2024 Quản lý gia dụng. All rights reserved.
      </div>
    </div>
  )
}

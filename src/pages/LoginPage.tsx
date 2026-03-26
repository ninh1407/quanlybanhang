import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createEmptyWarehouseState } from '../../shared/state/seed'
import { useStore } from '../state/Store'
import { useAuth } from '../auth/auth'
import { accessibleLocations } from '../../shared/domain/warehouseAccess'
import { Store, User, Lock, ArrowRight, Settings, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { getServerUrl, getSavedIp, saveServerIp, DEFAULT_SERVER_IP } from '../config'
import { loadSettings } from '../settings/settings'

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function LoginPage() {
  const { dispatch } = useStore()
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [rememberLogin, setRememberLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string; general?: string }>({})
  const [showConfig, setShowConfig] = useState(false)
  const [serverIp, setServerIp] = useState(getSavedIp())
  const brandName = useMemo(() => titleCase(loadSettings().companyName || 'Nam Phương'), [])

  useEffect(() => {
    let remember = true
    try {
      remember = localStorage.getItem('remember_login') !== '0'
    } catch {}
    setRememberLogin(remember)
    if (remember) {
      try {
        const saved = localStorage.getItem('remembered_username')
        if (saved) setUsername(saved)
      } catch {}
    }
  }, [])

  const canSubmit = useMemo(() => {
    return !!username.trim() && !!password
  }, [password, username])

  function onSaveConfig() {
    saveServerIp(serverIp)
    window.location.reload()
  }

  async function onLogin() {
    if (isLoading) return
    const nextErrors: { username?: string; password?: string; general?: string } = {}
    if (!username.trim()) nextErrors.username = 'Vui lòng nhập tên đăng nhập.'
    if (!password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
    setFieldErrors(nextErrors)
    if (nextErrors.username || nextErrors.password) return

    setIsLoading(true)
    
    try {
      // API Login
      const serverUrl = getServerUrl()
      const res = await fetch(`${serverUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại')
      }

      let storage: Storage = localStorage
      let other: Storage = sessionStorage
      if (!rememberLogin) {
        storage = sessionStorage
        other = localStorage
      }
      storage.setItem('auth_token', data.accessToken)
      if (data.refreshToken) storage.setItem('refresh_token', data.refreshToken)
      other.removeItem('auth_token')
      other.removeItem('refresh_token')

      try {
        localStorage.setItem('remember_login', rememberLogin ? '1' : '0')
        if (rememberLogin) localStorage.setItem('remembered_username', username.trim())
        else localStorage.removeItem('remembered_username')
      } catch {}
      
      const user = data.user
      const locations = data.locations
      const allowed = accessibleLocations(user, locations)
      if (!allowed.length) {
        setFieldErrors({ general: 'Tài khoản chưa được cấp quyền truy cập kho nào' })
        return
      }

      ;(locations || []).forEach((l: any) => {
        dispatch({ type: 'locations/upsert', location: l })
      })

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
      setFieldErrors({ general: e.message || 'Lỗi kết nối Server' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-header">
          <div className="auth-logo">
            <Store size={34} />
          </div>
          <h1 className="auth-title">{brandName}</h1>
          <p className="auth-subtitle">Đăng nhập để tiếp tục vào hệ thống quản lý</p>
        </div>
        
        <div className="field">
          <label>Tên đăng nhập</label>
          <div className="auth-input-wrap">
            <input 
              type="text" 
              value={username} 
              onChange={(e) => {
                setUsername(e.target.value)
                if (fieldErrors.username || fieldErrors.general) {
                  setFieldErrors((p) => ({ ...p, username: undefined, general: undefined }))
                }
              }} 
              placeholder="Nhập tên đăng nhập"
              className="auth-input with-left-icon"
            />
            <User size={18} className="auth-input-icon" />
          </div>
          {fieldErrors.username ? <div className="auth-field-error">{fieldErrors.username}</div> : null}
        </div>

        <div className="field">
          <label>Mật khẩu</label>
          <div className="auth-input-wrap">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password || fieldErrors.general) {
                  setFieldErrors((p) => ({ ...p, password: undefined, general: undefined }))
                }
              }} 
              placeholder="Nhập mật khẩu"
              className="auth-input with-left-icon"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLogin()
              }}
            />
            <Lock size={18} className="auth-input-icon" />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password ? <div className="auth-field-error">{fieldErrors.password}</div> : null}
        </div>

        {fieldErrors.general ? (
          <div className="error" style={{ background: 'rgba(254, 242, 242, 0.9)', padding: '10px 12px', borderRadius: 12, marginTop: 8 }}>
            {fieldErrors.general}
          </div>
        ) : null}

        <div className="auth-row">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>
        </div>

        <div style={{ marginTop: 24 }}>
          <button 
            className="btn btn-primary auth-submit" 
            onClick={onLogin} 
            disabled={!canSubmit || isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {isLoading ? (
              <>
                <span className="auth-spinner" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                Vào hệ thống
                <ArrowRight size={18} />
              </>
            )}
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
          {window.desktop && (
            <button
              onClick={() => window.dispatchEvent(new Event('app:update:open'))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: 0.7,
                marginLeft: 16
              }}
            >
              <RefreshCw size={14} />
              Cập nhật
            </button>
          )}
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

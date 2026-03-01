import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLicense } from '../licensing/useLicense'
import { getSecureNow } from '../licensing/secureTime'

function formatEpochSec(sec: number): string {
  if (!sec) return 'Không giới hạn'
  // If sec is small (like 0 or null), it means unlimited.
  // If sec is large timestamp (seconds), convert to Date.
  // JS Date uses ms, so * 1000
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return 'Không xác định'
  
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function LicensePage() {
  const nav = useNavigate()
  const location = useLocation()
  const { from } = (location.state as { from?: string }) || { from: '/' }

  const { desktop, hwid, stored, loading, checking, error, refresh, activate, unbind } = useLicense()
  const [keyDraft, setKeyDraft] = useState<string | null>(null)
  const keyValue = (keyDraft ?? stored?.key ?? '').trim()

  const statusText = useMemo(() => {
    if (!stored) return 'Chưa kích hoạt'
    if (stored.status === 'active') {
       if (stored.expireAt && stored.expireAt * 1000 < getSecureNow()) return 'Hết hạn'
       return 'Đang hoạt động'
    }
    if (stored.status === 'expired') return 'Hết hạn'
    if (stored.status === 'unbound') return 'Chưa kích hoạt'
    return 'Lỗi / Không xác định'
  }, [stored])

  const expiryText = useMemo(() => {
    if (!stored) return ''
    return formatEpochSec(stored.expireAt)
  }, [stored])

  async function onActivate() {
    if (!keyValue) return
    const next = await activate(keyValue)
    if (next?.status === 'active') {
        setKeyDraft(null)
        nav(from || '/', { replace: true })
    }
  }

  return (
    <div className="auth-page">
      <div className="card">
        <div className="row row-between" style={{ marginBottom: 10 }}>
          <button className="btn" onClick={() => nav(from || '/')}>
            Quay lại
          </button>
        </div>
        <div className="card-title">Kích hoạt bản quyền</div>

        {!desktop && (
          <div className="muted">
            Ứng dụng đang chạy trên web, HWID gắn với trình duyệt và sẽ đổi nếu bạn xóa dữ liệu trình duyệt hoặc dùng domain/port khác.
          </div>
        )}

        <div className="field">
          <label>Hardware ID (HWID)</label>
          <input value={hwid} readOnly />
        </div>

        <div className="field">
          <label>Key bản quyền</label>
          <input
            value={keyDraft ?? stored?.key ?? ''}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Nhập key..."
          />
        </div>

        <div className="field">
          <label>Trạng thái</label>
          <input value={statusText} readOnly />
        </div>

        {stored && (
          <div className="field">
            <label>Hết hạn</label>
            <input value={expiryText} readOnly />
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="row">
          <button className="btn btn-primary" onClick={onActivate} disabled={loading || !keyValue}>
            Kích hoạt
          </button>
          <button
            className="btn"
            onClick={async () => {
              const next = await refresh({ interactive: true })
              if (next?.key) setKeyDraft(null)
            }}
            disabled={loading || checking || !hwid}
          >
            Kiểm tra bản quyền
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await unbind()
              setKeyDraft(null)
            }}
            disabled={loading || !stored}
          >
            Đổi mã bản quyền (Xóa key)
          </button>
        </div>
      </div>
    </div>
  )
}

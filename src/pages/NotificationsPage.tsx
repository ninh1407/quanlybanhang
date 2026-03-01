import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../ui-kit/PageHeader'
import { useNotifications } from '../notifications/useNotifications'

export function NotificationsPage() {
  const nav = useNavigate()
  const { items, unreadCount, isRead, markRead, markAllRead } = useNotifications()

  return (
    <div className="page">
      <PageHeader
        title="Thông báo"
        actions={
          <>
            <button className="btn" onClick={markAllRead} disabled={!items.length}>
              Đánh dấu tất cả đã đọc
            </button>
          </>
        }
      />

      <div className="card">
        <div className="card-title">Danh sách ({unreadCount} chưa đọc)</div>
        {items.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((n) => {
              const read = isRead(n.id)
              return (
                <button
                  key={n.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    markRead(n.id)
                    nav(n.href)
                  }}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'space-between',
                    display: 'flex',
                    border: '1px solid var(--border-color)',
                    background: read ? 'transparent' : 'var(--neutral-100)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{n.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{n.detail}</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{read ? 'Đã đọc' : 'Mới'}</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: 16, color: 'var(--text-muted)' }}>Chưa có thông báo</div>
        )}
      </div>
    </div>
  )
}


import { useMemo } from 'react'
import { useNotifications } from '../notifications/useNotifications'
import { PageHeader } from '../ui-kit/PageHeader'
import { formatDateTime } from '../lib/date'
import { Bell, Check, Clock, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotificationsPage() {
  const { items, markRead, markAllRead, isRead } = useNotifications()
  const nav = useNavigate()

  const sorted = useMemo(() => {
    return items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items])

  function getIcon(type: string) {
      if (type === 'warning' || type === 'low_stock' || type === 'overdue_debt') return <AlertTriangle size={20} color="var(--warning)" />
      if (type === 'success') return <CheckCircle size={20} color="var(--success)" />
      if (type === 'error') return <AlertTriangle size={20} color="var(--danger)" />
      return <Info size={20} color="var(--info)" />
  }

  return (
    <div className="page">
      <PageHeader 
        title="Thông báo" 
        subtitle="Cập nhật quan trọng về đơn hàng và kho"
        actions={
            <button className="btn" onClick={markAllRead}>
                <Check size={16} />
                Đánh dấu tất cả đã đọc
            </button>
        }
      />

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {sorted.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sorted.map((n) => {
                    const read = isRead(n.id)
                    return (
                        <div 
                            key={n.id} 
                            className="card"
                            style={{ 
                                padding: 16, 
                                marginBottom: 0, 
                                display: 'flex', 
                                gap: 16,
                                background: read ? 'var(--bg-surface)' : 'var(--primary-50)',
                                borderLeft: read ? '1px solid var(--border-color)' : '4px solid var(--primary-500)',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                markRead(n.id)
                                if (n.href && n.href !== '#') nav(n.href)
                            }}
                        >
                            <div style={{ marginTop: 2 }}>
                                {getIcon(n.type)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: read ? 500 : 700, marginBottom: 4, color: 'var(--text-main)' }}>
                                    {n.title}
                                </div>
                                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    {n.detail}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                    <Clock size={12} />
                                    {formatDateTime(n.createdAt)}
                                </div>
                            </div>
                            {!read && (
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary-500)', marginTop: 6 }} />
                            )}
                        </div>
                    )
                })}
            </div>
        ) : (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                <div style={{ fontSize: 16, fontWeight: 500 }}>Không có thông báo mới</div>
                <p style={{ fontSize: 13, marginTop: 8 }}>Bạn sẽ nhận được thông báo khi có đơn hàng mới hoặc cảnh báo tồn kho.</p>
            </div>
        )}
      </div>
    </div>
  )
}


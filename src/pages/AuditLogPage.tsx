import { useMemo, useState } from 'react'
import { useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Pagination } from '../ui-kit/listing/Pagination'
import { useListView } from '../ui-kit/listing/useListView'
import { formatDateTime } from '../../shared/lib/date'
import { ChevronDown, ChevronRight, Activity, Clock, User } from 'lucide-react'

function JsonDiff({ before, after }: { before?: any; after?: any }) {
    const [expanded, setExpanded] = useState(false)
    
    if (!before && !after) return null

    return (
        <div style={{ marginTop: 8 }}>
            <button 
                className="btn btn-small btn-ghost" 
                onClick={() => setExpanded(!expanded)}
                style={{ fontSize: 12, padding: '4px 8px', height: 'auto' }}
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {expanded ? 'Thu gọn chi tiết' : 'Xem chi tiết thay đổi'}
            </button>
            
            {expanded && (
                <div style={{ 
                    marginTop: 8, 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: 12, 
                    fontSize: 12, 
                    fontFamily: 'monospace',
                    background: 'var(--bg-subtle)',
                    padding: 12,
                    borderRadius: 8
                }}>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Trước</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                            {JSON.stringify(before, null, 2) || '-'}
                        </pre>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Sau</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                            {JSON.stringify(after, null, 2) || '-'}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}

export function AuditLogPage() {
  const state = useAppState()
  const list = useListView('audit', {
    q: '',
    filters: {},
    page: 1,
    pageSize: 20,
    sortKey: 'timestamp',
    sortDir: 'desc',
  })

  const logs = useMemo(() => {
    return state.auditLogs
      .slice()
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
  }, [state.auditLogs])

  const paginatedLogs = logs.slice(
    (list.state.page - 1) * list.state.pageSize,
    list.state.page * list.state.pageSize
  )

  return (
    <div className="page">
      <PageHeader title="Nhật ký hoạt động" subtitle="Theo dõi mọi thay đổi trong hệ thống" />

      <div className="card">
        <div className="card-title" style={{ marginBottom: 24 }}>Dòng thời gian (Timeline)</div>
        
        <div className="timeline" style={{ paddingLeft: 16 }}>
            {paginatedLogs.map((log, idx) => {
                const user = state.users.find(u => u.id === log.actorUserId)
                const isLast = idx === paginatedLogs.length - 1
                
                return (
                    <div key={log.id} style={{ display: 'flex', gap: 24, position: 'relative', paddingBottom: isLast ? 0 : 32 }}>
                        {/* Line */}
                        {!isLast && (
                            <div style={{ 
                                position: 'absolute', 
                                left: 19, 
                                top: 40, 
                                bottom: 0, 
                                width: 2, 
                                background: 'var(--border-color)' 
                            }} />
                        )}

                        {/* Icon */}
                        <div style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '50%', 
                            background: 'var(--neutral-100)', 
                            border: '4px solid var(--bg-surface)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            zIndex: 1,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <Activity size={18} color="var(--primary-600)" />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginTop: -4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>{log.action}</span>
                                    <span style={{ 
                                        fontSize: 12, 
                                        padding: '2px 8px', 
                                        borderRadius: 12, 
                                        background: 'var(--neutral-100)', 
                                        color: 'var(--text-secondary)' 
                                    }}>
                                        {log.entityType}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                                    <Clock size={14} />
                                    {formatDateTime(log.createdAt)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <User size={14} />
                                <span style={{ fontWeight: 500 }}>{user?.username || 'Unknown'}</span>
                                {log.reason && <span>— {log.reason}</span>}
                            </div>

                            <JsonDiff before={log.before} after={log.after} />
                        </div>
                    </div>
                )
            })}
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <Pagination
            page={list.state.page}
            pageSize={list.state.pageSize}
            totalItems={logs.length}
            onChangePage={(page) => list.patch({ page })}
            />
        </div>
      </div>
    </div>
  )
}


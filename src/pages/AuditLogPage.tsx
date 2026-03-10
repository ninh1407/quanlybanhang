import { useMemo, useState } from 'react'
import { useAppState } from '../state/Store'
import { formatDateTime } from '../lib/date'
import { PageHeader } from '../ui-kit/PageHeader'
import type { AuditLog } from '../domain/types'

const entityLabels: Record<AuditLog['entityType'], string> = {
  order: 'Đơn hàng',
  stock_tx: 'Giao dịch kho',
  stock_voucher: 'Phiếu kho',
  stock_count: 'Phiếu kiểm kho',
  finance_tx: 'Giao dịch thu/chi',
  debt: 'Công nợ',
  product: 'Sản phẩm',
  sku: 'SKU',
  customer: 'Khách hàng',
  supplier: 'Thương hiệu',
  category: 'Danh mục',
  location: 'Vị trí kho',
  user: 'Nhân sự',
  request: 'Yêu cầu duyệt',
}

const actionLabels: Record<AuditLog['action'], string> = {
  create: 'Tạo',
  update: 'Sửa',
  delete: 'Xóa',
}

function stringifyShort(v: unknown): string {
  try {
    const s = JSON.stringify(v)
    if (!s) return ''
    return s.length > 600 ? `${s.slice(0, 600)}…` : s
  } catch {
    return ''
  }
}

export function AuditLogPage() {
  const state = useAppState()
  const [entity, setEntity] = useState<AuditLog['entityType'] | 'all'>('all')
  const [q, setQ] = useState('')

  const usersById = useMemo(() => new Map(state.users.map((u) => [u.id, u.fullName || u.username])), [state.users])

  const logs = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.auditLogs
      .filter((l) => (entity === 'all' ? true : l.entityType === entity))
      .filter((l) => {
        if (!needle) return true
        const actor = l.actorUserId ? usersById.get(l.actorUserId) ?? '' : ''
        const hay = [
          actor,
          l.entityType,
          l.entityId,
          l.entityCode ?? '',
          l.action,
          l.reason ?? '',
          stringifyShort(l.before),
          stringifyShort(l.after),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
  }, [entity, q, state.auditLogs, usersById])

  return (
    <div className="page">
      <PageHeader title="Nhật ký hệ thống" />

      <div className="card">
        <div className="card-title">Bộ lọc</div>
        <div className="grid-form">
          <div className="field">
            <label>Đối tượng</label>
            <select value={entity} onChange={(e) => setEntity(e.target.value as AuditLog['entityType'] | 'all')}>
              <option value="all">Tất cả</option>
              {Object.keys(entityLabels).map((k) => (
                <option key={k} value={k}>
                  {entityLabels[k as AuditLog['entityType']]}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-span-2">
            <label>Tìm kiếm</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã/ID, người thao tác, nội dung..." />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Danh sách ({logs.length})</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Lý do</th>
                <th>Trước</th>
                <th>Sau</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.createdAt)}</td>
                  <td>{l.actorUserId ? usersById.get(l.actorUserId) ?? l.actorUserId : '—'}</td>
                  <td>{actionLabels[l.action]}</td>
                  <td>
                    {entityLabels[l.entityType]} {l.entityCode ? `(${l.entityCode})` : ''}
                  </td>
                  <td>{l.reason ?? ''}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{stringifyShort(l.before)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{stringifyShort(l.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


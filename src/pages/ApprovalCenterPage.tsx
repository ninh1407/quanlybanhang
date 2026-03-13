import { useState } from 'react'
import { useAuth } from '../auth/auth'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import {
  CheckCircle,
  Plus,
  XCircle,
  ChevronRight,
  MapPin,
  ArrowRight,
  Trash2,
  Clock,
  Check,
  Flag
} from 'lucide-react'
import { InventoryRequest, InventoryRequestStatus, InventoryRequestType, StockVoucher, StockTransaction } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useDialogs } from '../ui-kit/Dialogs'

function statusLabel(status: InventoryRequestStatus) {
  switch (status) {
    case 'pending_manager':
      return <span className="badge badge-warning">Chờ quản lý duyệt</span>
    case 'pending_accountant':
      return <span className="badge badge-info">Chờ kế toán duyệt</span>
    case 'pending_ceo':
      return <span className="badge badge-danger">Chờ CEO duyệt (High Value)</span>
    case 'approved':
      return <span className="badge badge-success">Đã duyệt</span>
    case 'rejected':
      return <span className="badge badge-danger">Đã từ chối</span>
    case 'cancelled':
      return <span className="badge badge-neutral">Đã hủy</span>
    default:
      return status
  }
}

function typeLabel(type: InventoryRequestType) {
  switch (type) {
    case 'in': return 'Nhập kho'
    case 'out': return 'Xuất kho'
    case 'transfer': return 'Chuyển kho'
    case 'adjust': return 'Điều chỉnh'
    default: return type
  }
}

// Visual Stepper Component
function RequestStepper({ status }: { status: InventoryRequestStatus }) {
  const steps = [
    { key: 'create', label: 'Tạo yêu cầu', icon: <Plus size={14} /> },
    { key: 'pending', label: 'Chờ duyệt', icon: <Clock size={14} /> },
    { key: 'approved', label: 'Đã duyệt', icon: <Check size={14} /> },
    { key: 'completed', label: 'Hoàn tất', icon: <Flag size={14} /> }
  ]

  let activeIndex = 0
  if (status.startsWith('pending')) activeIndex = 1
  else if (status === 'approved') activeIndex = 2
  // For this demo, we treat approved as completed unless we track execution status separately
  if (status === 'approved') activeIndex = 3 
  
  if (status === 'rejected' || status === 'cancelled') {
      return (
          <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center' }}>
              <span className={`badge ${status === 'rejected' ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: 14, padding: '8px 16px' }}>
                  {status === 'rejected' ? '❌ Đã từ chối' : '🚫 Đã hủy'}
              </span>
          </div>
      )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', position: 'relative' }}>
      {/* Connector Line */}
      <div style={{ position: 'absolute', top: 35, left: 40, right: 40, height: 2, background: 'var(--border-color)', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: 35, left: 40, right: 40, height: 2, background: 'var(--primary-500)', zIndex: 0, width: `${(activeIndex / (steps.length - 1)) * 100}%`, transition: 'width 0.3s' }} />

      {steps.map((step, idx) => {
        const isActive = idx <= activeIndex
        const isCurrent = idx === activeIndex
        return (
          <div key={step.key} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
             <div 
                style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: isActive ? 'var(--primary-500)' : 'var(--bg-surface)',
                    border: isActive ? 'none' : '2px solid var(--border-color)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: isCurrent ? '0 0 0 4px var(--primary-100)' : 'none'
                }}
             >
                {step.icon}
             </div>
             <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
                 {step.label}
             </div>
          </div>
        )
      })}
    </div>
  )
}

function RequestRow({ request, onClick }: { request: InventoryRequest; onClick: () => void }) {
  const state = useAppState()
  const warehouse = state.locations.find(l => l.id === request.warehouseId)
  const targetWarehouse = request.targetWarehouseId ? state.locations.find(l => l.id === request.targetWarehouseId) : null
  const user = state.users.find(u => u.id === request.createdBy)

  return (
    <div className="card-row" onClick={onClick} style={{ cursor: 'pointer', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{request.code}</span>
          <span className="badge badge-neutral" style={{ fontSize: 11 }}>{typeLabel(request.type)}</span>
          {statusLabel(request.status)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
           <span>{user?.fullName || 'Unknown'}</span>
           <span>•</span>
           <span>{formatDateTime(request.createdAt)}</span>
           <span>•</span>
           <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
             <MapPin size={12} /> {warehouse?.name}
             {targetWarehouse && <><ArrowRight size={12} /> {targetWarehouse.name}</>}
           </span>
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  )
}

function RequestDetailModal({ request, onClose }: { request: InventoryRequest; onClose: () => void }) {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const dialogs = useDialogs()
  
  const warehouse = state.locations.find(l => l.id === request.warehouseId)
  const targetWarehouse = request.targetWarehouseId ? state.locations.find(l => l.id === request.targetWarehouseId) : null
  const creator = state.users.find(u => u.id === request.createdBy)

  const canApproveManager = request.status === 'pending_manager' && (user?.role === 'admin' || user?.role === 'manager')
  const canApproveAccountant = request.status === 'pending_accountant' && (user?.role === 'admin' || user?.role === 'accountant')
  const canApproveCEO = request.status === 'pending_ceo' && (user?.role === 'admin') // Assuming Admin acts as CEO for now
  const canReject = (canApproveManager || canApproveAccountant || canApproveCEO)
  const canCancel = request.status.startsWith('pending') && user?.id === request.createdBy

  const handleCancel = async () => {
      const confirm = await dialogs.confirm({ message: 'Bạn có chắc chắn muốn hủy yêu cầu này?' })
      if (!confirm) return

      const updatedRequest: InventoryRequest = {
          ...request,
          status: 'cancelled',
          updatedAt: nowIso(),
          logs: [
              ...request.logs,
              {
                  id: newId('log'),
                  action: 'cancel',
                  actorId: user?.id || '',
                  timestamp: nowIso(),
                  note: 'Người dùng tự hủy'
              }
          ]
      }
      dispatch({ type: 'requests/upsert', request: updatedRequest })
      onClose()
  }

  const handleApprove = async () => {
      const confirm = await dialogs.confirm({ message: 'Bạn có chắc chắn muốn duyệt yêu cầu này?' })
      if (!confirm) return

      let nextStatus: InventoryRequestStatus = request.status
      let action: 'approve_manager' | 'approve_accountant' = 'approve_manager'

      if (request.status === 'pending_manager') {
          nextStatus = 'pending_accountant'
          action = 'approve_manager'
      } else if (request.status === 'pending_accountant') {
          // Check for High Value Transfer logic
          const totalValue = request.items.reduce((sum, item) => sum + (item.qty * (item.unitCost || 0)), 0)
          if (request.type === 'transfer' && totalValue > 200000000) {
              nextStatus = 'pending_ceo'
              action = 'approve_accountant' // Accountant approved, now waiting for CEO
          } else {
              nextStatus = 'approved'
              action = 'approve_accountant'
          }
      } else if (request.status === 'pending_ceo') {
          nextStatus = 'approved'
          action = 'approve_ceo' as any
      }

      // Update Request
      const updatedRequest: InventoryRequest = {
          ...request,
          status: nextStatus,
          updatedAt: nowIso(),
          logs: [
              ...request.logs,
              {
                  id: newId('log'),
                  action,
                  actorId: user?.id || '',
                  timestamp: nowIso(),
                  note: 'Approved'
              }
          ]
      }
      
      dispatch({ type: 'requests/upsert', request: updatedRequest })
      
      // If fully approved, create Stock Voucher or Transaction
      if (nextStatus === 'approved') {
          // 1. Handle In/Out/Transfer via StockVoucher
          if (request.type === 'in' || request.type === 'out' || request.type === 'transfer') {
              const voucherId = newId('svc')
              const voucher: StockVoucher = {
                  id: voucherId,
                  code: '', // will be auto-generated
                  type: request.type,
                  status: 'draft',
                  fromLocationId: request.type === 'transfer' ? request.warehouseId : (request.type === 'out' ? request.warehouseId : null),
                  toLocationId: request.type === 'transfer' ? request.targetWarehouseId || null : (request.type === 'in' ? request.warehouseId : null),
                  note: `Tự động tạo từ yêu cầu duyệt ${request.code}`,
                  createdAt: nowIso(),
                  createdByUserId: user?.id || null,
                  finalizedAt: null,
                  lines: request.items.map(i => ({
                      skuId: i.skuId,
                      qty: i.qty,
                      unitCost: i.unitCost || null,
                      note: i.note || ''
                  }))
              }
              
              // Create Draft
              dispatch({ type: 'stockVouchers/upsert', voucher })
              // Finalize immediately
              dispatch({ type: 'stockVouchers/finalize', id: voucherId })
          } 
          // 2. Handle Adjust via StockTransaction
          else if (request.type === 'adjust') {
              request.items.forEach(item => {
                  const tx: StockTransaction = {
                      id: newId('stk'),
                      code: '',
                      type: 'adjust',
                      skuId: item.skuId,
                      locationId: request.warehouseId,
                      qty: item.qty, // Assuming positive means add, negative means subtract. Or strictly adjustments are logged as is.
                      unitCost: null,
                      note: `Điều chỉnh từ yêu cầu ${request.code}: ${item.note || ''}`,
                      createdAt: nowIso(),
                      refType: 'manual', // or add 'request' to refType if we update types
                      refId: request.id,
                      attachments: []
                  }
                  dispatch({ type: 'stock/add', tx })
              })
          }

          dispatch({
              type: 'notifications/add',
              notification: {
                  id: newId('notif'),
                  userId: request.createdBy,
                  title: 'Yêu cầu đã được duyệt',
                  message: `Yêu cầu ${request.code} đã được duyệt hoàn toàn.`,
                  type: 'success',
                  read: false,
                  createdAt: nowIso(),
                  link: '/approval-center'
              }
          })
      } else {
          // Notify next approver (mock)
           dispatch({
              type: 'notifications/add',
              notification: {
                  id: newId('notif'),
                  userId: 'admin', // Mock: notify admin/manager
                  title: 'Yêu cầu cần duyệt',
                  message: `Yêu cầu ${request.code} đang chờ bạn duyệt.`,
                  type: 'info',
                  read: false,
                  createdAt: nowIso(),
                  link: '/approval-center'
              }
          })
      }

      onClose()
  }

  const handleReject = async () => {
      const reason = await dialogs.prompt({ message: 'Lý do từ chối:', required: true })
      if (!reason) return

      const updatedRequest: InventoryRequest = {
          ...request,
          status: 'rejected',
          updatedAt: nowIso(),
          logs: [
              ...request.logs,
              {
                  id: newId('log'),
                  action: 'reject',
                  actorId: user?.id || '',
                  timestamp: nowIso(),
                  note: reason
              }
          ]
      }
      dispatch({ type: 'requests/upsert', request: updatedRequest })
      onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="card" style={{ width: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Chi tiết yêu cầu {request.code}</h3>
                <button onClick={onClose} className="btn btn-ghost btn-small"><XCircle size={20} /></button>
            </div>
            
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                
                <RequestStepper status={request.status} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: 'var(--bg-subtle)', padding: 16, borderRadius: 8 }}>
                    <div>
                        <label className="label-sm">Loại yêu cầu</label>
                        <div style={{ fontWeight: 500 }}>{typeLabel(request.type)}</div>
                    </div>
                    <div>
                        <label className="label-sm">Người tạo</label>
                        <div>{creator?.fullName}</div>
                    </div>
                    <div>
                        <label className="label-sm">Kho</label>
                        <div>{warehouse?.name}</div>
                    </div>
                    {targetWarehouse && (
                        <div>
                            <label className="label-sm">Kho đích</label>
                            <div>{targetWarehouse.name}</div>
                        </div>
                    )}
                    <div>
                        <label className="label-sm">Ngày tạo</label>
                        <div>{formatDateTime(request.createdAt)}</div>
                    </div>
                </div>

                <h4 style={{ marginBottom: 12 }}>Danh sách hàng hóa</h4>
                <table className="table" style={{ marginBottom: 24 }}>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Tên sản phẩm</th>
                            <th style={{ textAlign: 'right' }}>SL</th>
                            <th>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {request.items.map((item, idx) => {
                             const sku = state.skus.find(s => s.id === item.skuId)
                             const product = state.products.find(p => p.id === sku?.productId)
                             return (
                                 <tr key={idx}>
                                     <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sku?.skuCode}</td>
                                     <td>{product?.name}</td>
                                     <td style={{ fontWeight: 600, textAlign: 'right' }}>{item.qty}</td>
                                     <td style={{ color: 'var(--text-secondary)' }}>{item.note}</td>
                                 </tr>
                             )
                        })}
                    </tbody>
                </table>

                <h4 style={{ marginBottom: 12 }}>Timeline xử lý</h4>
                <div className="timeline" style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {request.logs.map(log => {
                        const actor = state.users.find(u => u.id === log.actorId)
                        return (
                            <div key={log.id} style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: -21, top: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)' }} />
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {log.action === 'create' ? 'Tạo yêu cầu' : 
                                     log.action === 'approve_manager' ? 'Quản lý duyệt' :
                                     log.action === 'approve_accountant' ? 'Kế toán duyệt' :
                                     log.action === 'approve_ceo' ? 'CEO duyệt' :
                                     log.action === 'reject' ? 'Từ chối' : 'Hủy'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {actor?.fullName} • {formatDateTime(log.timestamp)}
                                </div>
                                {log.note && <div style={{ fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>"{log.note}"</div>}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                {canReject && (
                    <button className="btn btn-danger" onClick={handleReject}>Từ chối</button>
                )}
                {(canApproveManager || canApproveAccountant || canApproveCEO) && (
                    <button className="btn btn-primary" onClick={handleApprove}>
                        <CheckCircle size={16} /> Duyệt {canApproveCEO ? '(CEO)' : ''}
                    </button>
                )}
                {canCancel && (
                    <button className="btn" onClick={handleCancel}>Hủy yêu cầu</button>
                )}
                <button className="btn" onClick={onClose}>Đóng</button>
            </div>
        </div>
    </div>
  )
}

function CreateRequestModal({ onClose }: { onClose: () => void }) {
    const state = useAppState()
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const dialogs = useDialogs()

    const [type, setType] = useState<InventoryRequestType>('in')
    const [warehouseId, setWarehouseId] = useState(state.locations[0]?.id || '')
    const [targetWarehouseId, setTargetWarehouseId] = useState('')
    const [items, setItems] = useState<any[]>([]) 
    const [note, setNote] = useState('')

    // Simple item adder
    const [skuId, setSkuId] = useState(state.skus[0]?.id || '')
    const [qty, setQty] = useState(1)

    const addItem = () => {
        if (qty <= 0) return
        if (items.find(i => i.skuId === skuId)) return dialogs.alert({ message: 'Sản phẩm đã có trong danh sách' })
        setItems([...items, { skuId, qty }])
        setQty(1)
    }

    const removeItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        setItems(newItems)
    }

    const handleSubmit = async () => {
        if (!items.length) return dialogs.alert({ message: 'Vui lòng thêm ít nhất 1 sản phẩm' })
        
        const request: InventoryRequest = {
            id: newId('req'),
            code: '', // Auto-generated
            type,
            status: 'pending_manager',
            warehouseId,
            targetWarehouseId: type === 'transfer' ? targetWarehouseId : undefined,
            items,
            note,
            logs: [{
                id: newId('log'),
                action: 'create',
                actorId: user?.id || '',
                timestamp: nowIso(),
                note: 'Khởi tạo'
            }],
            createdBy: user?.id || '',
            createdAt: nowIso(),
            updatedAt: nowIso()
        }

        dispatch({ type: 'requests/upsert', request })
        
        // Notify Manager
        dispatch({
              type: 'notifications/add',
              notification: {
                  id: newId('notif'),
                  userId: 'admin', // Mock manager
                  title: 'Yêu cầu mới',
                  message: `Nhân viên ${user?.fullName} vừa tạo yêu cầu mới.`,
                  type: 'info',
                  read: false,
                  createdAt: nowIso(),
                  link: '/approval-center'
              }
        })

        onClose()
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="card-title" style={{ padding: 16, borderBottom: '1px solid var(--border-color)', margin: 0 }}>
                    Tạo yêu cầu mới
                </div>
                
                <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="field">
                            <label>Loại yêu cầu</label>
                            <select value={type} onChange={e => setType(e.target.value as any)}>
                                <option value="in">Nhập kho</option>
                                <option value="out">Xuất kho</option>
                                <option value="transfer">Chuyển kho</option>
                                <option value="adjust">Điều chỉnh</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Kho</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                                {(state.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {type === 'transfer' && (
                        <div className="field" style={{ marginTop: 16 }}>
                            <label>Kho đích</label>
                            <select value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)}>
                                <option value="">Chọn kho đích...</option>
                                {(state.locations || []).filter(l => l.id !== warehouseId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    )}
                    
                    <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                        <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Thêm sản phẩm</label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <select value={skuId} onChange={e => setSkuId(e.target.value)} style={{ flex: 1 }}>
                                {(state.skus || []).map(s => {
                                    const p = (state.products || []).find(x => x.id === s.productId)
                                    return <option key={s.id} value={s.id}>{p?.name} ({s.skuCode})</option>
                                })}
                            </select>
                            <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 80 }} />
                            <button className="btn btn-primary btn-small" onClick={addItem}>Thêm</button>
                        </div>

                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                            <table className="table">
                                <thead style={{ background: 'var(--bg-subtle)' }}>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Tên sản phẩm</th>
                                        <th style={{ textAlign: 'right', width: 80 }}>SL</th>
                                        <th style={{ width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, idx) => {
                                         const sku = state.skus.find(s => s.id === it.skuId)
                                         const product = state.products.find(p => p.id === sku?.productId)
                                         return (
                                            <tr key={idx}>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{sku?.skuCode}</td>
                                                <td>{product?.name}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.qty}</td>
                                                <td>
                                                    <button className="btn-icon text-danger" onClick={() => removeItem(idx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                         )
                                    })}
                                    {items.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Chưa có sản phẩm nào</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="field" style={{ marginTop: 20 }}>
                        <label>Ghi chú</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} />
                    </div>
                </div>

                <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn" onClick={onClose}>Hủy</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>Tạo yêu cầu</button>
                </div>
            </div>
        </div>
    )
}

export function ApprovalCenterPage() {
  const state = useAppState()
  const { user } = useAuth()
  const [tab, setTab] = useState<'pending' | 'my_requests' | 'history'>('pending')
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const pendingRequests = (state.requests || []).filter(r => {
      if (user?.role === 'admin') {
          return r.status === 'pending_manager' || r.status === 'pending_accountant' || r.status === 'pending_ceo'
      }
      if (user?.role === 'manager') return r.status === 'pending_manager'
      if (user?.role === 'accountant') return r.status === 'pending_accountant'
      return false
  })

  const myRequests = (state.requests || []).filter(r => r.createdBy === user?.id)
  
  const historyRequests = (state.requests || []).filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled')

  const displayedRequests = tab === 'pending' ? pendingRequests : tab === 'my_requests' ? myRequests : historyRequests

  return (
    <div className="page">
      <PageHeader 
        title="Trung tâm phê duyệt"  
        actions={
            <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                <Plus size={16} /> Tạo yêu cầu
            </button>
        }
      />

      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
           Cần duyệt <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{pendingRequests.length}</span>
        </button>
        <button className={`tab ${tab === 'my_requests' ? 'active' : ''}`} onClick={() => setTab('my_requests')}>
           Yêu cầu của tôi
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
           Lịch sử
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
          {displayedRequests.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có dữ liệu
              </div>
          ) : (
              displayedRequests.map(r => (
                  <RequestRow key={r.id} request={r} onClick={() => setSelectedRequest(r)} />
              ))
          )}
      </div>

      {selectedRequest && (
          <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
      )}

      {isCreating && (
          <CreateRequestModal onClose={() => setIsCreating(false)} />
      )}
    </div>
  )
}

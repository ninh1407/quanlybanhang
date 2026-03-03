import { useMemo, useState } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { newId } from '../lib/id'
import { nowIso } from '../lib/date'
import { useAuth } from '../auth/auth'
import { useDialogs } from '../ui-kit/Dialogs'
import { 
  Plus, 
} from 'lucide-react'
import type { TransferOrder, TransferOrderStatus, StockTransaction } from '../domain/types'

// Helper for status badge
function StatusBadge({ status }: { status: TransferOrderStatus }) {
    const colors: Record<string, string> = {
        draft: 'var(--text-muted)',
        requested: 'var(--primary-600)',
        approved: 'var(--info-600)',
        in_transit: 'var(--warning-600)',
        partially_received: 'var(--warning-700)',
        completed: 'var(--success-600)',
        closed: 'var(--text-secondary)',
        rejected: 'var(--danger)'
    }
    const bgColors: Record<string, string> = {
        draft: 'var(--neutral-100)',
        requested: 'var(--primary-100)',
        approved: 'var(--info-100)',
        in_transit: 'var(--warning-100)',
        partially_received: 'var(--warning-50)',
        completed: 'var(--success-100)',
        closed: 'var(--neutral-200)',
        rejected: 'var(--danger-100)'
    }
    
    const labels: Record<string, string> = {
        draft: 'Nháp',
        requested: 'Yêu cầu',
        approved: 'Đã duyệt',
        in_transit: 'Đang giao',
        partially_received: 'Nhận một phần',
        completed: 'Hoàn thành',
        closed: 'Đóng',
        rejected: 'Từ chối'
    }

    return (
        <span style={{ 
            background: bgColors[status] || '#eee', 
            color: colors[status] || '#333', 
            padding: '2px 8px', 
            borderRadius: 4, 
            fontSize: 12, 
            fontWeight: 600,
            textTransform: 'uppercase'
        }}>
            {labels[status] || status.replace('_', ' ')}
        </span>
    )
}

export function TransferOrderPage() {
    const state = useAppState()
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const dialogs = useDialogs()
    
    // View Mode: 'list' | 'detail' | 'create'
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>('list')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    
    // Form State
    const [formData, setFormData] = useState<Partial<TransferOrder>>({
        lines: []
    })
    
    // Derived Data
    const selectedOrder = state.transferOrders.find(x => x.id === selectedId)
    const isReceiver = selectedOrder ? (state.currentLocationId === selectedOrder.toLocationId) : false
    
    const locations = useMemo(() => state.locations.filter(l => l.active), [state.locations])

    // New state for receiving
    const [receivingState, setReceivingState] = useState<Record<string, { received: number; lost: number; note: string }>>({})
    const [shippingFee, setShippingFee] = useState(0)

    function handleReceiveChange(skuId: string, field: 'received' | 'lost' | 'note', value: any) {
        setReceivingState(prev => {
            const item = prev[skuId] || { received: 0, lost: 0, note: '' }
            return { ...prev, [skuId]: { ...item, [field]: value } }
        })
    }
    
    // Actions
    const handleSave = async () => {
        if (!formData.fromLocationId || !formData.toLocationId) {
            return dialogs.alert({ message: 'Vui lòng chọn kho đi và kho đến' })
        }
        if (formData.fromLocationId === formData.toLocationId) {
            return dialogs.alert({ message: 'Kho đi và kho đến không được trùng nhau' })
        }
        if (!formData.lines?.length) {
            return dialogs.alert({ message: 'Vui lòng thêm sản phẩm' })
        }
        
        const order: TransferOrder = {
            id: formData.id || newId('to'),
            code: formData.code || '',
            status: formData.status || 'draft',
            fromLocationId: formData.fromLocationId,
            toLocationId: formData.toLocationId,
            lines: formData.lines.map(l => ({
                skuId: l.skuId,
                requestedQty: Number(l.requestedQty),
                shippedQty: Number(l.shippedQty) || 0,
                receivedQty: Number(l.receivedQty) || 0,
                lostQty: Number(l.lostQty) || 0,
                unitCost: Number(l.unitCost) || 0,
                note: l.note || ''
            })),
            shippingFee: Number(formData.shippingFee) || 0,
            carrierName: formData.carrierName || '',
            trackingCode: formData.trackingCode || '',
            estimatedArrival: formData.estimatedArrival || '',
            note: formData.note || '',
            logs: formData.logs || [{
                id: newId('log'),
                action: 'create',
                actorId: user?.id || 'system',
                timestamp: nowIso(),
                note: 'Khởi tạo phiếu chuyển kho'
            }],
            createdByUserId: formData.createdByUserId || user?.id || 'system',
            createdAt: formData.createdAt || nowIso(),
            updatedAt: nowIso()
        }
        
        dispatch({ type: 'transferOrders/upsert', order })
        setViewMode('list')
        setFormData({})
    }
    
    const handleTransition = async (action: string, nextStatus: TransferOrderStatus) => {
        if (!selectedOrder) return
        
        // Log entry
        const log = {
            id: newId('log'),
            action,
            actorId: user?.id || 'system',
            timestamp: nowIso(),
            note: `Chuyển trạng thái sang ${nextStatus}`
        }
        
        // Logic for Ledger when Shipping / Receiving
        if (nextStatus === 'in_transit') {
            // SHIP: Credit Source Inventory
            selectedOrder.lines.forEach(line => {
                const qtyToShip = line.shippedQty || line.requestedQty
                if (qtyToShip > 0) {
                    const txOut: StockTransaction = {
                        id: newId('stk'),
                        code: '',
                        type: 'out',
                        skuId: line.skuId,
                        locationId: selectedOrder.fromLocationId,
                        qty: qtyToShip,
                        unitCost: line.unitCost,
                        note: `Chuyển kho đi: ${selectedOrder.code}`,
                        createdAt: nowIso(),
                        refType: 'voucher',
                        refId: selectedOrder.id
                    }
                    dispatch({ type: 'stock/add', tx: txOut })
                }
            })
        }
        
        let updatedLines = selectedOrder.lines

        if (nextStatus === 'completed' || nextStatus === 'partially_received') {
             // Handle Shipping Fee
             if (shippingFee > 0) {
                 dispatch({ type: 'finance/add', tx: {
                     id: newId('fi'),
                     code: '',
                     amount: shippingFee,
                     type: 'expense',
                     category: 'shipping',
                     note: `Phí vận chuyển phiếu ${selectedOrder.code}`,
                     createdAt: nowIso(),
                     refType: 'manual', // or add 'transfer_order' to refTypes
                     refId: selectedOrder.id,
                     attachments: []
                 }})
             }

             // Update lines with receiving data
             updatedLines = selectedOrder.lines.map(line => {
                 const receiveData = receivingState[line.skuId]
                 const defaultReceived = line.shippedQty || line.requestedQty
                 const received = receiveData ? receiveData.received : defaultReceived
                 
                 return {
                     ...line,
                     receivedQty: received,
                     lostQty: receiveData?.lost || 0,
                     note: receiveData?.note || line.note
                 }
             })

             // RECEIVE: Credit In-Transit, Debit Dest Inventory
             updatedLines.forEach(line => {
                const received = line.receivedQty || 0
                const receiveNote = receivingState[line.skuId]?.note
                
                if (received > 0) {
                    const txIn: StockTransaction = {
                        id: newId('stk'),
                        code: '',
                        type: 'in',
                        skuId: line.skuId,
                        locationId: selectedOrder.toLocationId,
                        qty: received,
                        unitCost: line.unitCost,
                        note: receiveNote || `Nhận hàng chuyển kho: ${selectedOrder.code}`,
                        createdAt: nowIso(),
                        refType: 'voucher',
                        refId: selectedOrder.id
                    }
                    dispatch({ type: 'stock/add', tx: txIn })
                }
             })
        }

        const updated = {
            ...selectedOrder,
            lines: updatedLines,
            status: nextStatus,
            updatedAt: nowIso(),
            logs: [log, ...selectedOrder.logs]
        }
        
        dispatch({ type: 'transferOrders/upsert', order: updated })
        
        if (nextStatus === 'completed') {
            setReceivingState({})
            setShippingFee(0)
        }
    }

    if (viewMode === 'list') {
        return (
            <div className="page">
                <PageHeader 
                    title="Chuyển kho doanh nghiệp (Enterprise Transfer)" 
                    actions={
                        <button className="btn btn-primary" onClick={() => { setFormData({}); setViewMode('create') }}>
                            <Plus size={16} /> Tạo phiếu chuyển
                        </button>
                    }
                />
                
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Mã phiếu</th>
                                <th>Từ kho</th>
                                <th>Đến kho</th>
                                <th>Trạng thái</th>
                                <th>Ngày tạo</th>
                                <th>Người tạo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.transferOrders.map(order => (
                                <tr key={order.id} onClick={() => { setSelectedId(order.id); setViewMode('detail') }} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600 }}>{order.code}</td>
                                    <td>{locations.find(l => l.id === order.fromLocationId)?.name}</td>
                                    <td>{locations.find(l => l.id === order.toLocationId)?.name}</td>
                                    <td><StatusBadge status={order.status} /></td>
                                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td>{state.users.find(u => u.id === order.createdByUserId)?.fullName}</td>
                                </tr>
                            ))}
                            {!state.transferOrders.length && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có phiếu chuyển kho nào</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    if (viewMode === 'create' || (viewMode === 'detail' && selectedOrder)) {
        const isEdit = viewMode === 'detail'
        const data = isEdit ? selectedOrder! : formData
        const canEdit = !isEdit || data.status === 'draft'

        return (
            <div className="page">
                <PageHeader 
                    title={isEdit ? `Chi tiết: ${data.code}` : 'Tạo phiếu chuyển kho'} 
                    onBack={() => setViewMode('list')}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {canEdit && <button className="btn btn-primary" onClick={handleSave}>Lưu nháp</button>}
                            
                            {isEdit && data.status === 'draft' && (
                                <button className="btn btn-primary" onClick={() => handleTransition('request', 'requested')}>Gửi yêu cầu</button>
                            )}
                            {isEdit && data.status === 'requested' && (
                                <button className="btn btn-success" onClick={() => handleTransition('approve', 'approved')}>Duyệt</button>
                            )}
                            {isEdit && data.status === 'approved' && (
                                <button className="btn btn-warning" onClick={() => handleTransition('ship', 'in_transit')}>Xuất hàng (Ship)</button>
                            )}
                            {isEdit && data.status === 'in_transit' && (
                                <button className="btn btn-success" onClick={() => handleTransition('receive', 'completed')}>Nhận hàng (Receive)</button>
                            )}
                        </div>
                    }
                />

                <div className="grid-form" style={{ gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                    <div className="card">
                         <div className="card-title">Thông tin chung</div>
                         <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                             <div className="field">
                                 <label>Kho đi (Source)</label>
                                 <select 
                                    value={data.fromLocationId} 
                                    onChange={e => setFormData({...data, fromLocationId: e.target.value})}
                                    disabled={!canEdit}
                                 >
                                     <option value="">-- Chọn kho --</option>
                                     {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                 </select>
                             </div>
                             <div className="field">
                                 <label>Kho đến (Destination)</label>
                                 <select 
                                    value={data.toLocationId} 
                                    onChange={e => setFormData({...data, toLocationId: e.target.value})}
                                    disabled={!canEdit}
                                 >
                                     <option value="">-- Chọn kho --</option>
                                     {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                 </select>
                             </div>
                         </div>
                         
                         <div className="field" style={{ marginTop: 16 }}>
                             <label>Ghi chú</label>
                             <textarea 
                                value={data.note} 
                                onChange={e => setFormData({...data, note: e.target.value})}
                                disabled={!canEdit}
                                rows={3}
                             />
                         </div>

                         {/* Lines */}
                          <div style={{ marginTop: 24 }}>
                              {data.status === 'in_transit' && isReceiver && (
                                 <div style={{ marginBottom: 16 }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                         <label style={{ fontWeight: 600 }}>Phí vận chuyển:</label>
                                         <input 
                                             type="number" 
                                             value={shippingFee} 
                                             onChange={e => setShippingFee(Number(e.target.value))} 
                                             style={{ width: 150, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                         />
                                     </div>
                                     <div style={{ background: '#f9f9f9', padding: 8, borderRadius: 4 }}>
                                         <div style={{ fontWeight: 600, marginBottom: 8 }}>Nhập kho</div>
                                         {data.lines?.map(line => (
                                             <div key={line.skuId} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                                                 <div style={{ flex: 1 }}>{state.skus.find(s => s.id === line.skuId)?.skuCode}</div>
                                                 <div style={{ width: 100 }}>SL Gửi: {line.shippedQty || line.requestedQty}</div>
                                                 <div style={{ width: 120 }}>
                                                     <input 
                                                         type="number" 
                                                         placeholder="Thực nhận"
                                                         value={receivingState[line.skuId]?.received ?? (line.shippedQty || line.requestedQty)}
                                                         onChange={e => handleReceiveChange(line.skuId, 'received', Number(e.target.value))}
                                                         style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                     />
                                                 </div>
                                                 <div style={{ width: 120 }}>
                                                     <input 
                                                         type="number" 
                                                         placeholder="Mất/Hỏng"
                                                         value={receivingState[line.skuId]?.lost ?? 0}
                                                         onChange={e => handleReceiveChange(line.skuId, 'lost', Number(e.target.value))}
                                                         style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                     />
                                                 </div>
                                                 <div style={{ flex: 1 }}>
                                                     <input 
                                                         type="text" 
                                                         placeholder="Ghi chú"
                                                         value={receivingState[line.skuId]?.note ?? ''}
                                                         onChange={e => handleReceiveChange(line.skuId, 'note', e.target.value)}
                                                         style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                     />
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                     <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                         <button className="btn btn-primary" onClick={() => handleTransition('receive', 'completed')}>
                                             Nhận đủ & Hoàn thành
                                         </button>
                                         <button className="btn btn-warning" onClick={() => handleTransition('receive', 'partially_received')}>
                                             Nhận một phần
                                         </button>
                                     </div>
                                 </div>
                             )}
                             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                 <h4>Danh sách sản phẩm</h4>
                                 {canEdit && (
                                     <button className="btn btn-small btn-secondary" onClick={() => {
                                         // Mock adding item
                                         const sku = state.skus[0]
                                         if (!sku) return
                                         setFormData({
                                             ...data,
                                             lines: [...(data.lines || []), {
                                                 skuId: sku.id,
                                                 requestedQty: 1,
                                                 shippedQty: 0,
                                                 receivedQty: 0,
                                                 lostQty: 0,
                                                 unitCost: sku.cost,
                                                 note: ''
                                             }]
                                         })
                                     }}>+ Thêm sản phẩm</button>
                                 )}
                             </div>
                             <table className="table">
                                 <thead>
                                     <tr>
                                         <th>SKU</th>
                                         <th style={{ textAlign: 'right' }}>Yêu cầu</th>
                                         <th style={{ textAlign: 'right' }}>Thực xuất</th>
                                         <th style={{ textAlign: 'right' }}>Thực nhận</th>
                                         <th style={{ textAlign: 'right' }}>Hao hụt</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {data.lines?.map((line, idx) => (
                                         <tr key={idx}>
                                             <td>
                                                 {state.skus.find(s => s.id === line.skuId)?.skuCode}
                                             </td>
                                             <td align="right">
                                                 {canEdit ? (
                                                     <input 
                                                        type="number" 
                                                        value={line.requestedQty}
                                                        onChange={e => {
                                                            const newLines = [...(data.lines || [])]
                                                            newLines[idx].requestedQty = Number(e.target.value)
                                                            setFormData({...data, lines: newLines})
                                                        }}
                                                        style={{ width: 80, textAlign: 'right' }}
                                                     />
                                                 ) : line.requestedQty}
                                             </td>
                                             <td align="right">
                                                 {data.status === 'approved' || data.status === 'in_transit' ? (
                                                     <input 
                                                        type="number" 
                                                        value={line.shippedQty}
                                                        onChange={e => {
                                                            // Only editable during ship phase usually, but for demo allow edit
                                                            if (data.status !== 'approved') return
                                                            const newLines = [...(data.lines || [])]
                                                            newLines[idx].shippedQty = Number(e.target.value)
                                                            setFormData({...data, lines: newLines})
                                                        }}
                                                        style={{ width: 80, textAlign: 'right' }}
                                                        disabled={data.status !== 'approved'}
                                                     />
                                                 ) : line.shippedQty}
                                             </td>
                                             <td align="right">
                                                 {data.status === 'in_transit' ? (
                                                     <input 
                                                        type="number" 
                                                        value={line.receivedQty}
                                                        onChange={e => {
                                                            const newLines = [...(data.lines || [])]
                                                            newLines[idx].receivedQty = Number(e.target.value)
                                                            setFormData({...data, lines: newLines})
                                                        }}
                                                        style={{ width: 80, textAlign: 'right' }}
                                                     />
                                                 ) : line.receivedQty}
                                             </td>
                                             <td align="right">{line.lostQty}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Vận chuyển & Timeline</div>
                        <div className="field">
                             <label>Đơn vị vận chuyển</label>
                             <input 
                                value={data.carrierName} 
                                onChange={e => setFormData({...data, carrierName: e.target.value})}
                                disabled={!canEdit && data.status !== 'approved'}
                                placeholder="Viettel Post, GHN..."
                             />
                        </div>
                        <div className="field">
                             <label>Mã vận đơn</label>
                             <input 
                                value={data.trackingCode} 
                                onChange={e => setFormData({...data, trackingCode: e.target.value})}
                                disabled={!canEdit && data.status !== 'approved'}
                             />
                        </div>
                        <div className="field">
                             <label>Chi phí vận chuyển</label>
                             <input 
                                type="number"
                                value={data.shippingFee} 
                                onChange={e => setFormData({...data, shippingFee: Number(e.target.value)})}
                                disabled={!canEdit && data.status !== 'approved'}
                             />
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <h4>Lịch sử hoạt động</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {data.logs?.map(log => (
                                    <div key={log.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                                        <div style={{ color: 'var(--text-muted)', minWidth: 80 }}>
                                            {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            <br/>
                                            {new Date(log.timestamp).toLocaleDateString()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{log.action}</div>
                                            <div>{log.note}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                by {state.users.find(u => u.id === log.actorId)?.username}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

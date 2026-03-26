import { useMemo, useState } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { newId } from '../../shared/lib/id'
import { nowIso, formatDateTime } from '../../shared/lib/date'
import { useAuth } from '../auth/auth'
import { useDialogs } from '../ui-kit/Dialogs'
import { 
  Plus,
  ArrowRight,
  Check,
  Box,
  Truck,
  Trash2
} from 'lucide-react'
import type { TransferOrder, TransferOrderStatus, StockTransaction } from '../../shared/types/domain'

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

function TransferTimeline({ status }: { status: TransferOrderStatus }) {
    const steps = [
        { key: 'draft', label: 'Tạo phiếu', icon: <Plus size={14} /> },
        { key: 'approved', label: 'Duyệt & Đóng gói', icon: <Box size={14} /> },
        { key: 'in_transit', label: 'Đang vận chuyển', icon: <Truck size={14} /> },
        { key: 'completed', label: 'Đã nhận hàng', icon: <Check size={14} /> }
    ]

    let activeIndex = 0
    if (status === 'requested') activeIndex = 0
    else if (status === 'approved') activeIndex = 1
    else if (status === 'in_transit') activeIndex = 2
    else if (status === 'completed' || status === 'partially_received') activeIndex = 3
    
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', position: 'relative', background: 'var(--bg-subtle)', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ position: 'absolute', top: 35, left: 60, right: 60, height: 2, background: 'var(--border-color)', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 35, left: 60, right: 60, height: 2, background: 'var(--primary-500)', zIndex: 0, width: `${(activeIndex / (steps.length - 1)) * 100}%`, transition: 'width 0.3s' }} />

            {steps.map((step, idx) => {
                const isActive = idx <= activeIndex
                return (
                    <div key={step.key} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                            width: 32, height: 32, borderRadius: '50%', 
                            background: isActive ? 'var(--primary-500)' : 'var(--bg-surface)',
                            border: isActive ? 'none' : '2px solid var(--border-color)',
                            color: isActive ? '#fff' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: idx === activeIndex ? '0 0 0 4px var(--primary-100)' : 'none'
                        }}>
                            {step.icon}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{step.label}</div>
                    </div>
                )
            })}
        </div>
    )
}

export function TransferOrderPage() {
    const state = useAppState()
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const dialogs = useDialogs()
    
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>('list')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    
    // Create Wizard Step
    const [createStep, setCreateStep] = useState<1 | 2 | 3>(1)

    const [formData, setFormData] = useState<Partial<TransferOrder>>({
        lines: []
    })
    
    const selectedOrder = state.transferOrders.find(x => x.id === selectedId)
    const isReceiver = selectedOrder ? (state.currentLocationId === selectedOrder.toLocationId) : false
    const locations = useMemo(() => state.locations.filter(l => l.active), [state.locations])
    
    // For step 2: Product Selection
    const [skuId, setSkuId] = useState('')
    const [qty, setQty] = useState(1)

    // New state for receiving
    const [receivingState, setReceivingState] = useState<Record<string, { received: number; lost: number; note: string }>>({})
    const [shippingFee, setShippingFee] = useState(0)

    function handleReceiveChange(skuId: string, field: 'received' | 'lost' | 'note', value: any) {
        setReceivingState(prev => {
            const item = prev[skuId] || { received: 0, lost: 0, note: '' }
            return { ...prev, [skuId]: { ...item, [field]: value } }
        })
    }
    
    const handleSave = async () => {
        if (!formData.fromLocationId || !formData.toLocationId) return dialogs.alert({ message: 'Vui lòng chọn kho đi và kho đến' })
        if (!formData.lines?.length) return dialogs.alert({ message: 'Vui lòng thêm sản phẩm' })
        
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
        setCreateStep(1)
    }
    
    const handleTransition = async (action: string, nextStatus: TransferOrderStatus) => {
        if (!selectedOrder) return
        
        const log = {
            id: newId('log'),
            action,
            actorId: user?.id || 'system',
            timestamp: nowIso(),
            note: `Chuyển trạng thái sang ${nextStatus}`
        }
        
        if (nextStatus === 'in_transit') {
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
             if (shippingFee > 0) {
                 dispatch({ type: 'finance/add', tx: {
                     id: newId('fi'),
                     code: '',
                     amount: shippingFee,
                     type: 'expense',
                     category: 'shipping',
                     note: `Phí vận chuyển phiếu ${selectedOrder.code}`,
                     createdAt: nowIso(),
                     refType: 'manual',
                     refId: selectedOrder.id,
                     attachments: []
                 }})
             }

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

    // Helper to calculate stock for Create Step 2
    const getStock = (skuId: string, locationId: string) => {
        let stock = 0
        state.stockTransactions.forEach(t => {
            if (t.skuId === skuId && t.locationId === locationId) {
                stock += t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
            }
        })
        return stock
    }

    const addItem = () => {
        if (!skuId) return
        if (qty <= 0) return
        const existing = formData.lines?.find(l => l.skuId === skuId)
        if (existing) return dialogs.alert({ message: 'Sản phẩm đã có trong danh sách' })

        const sku = state.skus.find(s => s.id === skuId)
        setFormData({
            ...formData,
            lines: [...(formData.lines || []), {
                skuId,
                requestedQty: qty,
                shippedQty: 0,
                receivedQty: 0,
                lostQty: 0,
                unitCost: sku?.cost || 0,
                note: ''
            }]
        })
        setQty(1)
    }

    const removeItem = (idx: number) => {
        const newLines = [...(formData.lines || [])]
        newLines.splice(idx, 1)
        setFormData({ ...formData, lines: newLines })
    }

    if (viewMode === 'list') {
        return (
            <div className="page">
                <PageHeader 
                    title="Chuyển kho doanh nghiệp (Enterprise Transfer)" 
                    actions={
                        <button className="btn btn-primary" onClick={() => { setFormData({}); setViewMode('create'); setCreateStep(1) }}>
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

    if (viewMode === 'create') {
        return (
            <div className="page">
                <PageHeader 
                    title="Tạo phiếu chuyển kho mới" 
                    onBack={() => setViewMode('list')}
                />
                
                <div className="card" style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
                    {/* Stepper UI */}
                    <div style={{ display: 'flex', marginBottom: 32, justifyContent: 'center', gap: 40 }}>
                        {[
                            { step: 1, label: 'Chọn kho' },
                            { step: 2, label: 'Chọn sản phẩm' },
                            { step: 3, label: 'Xác nhận' }
                        ].map(s => (
                            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: createStep >= s.step ? 1 : 0.5 }}>
                                <div style={{ 
                                    width: 32, height: 32, borderRadius: '50%', 
                                    background: createStep >= s.step ? 'var(--primary-600)' : 'var(--neutral-200)',
                                    color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                }}>
                                    {s.step}
                                </div>
                                <div style={{ fontWeight: 600, color: createStep >= s.step ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {createStep === 1 && (
                        <div className="grid-form" style={{ gap: 24 }}>
                            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <div className="field">
                                    <label>Kho đi (Nguồn)</label>
                                    <select value={formData.fromLocationId} onChange={e => setFormData({...formData, fromLocationId: e.target.value})}>
                                        <option value="">-- Chọn kho --</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Kho đến (Đích)</label>
                                    <select value={formData.toLocationId} onChange={e => setFormData({...formData, toLocationId: e.target.value})}>
                                        <option value="">-- Chọn kho --</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="field">
                                <label>Ghi chú</label>
                                <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={3} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={() => {
                                    if (!formData.fromLocationId || !formData.toLocationId) return dialogs.alert({ message: 'Vui lòng chọn kho' })
                                    if (formData.fromLocationId === formData.toLocationId) return dialogs.alert({ message: 'Kho đi và đến phải khác nhau' })
                                    setCreateStep(2)
                                }}>
                                    Tiếp tục <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {createStep === 2 && (
                        <div>
                             <div className="field" style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                                <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Thêm sản phẩm từ kho {locations.find(l => l.id === formData.fromLocationId)?.name}</label>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <select value={skuId} onChange={e => setSkuId(e.target.value)} style={{ flex: 1 }}>
                                        <option value="">-- Chọn sản phẩm --</option>
                                        {state.skus.map(s => {
                                            const p = state.products.find(x => x.id === s.productId)
                                            const stock = getStock(s.id, formData.fromLocationId!)
                                            return <option key={s.id} value={s.id}>{p?.name} ({s.skuCode}) - Tồn: {stock}</option>
                                        })}
                                    </select>
                                    <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 80 }} />
                                    <button className="btn btn-primary" onClick={addItem}>Thêm</button>
                                </div>
                             </div>

                             <table className="table">
                                 <thead>
                                     <tr>
                                         <th>SKU</th>
                                         <th>Tên sản phẩm</th>
                                         <th style={{ textAlign: 'right' }}>Tồn kho</th>
                                         <th style={{ textAlign: 'right' }}>Yêu cầu chuyển</th>
                                         <th style={{ width: 50 }}></th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {formData.lines?.map((line, idx) => {
                                         const sku = state.skus.find(s => s.id === line.skuId)
                                         const p = state.products.find(x => x.id === sku?.productId)
                                         const stock = getStock(line.skuId, formData.fromLocationId!)
                                         return (
                                             <tr key={idx}>
                                                 <td style={{ fontWeight: 500 }}>{sku?.skuCode}</td>
                                                 <td>{p?.name}</td>
                                                 <td align="right">{stock}</td>
                                                 <td align="right" style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{line.requestedQty}</td>
                                                 <td>
                                                     <button className="btn-icon text-danger" onClick={() => removeItem(idx)}>
                                                         <Trash2 size={14} />
                                                     </button>
                                                 </td>
                                             </tr>
                                         )
                                     })}
                                     {!formData.lines?.length && (
                                         <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Chưa có sản phẩm nào</td></tr>
                                     )}
                                 </tbody>
                             </table>

                             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                                <button className="btn" onClick={() => setCreateStep(1)}>Quay lại</button>
                                <button className="btn btn-primary" onClick={() => {
                                    if (!formData.lines?.length) return dialogs.alert({ message: 'Vui lòng thêm sản phẩm' })
                                    setCreateStep(3)
                                }}>
                                    Tiếp tục <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {createStep === 3 && (
                        <div>
                             <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                 <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Xác nhận phiếu chuyển</div>
                                 <div style={{ color: 'var(--text-secondary)' }}>
                                     Từ <strong>{locations.find(l => l.id === formData.fromLocationId)?.name}</strong> 
                                     {' '}<ArrowRight size={12} />{' '} 
                                     Đến <strong>{locations.find(l => l.id === formData.toLocationId)?.name}</strong>
                                 </div>
                             </div>

                             <div style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                                 <div style={{ marginBottom: 8, fontWeight: 600 }}>Sản phẩm ({formData.lines?.length})</div>
                                 {formData.lines?.map((line, idx) => {
                                     const sku = state.skus.find(s => s.id === line.skuId)
                                     return (
                                         <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                             <span>{sku?.skuCode}</span>
                                             <strong>x {line.requestedQty}</strong>
                                         </div>
                                     )
                                 })}
                             </div>

                             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                                <button className="btn" onClick={() => setCreateStep(2)}>Quay lại</button>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    <Check size={16} /> Hoàn tất & Tạo phiếu
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (viewMode === 'detail' && selectedOrder) {
        const data = selectedOrder

        return (
            <div className="page">
                <PageHeader 
                    title={`Chi tiết: ${data.code}`} 
                    onBack={() => setViewMode('list')}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {data.status === 'draft' && (
                                <button className="btn btn-primary" onClick={() => handleTransition('request', 'requested')}>Gửi yêu cầu</button>
                            )}
                            {data.status === 'requested' && (
                                <button className="btn btn-success" onClick={() => handleTransition('approve', 'approved')}>Duyệt</button>
                            )}
                            {data.status === 'approved' && (
                                <button className="btn btn-warning" onClick={() => handleTransition('ship', 'in_transit')}>Xuất hàng (Ship)</button>
                            )}
                            {data.status === 'in_transit' && (
                                <button className="btn btn-success" onClick={() => handleTransition('receive', 'completed')}>Nhận hàng (Receive)</button>
                            )}
                        </div>
                    }
                />

                <TransferTimeline status={data.status} />

                <div className="grid-form" style={{ gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                    <div className="card">
                         <div className="card-title">Thông tin hàng hóa</div>
                         
                         {/* Receiving Form */}
                          <div style={{ marginTop: 24 }}>
                              {data.status === 'in_transit' && isReceiver && (
                                 <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--primary-200)' }}>
                                     <h4 style={{ margin: '0 0 12px', color: 'var(--primary-700)' }}>Nhận hàng</h4>
                                     
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                         <label style={{ fontWeight: 600 }}>Phí vận chuyển thực tế:</label>
                                         <input 
                                             type="number" 
                                             value={shippingFee} 
                                             onChange={e => setShippingFee(Number(e.target.value))} 
                                             style={{ width: 150, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
                                         />
                                     </div>

                                     {data.lines?.map(line => (
                                         <div key={line.skuId} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', gap: 12, marginBottom: 8, alignItems: 'center', background: '#fff', padding: 8, borderRadius: 4 }}>
                                             <div style={{ fontWeight: 600 }}>{state.skus.find(s => s.id === line.skuId)?.skuCode}</div>
                                             <div style={{ fontSize: 13 }}>Gửi: <strong>{line.shippedQty || line.requestedQty}</strong></div>
                                             <div>
                                                 <input 
                                                     type="number" 
                                                     placeholder="Thực nhận"
                                                     value={receivingState[line.skuId]?.received ?? (line.shippedQty || line.requestedQty)}
                                                     onChange={e => handleReceiveChange(line.skuId, 'received', Number(e.target.value))}
                                                     style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                 />
                                             </div>
                                             <div>
                                                 <input 
                                                     type="number" 
                                                     placeholder="Mất/Hỏng"
                                                     value={receivingState[line.skuId]?.lost ?? 0}
                                                     onChange={e => handleReceiveChange(line.skuId, 'lost', Number(e.target.value))}
                                                     style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                 />
                                             </div>
                                             <div>
                                                 <input 
                                                     type="text" 
                                                     placeholder="Ghi chú nhận hàng"
                                                     value={receivingState[line.skuId]?.note ?? ''}
                                                     onChange={e => handleReceiveChange(line.skuId, 'note', e.target.value)}
                                                     style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                                                 />
                                             </div>
                                         </div>
                                     ))}
                                     <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                                         <button className="btn btn-warning" onClick={() => handleTransition('receive', 'partially_received')}>
                                             Nhận một phần
                                         </button>
                                         <button className="btn btn-primary" onClick={() => handleTransition('receive', 'completed')}>
                                             <Check size={16} /> Nhận đủ & Hoàn thành
                                         </button>
                                     </div>
                                 </div>
                             )}

                             <table className="table">
                                 <thead>
                                     <tr>
                                         <th>SKU</th>
                                         <th style={{ textAlign: 'right' }}>Tồn kho (Nguồn)</th>
                                         <th style={{ textAlign: 'right' }}>Yêu cầu</th>
                                         <th style={{ textAlign: 'right' }}>Thực xuất</th>
                                         <th style={{ textAlign: 'right' }}>Thực nhận</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {data.lines?.map((line, idx) => (
                                         <tr key={idx}>
                                             <td>
                                                 {state.skus.find(s => s.id === line.skuId)?.skuCode}
                                             </td>
                                             <td align="right" style={{ color: 'var(--text-muted)' }}>
                                                 {getStock(line.skuId, data.fromLocationId)}
                                             </td>
                                             <td align="right" style={{ fontWeight: 600 }}>
                                                 {line.requestedQty}
                                             </td>
                                             <td align="right">
                                                 {data.status === 'approved' || data.status === 'in_transit' || data.status === 'completed' ? line.shippedQty : '-'}
                                             </td>
                                             <td align="right">
                                                 {data.status === 'completed' || data.status === 'partially_received' ? (
                                                     <span style={{ color: 'var(--success)', fontWeight: 600 }}>{line.receivedQty}</span>
                                                 ) : '-'}
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Vận chuyển & Timeline</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                             <div>
                                 <label className="label-sm">Kho đi</label>
                                 <div style={{ fontWeight: 600 }}>{locations.find(l => l.id === data.fromLocationId)?.name}</div>
                             </div>
                             <div>
                                 <label className="label-sm">Kho đến</label>
                                 <div style={{ fontWeight: 600 }}>{locations.find(l => l.id === data.toLocationId)?.name}</div>
                             </div>
                        </div>

                        <div className="field">
                             <label>Đơn vị vận chuyển</label>
                             <div className="input-icon">
                                 <Truck size={16} />
                                 <input 
                                    value={data.carrierName} 
                                    disabled
                                    placeholder="Chưa cập nhật"
                                 />
                             </div>
                        </div>
                        <div className="field">
                             <label>Mã vận đơn</label>
                             <input 
                                value={data.trackingCode} 
                                disabled
                                placeholder="Chưa cập nhật"
                             />
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <h4>Lịch sử hoạt động</h4>
                            <div className="timeline">
                                {data.logs?.map((log: any) => (
                                    <div key={log.id} style={{ position: 'relative', paddingLeft: 20, borderLeft: '2px solid var(--border-color)', paddingBottom: 16 }}>
                                        <div style={{ position: 'absolute', left: -5, top: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)' }} />
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ fontWeight: 600 }}>{log.action}</span> - {log.note}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {formatDateTime(log.timestamp)} by {state.users.find(u => u.id === log.actorId)?.username || 'System'}
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

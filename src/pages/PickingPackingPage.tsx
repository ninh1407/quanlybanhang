import { useState, useMemo, useEffect, useRef } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Order, OrderStatus, Sku, Product } from '../domain/types'
import { Check, Truck, Box, Search, Package, X, ScanBarcode } from 'lucide-react'
import { useDialogs } from '../ui-kit/Dialogs'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'

function PickingModal({ 
    order, 
    onClose, 
    onComplete,
    skus,
    products
}: { 
    order: Order, 
    onClose: () => void, 
    onComplete: () => void,
    skus: Sku[],
    products: Product[]
}) {
    const [pickedCounts, setPickedCounts] = useState<Record<string, number>>({})
    const [scanInput, setScanInput] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const items = order.items || []
    const totalItems = items.reduce((s, i) => s + i.qty, 0)
    const totalPicked = Object.values(pickedCounts).reduce((s, n) => s + n, 0)
    const isComplete = items.every(i => (pickedCounts[i.skuId] || 0) >= i.qty)

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault()
        const code = scanInput.trim().toLowerCase()
        if (!code) return

        // Find SKU by code
        const sku = skus.find(s => {
            if (s.skuCode.toLowerCase() === code) return true
            const p = products.find(prod => prod.id === s.productId)
            return p?.barcode?.toLowerCase() === code
        })
        
        if (!sku) {
            // alert('SKU not found') // Or show error toast
            setScanInput('')
            return
        }

        // Find item in order
        const item = items.find(i => i.skuId === sku.id)
        if (!item) {
            // alert('Item not in order')
            setScanInput('')
            return
        }

        const currentPicked = pickedCounts[sku.id] || 0
        if (currentPicked >= item.qty) {
            // alert('Already picked enough')
            setScanInput('')
            return
        }

        setPickedCounts(p => ({ ...p, [sku.id]: currentPicked + 1 }))
        setScanInput('')
    }

    const progress = Math.min(100, (totalItems > 0 ? (totalPicked / totalItems) * 100 : 0))

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: 600 }}>
                <div className="row-between" style={{ marginBottom: 16 }}>
                    <h3>Picking Order: {order.code}</h3>
                    <button className="btn btn-ghost" onClick={onClose}><X size={20}/></button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                        <span>Tiến độ: {totalPicked}/{totalItems} sản phẩm</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--success)', transition: 'width 0.3s' }} />
                    </div>
                </div>

                <form onSubmit={handleScan} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <ScanBarcode size={18} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                        <input 
                            ref={inputRef}
                            value={scanInput}
                            onChange={e => setScanInput(e.target.value)}
                            placeholder="Quét mã vạch hoặc nhập SKU..."
                            style={{ paddingLeft: 36, width: '100%' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">OK</button>
                </form>

                <div className="table-wrap" style={{ maxHeight: 400, overflow: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Sản phẩm</th>
                                <th>SKU</th>
                                <th style={{ textAlign: 'center' }}>Cần lấy</th>
                                <th style={{ textAlign: 'center' }}>Đã lấy</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const sku = skus.find(s => s.id === item.skuId)
                                const product = products.find(p => p.id === sku?.productId)
                                const picked = pickedCounts[item.skuId] || 0
                                const done = picked >= item.qty
                                return (
                                    <tr key={item.skuId} style={{ background: done ? 'var(--success-100)' : 'transparent' }}>
                                        <td>{product?.name || item.skuId}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{sku?.skuCode}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.qty}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: done ? 'var(--success-700)' : 'var(--text-primary)' }}>
                                            {picked}
                                        </td>
                                        <td>
                                            {done && <Check size={16} color="var(--success-700)" />}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn" onClick={onClose}>Đóng</button>
                    <button 
                        className="btn btn-primary" 
                        disabled={!isComplete}
                        onClick={onComplete}
                    >
                        <Check size={16} style={{ marginRight: 6 }} /> Hoàn tất Picking
                    </button>
                </div>
            </div>
        </div>
    )
}

export function PickingPackingPage() {
    const state = useAppState()
    const dispatch = useAppDispatch()
    const dialogs = useDialogs()
    const [activeTab, setActiveTab] = useState<'pending' | 'picking' | 'packing' | 'shipping'>('pending')
    const [searchCode, setSearchCode] = useState('')
    const [pickingOrderId, setPickingOrderId] = useState<string | null>(null)

    const filteredOrders = useMemo(() => {
        let statusFilter: OrderStatus[] = []
        if (activeTab === 'pending') statusFilter = ['confirmed', 'paid']
        if (activeTab === 'picking') statusFilter = ['picking']
        if (activeTab === 'packing') statusFilter = ['packed']
        if (activeTab === 'shipping') statusFilter = ['ready_to_ship']

        return state.orders.filter(o => 
            statusFilter.includes(o.status) &&
            (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true) &&
            (searchCode ? o.code.toLowerCase().includes(searchCode.toLowerCase()) : true)
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // FIFO
    }, [state.orders, activeTab, state.currentLocationId, searchCode])

    const handleAction = async (order: Order, action: 'start_pick' | 'finish_pick' | 'pack' | 'ship') => {
        let nextStatus: OrderStatus = 'draft'
        let confirmMsg = ''

        if (action === 'start_pick') {
            nextStatus = 'picking'
            confirmMsg = `Bắt đầu lấy hàng (Pick) cho đơn ${order.code}?`
        } else if (action === 'finish_pick') {
            nextStatus = 'packed' // Simplified: Pick -> Pack immediately or use separate step
            confirmMsg = `Xác nhận đã lấy đủ hàng cho đơn ${order.code}?`
        } else if (action === 'pack') {
             nextStatus = 'ready_to_ship'
             confirmMsg = `Đóng gói hoàn tất đơn ${order.code}?`
        } else if (action === 'ship') {
            nextStatus = 'shipped'
            confirmMsg = `Xác nhận giao hàng cho ĐVVC đơn ${order.code}?`
        }

        const confirmed = await dialogs.confirm({ message: confirmMsg })
        if (!confirmed) return

        dispatch({ 
            type: 'orders/upsert', 
            order: { 
                ...order, 
                status: nextStatus,
                // Add logs here ideally
            } 
        })
        
        // If Shipping, deduct stock if not already done (assuming stock deducted at 'shipped' or 'confirmed' based on policy)
        // In this system, let's assume stock is reserved at 'confirmed' but deducted from ledger at 'shipped'.
        if (nextStatus === 'shipped') {
             (order.items || []).forEach(item => {
                 dispatch({
                     type: 'stock/add',
                     tx: {
                         id: newId('stk'),
                         code: '',
                         type: 'out',
                         skuId: item.skuId,
                         locationId: order.fulfillmentLocationId,
                         qty: item.qty,
                         unitCost: 0, // Should fetch cost
                         note: `Xuất kho đơn hàng ${order.code}`,
                         createdAt: nowIso(),
                         refType: 'order',
                         refId: order.id
                     }
                 })
             })
        }
    }

    return (
        <div className="page">
            <PageHeader title="Vận hành kho: Soạn & Đóng gói" subtitle="Quy trình xử lý đơn hàng tại kho" />
            
            {/* Kanban Workflow Steps */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
                {[
                    { id: 'pending', label: '1. Chờ xử lý', count: state.orders.filter(o => ['confirmed', 'paid'].includes(o.status) && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length, color: 'var(--primary-600)', bg: 'var(--primary-100)' },
                    { id: 'picking', label: '2. Đang lấy hàng (Picking)', count: state.orders.filter(o => o.status === 'picking' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length, color: 'var(--warning-700)', bg: 'var(--warning-100)' },
                    { id: 'packing', label: '3. Đóng gói (Packing)', count: state.orders.filter(o => o.status === 'packed' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length, color: 'var(--info-700)', bg: 'var(--info-100)' },
                    { id: 'shipping', label: '4. Chờ giao (Ready)', count: state.orders.filter(o => o.status === 'ready_to_ship' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length, color: 'var(--success-700)', bg: 'var(--success-100)' }
                ].map(step => (
                    <div 
                        key={step.id}
                        onClick={() => setActiveTab(step.id as any)}
                        style={{ 
                            flex: 1, 
                            minWidth: 200,
                            padding: 12, 
                            borderRadius: 8, 
                            background: activeTab === step.id ? step.bg : 'var(--bg-subtle)',
                            border: `2px solid ${activeTab === step.id ? step.color : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontWeight: 600, color: activeTab === step.id ? step.color : 'var(--text-secondary)' }}>
                            {step.label}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: activeTab === step.id ? step.color : 'var(--text-primary)' }}>
                            {step.count} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>đơn</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="toolbar" style={{ marginTop: 16, marginBottom: 16 }}>
                <div className="search-box">
                    <Search size={16} />
                    <input 
                        placeholder="Tìm mã đơn hàng / Barcode..." 
                        value={searchCode}
                        onChange={e => setSearchCode(e.target.value)}
                    />
                </div>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Mã đơn</th>
                            <th>Khách hàng</th>
                            <th>Sản phẩm (SKU)</th>
                            <th>Tổng tiền</th>
                            <th>ĐVVC</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map(order => (
                            <tr key={order.id}>
                                <td style={{ fontWeight: 600 }}>{order.code}</td>
                                <td>{state.customers.find(c => c.id === order.customerId)?.name || 'Khách lẻ'}</td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {(order.items || []).map(i => {
                                            const sku = state.skus.find(s => s.id === i.skuId)
                                            return (
                                                <div key={i.skuId} style={{ fontSize: 12 }}>
                                                    <span style={{ fontWeight: 600 }}>{sku?.skuCode}</span> x {i.qty}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td>{(order.items || []).reduce((sum, i) => sum + i.qty * i.price, 0).toLocaleString()}</td>
                                <td>{order.carrierName || '-'}</td>
                                <td>
                                    {activeTab === 'pending' && (
                                        <button className="btn btn-primary btn-small" onClick={() => handleAction(order, 'start_pick')}>
                                            <Package size={14} style={{ marginRight: 4 }} /> Bắt đầu nhặt
                                        </button>
                                    )}
                                    {activeTab === 'picking' && (
                                        <button className="btn btn-success btn-small" onClick={() => setPickingOrderId(order.id)}>
                                            <ScanBarcode size={14} style={{ marginRight: 4 }} /> Quét & Nhặt
                                        </button>
                                    )}
                                    {activeTab === 'packing' && (
                                        <button className="btn btn-primary btn-small" onClick={() => handleAction(order, 'pack')}>
                                            <Box size={14} style={{ marginRight: 4 }} /> Pack & Label
                                        </button>
                                    )}
                                    {activeTab === 'shipping' && (
                                        <button className="btn btn-warning btn-small" onClick={() => handleAction(order, 'ship')}>
                                            <Truck size={14} style={{ marginRight: 4 }} /> Handover
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!filteredOrders.length && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Không có đơn hàng nào</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pickingOrderId && (
                <PickingModal 
                    order={state.orders.find(o => o.id === pickingOrderId)!}
                    skus={state.skus}
                    products={state.products}
                    onClose={() => setPickingOrderId(null)}
                    onComplete={() => {
                        const order = state.orders.find(o => o.id === pickingOrderId)
                        if (order) handleAction(order, 'finish_pick')
                        setPickingOrderId(null)
                    }}
                />
            )}
        </div>
    )
}

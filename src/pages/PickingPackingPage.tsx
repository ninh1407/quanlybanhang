import { useState, useMemo } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Order, OrderStatus } from '../domain/types'
import { Check, Truck, Box, Search, Package } from 'lucide-react'
import { useDialogs } from '../ui-kit/Dialogs'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'

export function PickingPackingPage() {
    const state = useAppState()
    const dispatch = useAppDispatch()
    const dialogs = useDialogs()
    const [activeTab, setActiveTab] = useState<'pending' | 'picking' | 'packing' | 'shipping'>('pending')
    const [searchCode, setSearchCode] = useState('')

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
             order.items.forEach(item => {
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
            <PageHeader title="Warehouse Operation: Pick & Pack" subtitle="Quy trình xử lý đơn hàng tại kho" />
            
            <div className="tabs">
                <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                    Chờ xử lý ({state.orders.filter(o => ['confirmed', 'paid'].includes(o.status) && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length})
                </button>
                <button className={`tab ${activeTab === 'picking' ? 'active' : ''}`} onClick={() => setActiveTab('picking')}>
                    Đang lấy hàng (Picking) ({state.orders.filter(o => o.status === 'picking' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length})
                </button>
                <button className={`tab ${activeTab === 'packing' ? 'active' : ''}`} onClick={() => setActiveTab('packing')}>
                    Đóng gói (Packing) ({state.orders.filter(o => o.status === 'packed' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length})
                </button>
                <button className={`tab ${activeTab === 'shipping' ? 'active' : ''}`} onClick={() => setActiveTab('shipping')}>
                    Chờ giao (Ready) ({state.orders.filter(o => o.status === 'ready_to_ship' && (state.currentLocationId ? o.fulfillmentLocationId === state.currentLocationId : true)).length})
                </button>
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
                                        {order.items.map(i => {
                                            const sku = state.skus.find(s => s.id === i.skuId)
                                            return (
                                                <div key={i.skuId} style={{ fontSize: 12 }}>
                                                    <span style={{ fontWeight: 600 }}>{sku?.skuCode}</span> x {i.qty}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td>{order.items.reduce((sum, i) => sum + i.qty * i.price, 0).toLocaleString()}</td>
                                <td>{order.carrierName || '-'}</td>
                                <td>
                                    {activeTab === 'pending' && (
                                        <button className="btn btn-primary btn-small" onClick={() => handleAction(order, 'start_pick')}>
                                            <Package size={14} style={{ marginRight: 4 }} /> Pick
                                        </button>
                                    )}
                                    {activeTab === 'picking' && (
                                        <button className="btn btn-success btn-small" onClick={() => handleAction(order, 'finish_pick')}>
                                            <Check size={14} style={{ marginRight: 4 }} /> Done Pick
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
        </div>
    )
}

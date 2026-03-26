import { useState, useMemo } from 'react'
import { useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Order } from '../../shared/types/domain'
import { 
    Clock, 
    MapPin,
    Filter
} from 'lucide-react'

// Helper to calculate days diff
const daysDiff = (d1: string, d2: string = new Date().toISOString()) => {
    const t1 = new Date(d1).getTime()
    const t2 = new Date(d2).getTime()
    return Math.floor((t2 - t1) / (1000 * 3600 * 24))
}

export function OrderMonitoringPage() {
    const state = useAppState()
    const [filterChannel, setFilterChannel] = useState<string>('all')
    const [filterLocation, setFilterLocation] = useState<string>('all')

    // 1. Kanban Columns Data
    const columns = useMemo(() => {
        const cols = {
            pending: [] as Order[],
            picking: [] as Order[],
            packing: [] as Order[],
            shipping: [] as Order[],
            issue: [] as Order[]
        }

        ;(state.orders || []).forEach(o => {
            // Filters
            if (filterChannel !== 'all') {
                const channel = o.source === 'tiktok' ? 'tiktok' : 
                                o.source === 'web' ? 'web' : 
                                o.source === 'pos' ? 'pos' : 'other'
                if (channel !== filterChannel) return
            }
            if (filterLocation !== 'all' && o.fulfillmentLocationId !== filterLocation) return

            // Classify
            if (o.status === 'confirmed' || o.status === 'paid') cols.pending.push(o)
            else if (o.status === 'picking') cols.picking.push(o)
            else if (o.status === 'packed' || o.status === 'ready_to_ship') cols.packing.push(o)
            else if (o.status === 'shipped') cols.shipping.push(o)
            
            // Issue Detection (Mock: Late > 3 days in any state before delivered)
            if (['confirmed', 'paid', 'picking', 'packed', 'ready_to_ship', 'shipped'].includes(o.status)) {
                if (daysDiff(o.createdAt) > 3) {
                    cols.issue.push(o)
                }
            }
        })
        
        return cols
    }, [state.orders, filterChannel, filterLocation])

    const getChannelIcon = (source: string) => {
        if (source === 'tiktok') return <span className="badge" style={{ background: '#000000', color: 'white' }}>TikTok</span>
        if (source === 'pos') return <span className="badge" style={{ background: '#F59E0B', color: 'white' }}>POS</span>
        return <span className="badge badge-neutral">Web</span>
    }

    const KanbanCard = ({ order }: { order: Order }) => {
        const days = daysDiff(order.createdAt)
        const isLate = days > 2
        const location = state.locations.find(l => l.id === order.fulfillmentLocationId)

        return (
            <div className="card" style={{ padding: 12, marginBottom: 12, borderLeft: isLate ? '3px solid var(--danger)' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{order.code}</div>
                    {getChannelIcon(order.source || 'web')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {location?.name || 'Chưa phân bổ'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Clock size={12} color={isLate ? 'var(--danger)' : 'inherit'} /> 
                        <span style={{ color: isLate ? 'var(--danger)' : 'inherit' }}>{days} ngày</span>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {(order.items || []).length} items
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-600)' }}>
                        {(order.subTotalOverride || (order.items || []).reduce((s: any, i: any) => s + i.price * i.qty, 0)).toLocaleString()}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0 }}>
                <PageHeader title="Order Monitoring Board (Kanban)" subtitle="Giám sát luồng đơn hàng đa kênh" />
                
                <div className="toolbar" style={{ marginBottom: 16, gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Filter size={16} color="var(--text-muted)" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Lọc:</span>
                    </div>
                    <select className="select" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
                        <option value="all">Tất cả kênh</option>
                        <option value="tiktok">TikTok</option>
                        <option value="web">Website</option>
                        <option value="pos">POS</option>
                    </select>
                    <select className="select" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                        <option value="all">Tất cả kho</option>
                        {state.locations.filter(l => l.active).map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                <div style={{ display: 'flex', gap: 16, height: '100%', minWidth: 1200, paddingBottom: 16 }}>
                    {/* Col 1: Pending */}
                    <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Chờ xử lý</span>
                            <span className="badge badge-neutral">{columns.pending.length}</span>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                            {columns.pending.map(o => <KanbanCard key={o.id} order={o} />)}
                        </div>
                    </div>

                    {/* Col 2: Picking */}
                    <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Đang lấy hàng (Picking)</span>
                            <span className="badge badge-info">{columns.picking.length}</span>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                            {columns.picking.map(o => <KanbanCard key={o.id} order={o} />)}
                        </div>
                    </div>

                    {/* Col 3: Packing */}
                    <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Đóng gói (Packing)</span>
                            <span className="badge badge-primary">{columns.packing.length}</span>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                            {columns.packing.map(o => <KanbanCard key={o.id} order={o} />)}
                        </div>
                    </div>

                    {/* Col 4: Shipping */}
                    <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Đang giao (Shipping)</span>
                            <span className="badge badge-warning">{columns.shipping.length}</span>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                            {columns.shipping.map(o => <KanbanCard key={o.id} order={o} />)}
                        </div>
                    </div>

                    {/* Col 5: Issues */}
                    <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #FECACA' }}>
                        <div style={{ padding: 12, borderBottom: '1px solid #FECACA', fontWeight: 600, display: 'flex', justifyContent: 'space-between', color: '#991B1B' }}>
                            <span>Cảnh báo (Chậm {'>'} 3 ngày)</span>
                            <span className="badge badge-danger">{columns.issue.length}</span>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                            {columns.issue.map(o => <KanbanCard key={o.id} order={o} />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

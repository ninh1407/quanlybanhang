import { useEffect, useState } from 'react'
import { AnalyticsApi, DashboardData } from '../api/analytics'
import { formatVnd } from '../lib/money'
import { 
    DollarSign, 
    ShoppingCart, 
    Package, 
    TrendingUp, 
    CheckCircle, 
    Clock, 
    Truck 
} from 'lucide-react'
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer 
} from 'recharts'

export function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        AnalyticsApi.getDashboardData()
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 24 }}>Đang tải dữ liệu...</div>
    if (!data) return <div style={{ padding: 24 }}>Lỗi tải dữ liệu</div>

    return (
        <div className="page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tổng quan</h1>

            {/* 1. KPI Tier */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <MetricCard 
                    label="Doanh thu hôm nay" 
                    value={formatVnd(data.kpi.revenueToday)} 
                    icon={<DollarSign color="#10B981" />} 
                />
                <MetricCard 
                    label="Đơn hàng hôm nay" 
                    value={data.kpi.ordersToday} 
                    icon={<ShoppingCart color="#3B82F6" />} 
                />
                <MetricCard 
                    label="Giá trị tồn kho" 
                    value={formatVnd(data.kpi.inventoryValue)} 
                    icon={<Package color="#8B5CF6" />} 
                />
                <MetricCard 
                    label="Dòng tiền" 
                    value={formatVnd(data.kpi.cashflow)} 
                    icon={<TrendingUp color="#10B981" />} 
                />
            </div>

            {/* 2. Sales & Charts Tier */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                <div className="card" style={{ padding: 20, background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Xu hướng doanh thu (7 ngày qua)</h3>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.sales.chart}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12}}
                                    tickFormatter={(val) => `${val/1000000}M`} 
                                />
                                <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Inventory Health Tier (Compact) */}
                <div className="card" style={{ padding: 20, background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>Sức khỏe kho</h3>
                    
                    <HealthItem 
                        label="Hàng sắp hết" 
                        value={data.inventory.lowStock} 
                        status={data.inventory.lowStock > 0 ? 'warning' : 'success'} 
                    />
                    <HealthItem 
                        label="Hàng tồn đọng" 
                        value={data.inventory.deadStock} 
                        status="neutral" 
                    />
                    <HealthItem 
                        label="Điểm sức khỏe" 
                        value={`${data.inventory.health}/100`} 
                        status="success" 
                    />
                    
                    <div style={{ paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 13, color: '#6B7280' }}>Tổng giá trị tồn kho</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{formatVnd(data.inventory.value)}</div>
                    </div>
                </div>
            </div>

            {/* 4. Operations Tier */}
            <div className="card" style={{ padding: 20, background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Hàng chờ xử lý</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <OperationCard 
                        label="Đơn chờ" 
                        value={data.operations.pending} 
                        color="#FEF3C7" // Yellow 100
                        textColor="#92400E" // Yellow 800
                        icon={<Clock size={20} />}
                    />
                    <OperationCard 
                        label="Đang lấy hàng" 
                        value={data.operations.picking} 
                        color="#DBEAFE" // Blue 100
                        textColor="#1E40AF" // Blue 800
                        icon={<Package size={20} />}
                    />
                    <OperationCard 
                        label="Đang đóng gói" 
                        value={data.operations.packing} 
                        color="#F3E8FF" // Purple 100
                        textColor="#6B21A8" // Purple 800
                        icon={<CheckCircle size={20} />}
                    />
                    <OperationCard 
                        label="Đang giao" 
                        value={data.operations.shipping} 
                        color="#D1FAE5" // Green 100
                        textColor="#065F46" // Green 800
                        icon={<Truck size={20} />}
                    />
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, icon }: { label: string, value: string | number, icon: any }) {
    return (
        <div style={{ padding: 20, background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
            </div>
            <div style={{ padding: 12, background: '#F9FAFB', borderRadius: '50%' }}>{icon}</div>
        </div>
    )
}

function HealthItem({ label, value, status }: { label: string, value: string | number, status: 'success' | 'warning' | 'danger' | 'neutral' }) {
    const colors = {
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
        neutral: '#4B5563'
    }
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F9FAFB', borderRadius: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#4B5563' }}>{label}</span>
            <span style={{ fontWeight: 700, color: colors[status] }}>{value}</span>
        </div>
    )
}

function OperationCard({ label, value, color, textColor, icon }: { label: string, value: number, color: string, textColor: string, icon: any }) {
    return (
        <div style={{ padding: 20, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: color, color: textColor }}>
            <div style={{ opacity: 0.8 }}>{icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', opacity: 0.7, letterSpacing: '0.05em' }}>{label}</div>
        </div>
    )
}

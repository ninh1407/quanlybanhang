import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../ui-kit/PageHeader'
import { AnalyticsApi, InventoryKPIs, BusinessKPIs } from '../api/analytics'
import { formatVnd } from '../../shared/lib/money'
import { Package, RefreshCw, AlertTriangle, Layers } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAppState } from '../state/Store'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export function AnalyticsInventoryPage() {
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null)
  const [bizKpis, setBizKpis] = useState<BusinessKPIs | null>(null)
  const state = useAppState()
  const totalSkuCount = state.skus.length

  const productsById = useMemo(() => new Map(state.products.map((p: any) => [p.id, p])), [state.products])
  const categoriesById = useMemo(() => new Map(state.categories.map(c => [c.id, c.name])), [state.categories])

  const stockBySku = useMemo(() => {
    const map = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      const prev = map.get(t.skuId) ?? 0
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      map.set(t.skuId, prev + delta)
    })
    return map
  }, [state.stockTransactions])

  const compositionData = useMemo(() => {
    const map = new Map<string, number>()
    state.skus.forEach((s) => {
      const qty = stockBySku.get(s.id) ?? 0
      if (qty <= 0) return
      const product = productsById.get(s.productId)
      const catName = categoriesById.get(product?.categoryId ?? '') || 'Khác'
      const value = (Number(s.cost) || 0) * qty
      map.set(catName, (map.get(catName) || 0) + value)
    })

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
  }, [state.skus, stockBySku, productsById, categoriesById])

  const topInventorySkus = useMemo(() => {
    const rows = state.skus
      .map((s) => {
        const qty = stockBySku.get(s.id) ?? 0
        const value = qty > 0 ? (Number(s.cost) || 0) * qty : 0
        return { sku: s, qty, value }
      })
      .filter((r) => r.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5)

    return rows
  }, [state.skus, stockBySku])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Use BusinessKPIs for total inventory value
      const [invData, bizData] = await Promise.all([
        AnalyticsApi.getInventoryKPIs(),
        AnalyticsApi.getBusinessKPIs() 
      ])
      
      setKpis(invData)
      setBizKpis(bizData)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="page">
      <PageHeader 
        title="Báo cáo kho" 
        subtitle="Phân tích hiệu quả tồn kho và luân chuyển hàng hóa"
        actions={
            <button className="btn" onClick={loadData}>
                <RefreshCw size={16} />
                Làm mới
            </button>
        }
      />

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 24 }}>
          <KPICard 
            label="Giá trị tồn kho" 
            value={bizKpis?.inventoryValue} 
            icon={<Package size={24} />} 
            color="blue" 
            formatter={formatVnd}
          />
          <KPICard 
            label="Vòng quay kho (năm)" 
            value={bizKpis?.stockTurnover} 
            icon={<RefreshCw size={24} />} 
            color="green" 
            formatter={(v: number) => v + ' lần'}
          />
          <KPICard 
            label="Số ngày bán hàng (DOH)" 
            value={kpis?.daysOnHand} 
            icon={<Layers size={24} />} 
            color="purple" 
            formatter={(v: number) => v + ' ngày'}
          />
          <KPICard 
            label="Hàng tồn chết (SKU)" 
            value={kpis?.deadStockSkuCount} 
            icon={<AlertTriangle size={24} />} 
            color="red" 
            formatter={(v: number) => v + ' mã'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Phân bổ giá trị theo danh mục</h3>
                <div style={{ height: 300 }}>
                    {compositionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={compositionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    paddingAngle={5}
                                    label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                                >
                                    {compositionData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="center-text">Chưa có dữ liệu</div>
                    )}
                </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Top SKU Tồn Kho (Giá trị)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 300, overflowY: 'auto' }}>
                    {topInventorySkus.length > 0 ? topInventorySkus.map((r, idx) => {
                        const productName = productsById.get(r.sku.productId)?.name ?? r.sku.productId
                        return (
                            <div key={r.sku.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#64748b' }}>
                                    #{idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{productName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>SKU: {r.sku.skuCode}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700 }}>{formatVnd(r.value)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.qty.toLocaleString('vi-VN')} {r.sku.unit}</div>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="center-text">Chưa có dữ liệu</div>
                    )}
                </div>
            </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 16 }}>Phân tích tốc độ bán (Movement)</h3>
            
            <div style={{ display: 'grid', gap: 24 }}>
                <MovementBar 
                    label="Fast Moving (Hàng bán chạy)" 
                    count={kpis?.fastMovingSkuCount || 0} 
                    total={totalSkuCount}
                    color="#10b981"
                    desc="Chiếm khoảng 20% danh mục, đóng góp 80% doanh thu."
                />
                <MovementBar 
                    label="Slow Moving (Hàng bán chậm)" 
                    count={kpis?.slowMovingSkuCount || 0} 
                    total={totalSkuCount}
                    color="#f59e0b"
                    desc="Cần xem xét khuyến mãi xả hàng."
                />
                <MovementBar 
                    label="Dead Stock (Hàng tồn chết)" 
                    count={kpis?.deadStockSkuCount || 0} 
                    total={totalSkuCount}
                    color="#ef4444"
                    desc="Không có giao dịch xuất trong 90 ngày qua."
                />
            </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color, formatter, trend }: any) {
    const colorMap: any = {
        blue: { bg: '#eff6ff', text: '#2563eb' },
        green: { bg: '#f0fdf4', text: '#16a34a' },
        purple: { bg: '#faf5ff', text: '#9333ea' },
        red: { bg: '#fef2f2', text: '#dc2626' },
    }
    const theme = colorMap[color] || colorMap.blue

    return (
        <div className="card" style={{ padding: 24, borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ padding: 10, borderRadius: 12, background: theme.bg, color: theme.text }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        color: trend > 0 ? '#16a34a' : '#ef4444',
                        background: trend > 0 ? '#f0fdf4' : '#fef2f2',
                        padding: '4px 8px',
                        borderRadius: 20,
                        display: 'flex', alignItems: 'center', gap: 4
                    }}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>
                {value != null ? formatter(value) : '—'}
            </div>
        </div>
    )
}

function MovementBar({ label, count, total, color, desc }: any) {
    const percent = Math.min(100, Math.round((count / (total || 1)) * 100))
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({count} mã)</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{percent}%</span>
            </div>
            <div style={{ height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                <div style={{ 
                    height: '100%', 
                    width: `${percent}%`, 
                    background: color, 
                    borderRadius: 6,
                    transition: 'width 1s ease-in-out',
                    backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                    backgroundSize: '1rem 1rem'
                }} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, marginLeft: 2 }}>{desc}</p>
        </div>
    )
}

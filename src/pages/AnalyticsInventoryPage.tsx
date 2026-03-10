import { useEffect, useState } from 'react'
import { PageHeader } from '../ui-kit/PageHeader'
import { AnalyticsApi, InventoryKPIs, BusinessKPIs } from '../api/analytics'
import { formatVnd } from '../lib/money'
import { Package, RefreshCw, AlertTriangle, Layers } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export function AnalyticsInventoryPage() {
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null)
  const [bizKpis, setBizKpis] = useState<BusinessKPIs | null>(null)

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

  // Mock data for composition since API doesn't return it yet
  const compositionData = [
    { name: 'Gia dụng nhà bếp', value: 45 },
    { name: 'Điện lạnh', value: 25 },
    { name: 'Gia dụng thông minh', value: 20 },
    { name: 'Khác', value: 10 },
  ]

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard 
            label="Giá trị tồn kho" 
            value={bizKpis?.inventoryValue} 
            icon={<Package size={20} />} 
            color="blue" 
            formatter={formatVnd}
          />
          <KPICard 
            label="Vòng quay kho (năm)" 
            value={bizKpis?.stockTurnover} 
            icon={<RefreshCw size={20} />} 
            color="green" 
            formatter={(v: number) => v + ' lần'}
          />
          <KPICard 
            label="Số ngày bán hàng (DOH)" 
            value={kpis?.daysOnHand} 
            icon={<Layers size={20} />} 
            color="purple" 
            formatter={(v: number) => v + ' ngày'}
          />
          <KPICard 
            label="Hàng tồn chết (SKU)" 
            value={kpis?.deadStockSkuCount} 
            icon={<AlertTriangle size={20} />} 
            color="red" 
            formatter={(v: number) => v + ' mã'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Phân bổ giá trị theo danh mục</h3>
                <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={compositionData}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                            >
                                {compositionData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Phân tích tốc độ bán (Movement)</h3>
                
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Hàng bán chạy (Fast Moving)</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{kpis?.fastMovingSkuCount || 0} mã</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '20%', background: '#10b981' }} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Chiếm khoảng 20% danh mục, đóng góp 80% doanh thu.</p>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Hàng bán chậm (Slow Moving)</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{kpis?.slowMovingSkuCount || 0} mã</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '60%', background: '#f59e0b' }} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Cần xem xét khuyến mãi xả hàng.</p>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Hàng tồn chết (Dead Stock)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{kpis?.deadStockSkuCount || 0} mã</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '10%', background: '#ef4444' }} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Không có giao dịch xuất trong 90 ngày qua.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color, formatter }: any) {
    const colorMap: any = {
        blue: { bg: '#eff6ff', text: '#2563eb' },
        green: { bg: '#f0fdf4', text: '#16a34a' },
        purple: { bg: '#faf5ff', text: '#9333ea' },
        red: { bg: '#fef2f2', text: '#dc2626' },
    }
    const theme = colorMap[color] || colorMap.blue

    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div style={{ padding: 8, borderRadius: 8, background: theme.bg, color: theme.text }}>
                    {icon}
                </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>
                {value != null ? formatter(value) : '—'}
            </div>
        </div>
    )
}

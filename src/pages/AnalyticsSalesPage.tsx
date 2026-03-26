import { useEffect, useState } from 'react'
import { PageHeader } from '../ui-kit/PageHeader'
import { AnalyticsApi, BusinessKPIs, ChannelPerformance, RevenueHistory, TopProduct } from '../api/analytics'
import { startOfMonth, endOfMonth, subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { DollarSign, TrendingUp, ShoppingCart, Activity, Calendar } from 'lucide-react'
import { formatVnd } from '../../shared/lib/money'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export function AnalyticsSalesPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })
  
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null)
  const [history, setHistory] = useState<RevenueHistory[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [channels, setChannels] = useState<ChannelPerformance[]>([])

  useEffect(() => {
    loadData()
  }, [dateRange])

  async function loadData() {
    try {
      const [kpiData, historyData, topData, channelData] = await Promise.all([
        AnalyticsApi.getBusinessKPIs(dateRange.from, dateRange.to),
        AnalyticsApi.getRevenueHistory(),
        AnalyticsApi.getTopProducts(10),
        AnalyticsApi.getChannelPerformance(dateRange.from, dateRange.to)
      ])
      
      setKpis(kpiData)
      setHistory(historyData)
      setTopProducts(topData)
      setChannels(channelData)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="page">
      <PageHeader 
        title="Báo cáo bán hàng" 
        subtitle="Tổng quan doanh thu, lợi nhuận và hiệu quả kinh doanh"
        actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <Calendar size={16} className="text-muted" />
                <select 
                    value={dateRange.from.toISOString()} 
                    onChange={(e) => {
                        const val = e.target.value
                        const now = new Date()
                        if (val === 'this_month') setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
                        else if (val === 'last_30') setDateRange({ from: subDays(now, 30), to: now })
                        else if (val === 'last_90') setDateRange({ from: subDays(now, 90), to: now })
                    }}
                    style={{ border: 'none', background: 'transparent', fontSize: 13, outline: 'none' }}
                >
                    <option value="this_month">Tháng này</option>
                    <option value="last_30">30 ngày qua</option>
                    <option value="last_90">90 ngày qua</option>
                </select>
            </div>
        }
      />

      <div className="page-content">
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard 
            label="Doanh thu" 
            value={kpis?.revenue} 
            icon={<DollarSign size={20} />} 
            color="blue" 
            formatter={formatVnd}
          />
          <KPICard 
            label="Lợi nhuận ròng" 
            value={kpis?.netProfit} 
            icon={<TrendingUp size={20} />} 
            color="green" 
            formatter={formatVnd}
          />
          <KPICard 
            label="Dòng tiền" 
            value={kpis?.cashFlow} 
            icon={<Activity size={20} />} 
            color="purple" 
            formatter={formatVnd}
          />
          <KPICard 
            label="Tỷ lệ hoàn tất" 
            value={kpis?.fulfillmentRate} 
            icon={<ShoppingCart size={20} />} 
            color="orange" 
            formatter={(v: number) => `${v}%`}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Revenue History Chart */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Biểu đồ doanh thu & Lợi nhuận (12 tháng)</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...history].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(v) => `${v/1000000}M`} />
                  <Tooltip formatter={(v: any) => formatVnd(Number(v))} />
                  <Legend />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lợi nhuận" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Channel Performance */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Tỷ trọng kênh bán hàng</h3>
            <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={channels}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {channels.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatVnd(Number(v))} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 20 }}>
                {channels.map((c, i) => (
                    <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                            {c.name}
                        </div>
                        <div style={{ fontWeight: 500 }}>{c.percent.toFixed(1)}%</div>
                    </div>
                ))}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Top 10 Sản phẩm bán chạy (30 ngày)</h3>
            <table className="table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Sản phẩm</th>
                        <th style={{ textAlign: 'right' }}>Số lượng bán</th>
                        <th style={{ width: '40%' }}>Biểu đồ</th>
                    </tr>
                </thead>
                <tbody>
                    {topProducts.map((p, i) => (
                        <tr key={i}>
                            <td>{p.name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{p.value}</td>
                            <td>
                                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(p.value / (topProducts[0]?.value || 1)) * 100}%`,
                                        background: '#3b82f6' 
                                    }} />
                                </div>
                            </td>
                        </tr>
                    ))}
                    {topProducts.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu</td></tr>
                    )}
                </tbody>
            </table>
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
        orange: { bg: '#fff7ed', text: '#ea580c' },
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

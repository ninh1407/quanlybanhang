import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/Store'
import type { Sku, StockTransaction } from '../domain/types'
import { formatVnd } from '../lib/money'
import { PageHeader } from '../ui-kit/PageHeader'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Package, 
  AlertTriangle,
  RotateCcw,
  Wallet,
  Truck,
  Activity
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { format, startOfMonth, isSameMonth, isSameDay, subMonths, startOfDay, subDays } from 'date-fns'

function formatAxisMoney(value: number): string {
  const v = Number(value) || 0
  const abs = Math.abs(v)
  if (abs < 0.5) return '0'
  if (abs < 1000) return String(Math.round(v))
  if (abs < 1_000_000) return `${(v / 1000).toFixed(abs < 10_000 ? 1 : 0)}K`
  if (abs < 1_000_000_000) return `${(v / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}tr`
  return `${(v / 1_000_000_000).toFixed(abs < 10_000_000_000 ? 1 : 0)}tỷ`
}

function computeTrend(current: number, previous: number): { trend: 'up' | 'down' | 'neutral'; trendValue: string } | null {
  const c = Number(current) || 0
  const p = Number(previous) || 0
  if (c === 0 && p === 0) return null
  if (p <= 0) {
    return { trend: 'up', trendValue: 'mới' }
  }

  const pct = ((c - p) / p) * 100
  const abs = Math.abs(pct)
  const trend: 'up' | 'down' | 'neutral' = abs < 0.5 ? 'neutral' : pct > 0 ? 'up' : 'down'
  const trendValue = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  return { trend, trendValue }
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  color,
  trend,
  trendValue,
}: {
  label: string
  value: string | number
  subValue?: string
  icon: React.ReactNode
  color: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}) {
  return (
    <div className="card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div
          style={{
            color: color,
            background: `${color}15`,
            padding: 10,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        {subValue && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{subValue}</div>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13 }}>
          <span 
            style={{ 
              color: trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500
            }}
          >
            {trend === 'up' && <TrendingUp size={14} />}
            {trend === 'down' && <TrendingDown size={14} />}
            {trend === 'neutral' && <Minus size={14} />}
            {trendValue}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>so với kỳ trước</span>
        </div>
      )}
    </div>
  )
}

function AlertItem({ label, value, type = 'warning', onClick }: { label: string, value: string, type?: 'warning' | 'danger', onClick?: () => void }) {
    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 0', 
            borderBottom: '1px solid var(--border-color)',
            cursor: onClick ? 'pointer' : 'default'
        }} onClick={onClick}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color={type === 'danger' ? 'var(--danger)' : 'var(--warning)'} />
                <span style={{ fontSize: 14 }}>{label}</span>
            </div>
            <span style={{ fontWeight: 600, color: type === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>{value}</span>
        </div>
    )
}

function skuLabel(productsById: Map<string, string>, sku: Sku): string {
  const productName = productsById.get(sku.productId) ?? sku.productId
  const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
  return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
}

function calculateAgedStock(
  skus: Sku[],
  txs: StockTransaction[],
  daysThreshold: number
): { sku: Sku; agedQty: number; totalStock: number }[] {
  const stockMap = new Map<string, number>()
  // Calculate current stock
  txs.forEach((t) => {
    const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
    stockMap.set(t.skuId, (stockMap.get(t.skuId) ?? 0) + delta)
  })

  // Group IN transactions by SKU
  const inTxsBySku = new Map<string, StockTransaction[]>()
  txs.forEach((t) => {
    if (t.type !== 'in') return
    const list = inTxsBySku.get(t.skuId)
    if (list) list.push(t)
    else inTxsBySku.set(t.skuId, [t])
  })

  // Sort IN transactions by date descending (newest first)
  inTxsBySku.forEach((list) => {
    list.sort((a, b) => {
        const da = a.entryDate || a.createdAt
        const db = b.entryDate || b.createdAt
        return db.localeCompare(da)
    })
  })

  const now = new Date()
  const thresholdDate = subDays(now, daysThreshold)
  const result: { sku: Sku; agedQty: number; totalStock: number }[] = []

  skus.forEach((sku) => {
    const totalStock = stockMap.get(sku.id) ?? 0
    if (totalStock <= 0) return

    let remainingStock = totalStock
    let freshStock = 0

    const inTxs = inTxsBySku.get(sku.id) ?? []
    
    // Iterate from newest to oldest
    for (const tx of inTxs) {
        if (remainingStock <= 0) break

        const txDateStr = tx.entryDate || tx.createdAt
        const txDate = new Date(txDateStr)
        const isFresh = txDate > thresholdDate

        const allocated = Math.min(remainingStock, tx.qty)
        
        if (isFresh) {
            freshStock += allocated
        }
        
        remainingStock -= allocated
    }

    const agedQty = totalStock - freshStock
    if (agedQty > 0) {
        result.push({ sku, agedQty, totalStock })
    }
  })

  return result.sort((a, b) => b.agedQty - a.agedQty)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const state = useAppState()
  const [viewMode, setViewMode] = useState<'overview' | 'profit' | 'operation'>('overview')
  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const agedStock = useMemo(() => {
    return calculateAgedStock(state.skus, state.stockTransactions, 15)
  }, [state.skus, state.stockTransactions])

  // 1. Calculate Metrics
  const metrics = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const yesterday = startOfDay(subDays(now, 1))
    const thisMonth = startOfMonth(now)
    const prevMonth = startOfMonth(subMonths(now, 1))

    // Revenue Today (Internal Only)
    const todayOrders = state.orders.filter((o) => isSameDay(new Date(o.createdAt), today))
    const revenueToday = todayOrders.reduce(
      (sum, o) =>
        o.type === 'dropship'
          ? sum
          : sum + (o.subTotalOverride ?? o.items.reduce((s, i) => s + i.price * i.qty, 0)),
      0,
    )

    const yesterdayOrders = state.orders.filter((o) => isSameDay(new Date(o.createdAt), yesterday))
    const revenueYesterday = yesterdayOrders.reduce(
      (sum, o) =>
        o.type === 'dropship'
          ? sum
          : sum + (o.subTotalOverride ?? o.items.reduce((s, i) => s + i.price * i.qty, 0)),
      0,
    )

    // Revenue Month (Internal Only)
    const monthOrders = state.orders.filter((o) => isSameMonth(new Date(o.createdAt), thisMonth))
    const revenueMonth = monthOrders.reduce(
      (sum, o) =>
        o.type === 'dropship'
          ? sum
          : sum + (o.subTotalOverride ?? o.items.reduce((s, i) => s + i.price * i.qty, 0)),
      0,
    )

    const prevMonthOrders = state.orders.filter((o) => isSameMonth(new Date(o.createdAt), prevMonth))
    const revenuePrevMonth = prevMonthOrders.reduce(
      (sum, o) =>
        o.type === 'dropship'
          ? sum
          : sum + (o.subTotalOverride ?? o.items.reduce((s, i) => s + i.price * i.qty, 0)),
      0,
    )

    // Profit Month
    // 1. Internal: Revenue - COGS
    const skusMap = new Map(state.skus.map((s) => [s.id, s]))
    const costMonthInternal = monthOrders.reduce((sum, o) => {
      if (o.type === 'dropship') return sum
      return (
        sum +
        o.items.reduce((s, i) => {
          const sku = skusMap.get(i.skuId)
          return s + (sku?.cost || 0) * i.qty
        }, 0)
      )
    }, 0)
    
    // 2. Dropship: Reconciliation Result
    const profitMonthDropship = monthOrders.reduce((sum, o) => {
        if (o.type !== 'dropship') return sum
        return sum + (o.reconciliationResultAmount || 0)
    }, 0)

    const profitMonth = revenueMonth - costMonthInternal + profitMonthDropship

    const costPrevMonthInternal = prevMonthOrders.reduce((sum, o) => {
      if (o.type === 'dropship') return sum
      return (
        sum +
        o.items.reduce((s, i) => {
          const sku = skusMap.get(i.skuId)
          return s + (sku?.cost || 0) * i.qty
        }, 0)
      )
    }, 0)

    const profitPrevMonthDropship = prevMonthOrders.reduce((sum, o) => {
        if (o.type !== 'dropship') return sum
        return sum + (o.reconciliationResultAmount || 0)
    }, 0)

    const profitPrevMonth = revenuePrevMonth - costPrevMonthInternal + profitPrevMonthDropship

    const shippingMonth = monthOrders.reduce((sum, o) => sum + (Number(o.shippingFee) || 0), 0)
    const costMonth = costMonthInternal

    // Inventory Value
    const stockMap = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      const current = stockMap.get(t.skuId) || 0
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      stockMap.set(t.skuId, current + delta)
    })
    let inventoryValue = 0
    stockMap.forEach((qty, skuId) => {
      const sku = skusMap.get(skuId)
      if (sku && qty > 0) {
        inventoryValue += qty * sku.cost
      }
    })

    // Return Rate
    const totalOrders = state.orders.length
    const returnedOrders = state.orders.filter(o => o.status === 'returned').length
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0

    const prevMonthTotalOrders = prevMonthOrders.length
    const prevMonthReturnedOrders = prevMonthOrders.filter((o) => o.status === 'returned').length
    const returnRatePrevMonth = prevMonthTotalOrders > 0 ? (prevMonthReturnedOrders / prevMonthTotalOrders) * 100 : 0

    // Receivables
    const receivables = state.debts
        .filter(d => d.type === 'receivable' && d.status === 'open')
        .reduce((sum, d) => sum + d.amount, 0)

    // Operation Metrics
    const cancelledOrders = monthOrders.filter(o => o.status === 'cancelled').length
    const cancelRate = monthOrders.length > 0 ? (cancelledOrders / monthOrders.length) * 100 : 0
    
    // Simplified: Late delivery = delivery time > 5 days (mock)
    // Real app would compare deliveredAt vs estimatedArrival
    const lateOrders = monthOrders.filter(o => o.status === 'delivered' && o.items.length > 10).length // Mock logic
    const lateRate = monthOrders.length > 0 ? (lateOrders / monthOrders.length) * 100 : 0

    const fulfillmentRate = monthOrders.length > 0 ? ((monthOrders.length - cancelledOrders) / monthOrders.length) * 100 : 100

    return {
        revenueToday,
        revenueYesterday,
        revenueMonth,
        revenuePrevMonth,
        profitMonth,
        profitPrevMonth,
        shippingMonth,
        costMonth,
        inventoryValue,
        returnRate,
        returnRatePrevMonth,
        receivables,
        cancelRate,
        lateRate,
        fulfillmentRate
    }
  }, [state.orders, state.skus, state.stockTransactions, state.debts])

  // 2. Charts Data
  const revenueByChannel = useMemo(() => {
      const channelMap = new Map<string, number>()
      const thisMonth = startOfMonth(new Date())
      
      state.orders.forEach(o => {
          if (!isSameMonth(new Date(o.createdAt), thisMonth)) return
          // Infer channel from source or channel config
          let channel = 'Khác'
          if (o.source === 'shopee') channel = 'Shopee'
          else if (o.source === 'tiktok') channel = 'TikTok'
          else if (o.source === 'web') channel = 'Website'
          else if (o.source === 'pos') channel = 'POS (Cửa hàng)'
          
          const val = o.items.reduce((s, i) => s + i.price * i.qty, 0)
          channelMap.set(channel, (channelMap.get(channel) || 0) + val)
      })
      
      return Array.from(channelMap.entries()).map(([name, value]) => ({ name, value }))
  }, [state.orders])

  const profitByWarehouse = useMemo(() => {
      const locMap = new Map<string, { revenue: number, cost: number }>()
      const thisMonth = startOfMonth(new Date())
      const skusMap = new Map(state.skus.map((s) => [s.id, s]))

      state.orders.forEach(o => {
          if (!isSameMonth(new Date(o.createdAt), thisMonth)) return
          if (!o.fulfillmentLocationId) return
          
          const revenue = o.items.reduce((s, i) => s + i.price * i.qty, 0)
          const cost = o.items.reduce((s, i) => {
              const sku = skusMap.get(i.skuId)
              return s + (sku?.cost || 0) * i.qty
          }, 0)
          
          const current = locMap.get(o.fulfillmentLocationId) || { revenue: 0, cost: 0 }
          locMap.set(o.fulfillmentLocationId, { 
              revenue: current.revenue + revenue, 
              cost: current.cost + cost 
          })
      })
      
      return Array.from(locMap.entries()).map(([id, val]) => {
          const loc = state.locations.find(l => l.id === id)
          return {
              name: loc?.name || 'Unknown',
              profit: val.revenue - val.cost,
              revenue: val.revenue
          }
      }).sort((a, b) => b.profit - a.profit)
  }, [state.orders, state.locations, state.skus])

  const revenue12Months = useMemo(() => {
      const data = []
      for (let i = 11; i >= 0; i--) {
          const d = subMonths(new Date(), i)
          const monthStart = startOfMonth(d)
          const monthLabel = format(d, 'MM/yyyy')
          
          const orders = state.orders.filter(o => isSameMonth(new Date(o.createdAt), monthStart))
          const rev = orders.reduce((sum, o) => 
            o.type === 'dropship' 
              ? sum 
              : sum + (o.subTotalOverride ?? o.items.reduce((s, item) => s + item.price * item.qty, 0)), 
            0
          )
          
          data.push({ name: monthLabel, revenue: rev })
      }
      return data
  }, [state.orders])

  const hasRevenue = useMemo(() => revenue12Months.some((x) => x.revenue > 0), [revenue12Months])

  const topSkus = useMemo(() => {
      const skuSales = new Map<string, number>()
      state.orders.forEach(o => {
          o.items.forEach(i => {
              skuSales.set(i.skuId, (skuSales.get(i.skuId) || 0) + i.qty)
          })
      })
      
      const sorted = [...skuSales.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([skuId, qty]) => {
              const sku = state.skus.find(s => s.id === skuId)
              const product = state.products.find(p => p.id === sku?.productId)
              return {
                  name: product ? product.name : skuId,
                  value: qty
              }
          })
      
      return sorted.length ? sorted : [{ name: 'Chưa có dữ liệu', value: 0 }]
  }, [state.orders, state.products, state.skus])

  const costBreakdown = useMemo(() => {
    const items = [
      { name: 'Giá vốn hàng bán', value: metrics.costMonth, color: '#0088FE' },
      { name: 'Vận chuyển', value: metrics.shippingMonth, color: '#00C49F' },
    ].filter((x) => x.value > 0)
    const total = items.reduce((s, x) => s + x.value, 0)
    return { items, total }
  }, [metrics.costMonth, metrics.shippingMonth])

  // 3. Alerts
  const alerts = useMemo(() => {
      const lowStockCount = 0 // Calculate if needed, logic is in InventoryPage
      const unreconciled = state.orders.filter(o => o.status === 'delivered' && o.isReconciledCarrier === 'unreconciled').length
      const overdueDebt = state.debts.filter(d => d.status === 'open' && d.dueDate && new Date(d.dueDate) < new Date()).length
      const negativeProfit = 0 // Placeholder

      return { lowStockCount, unreconciled, overdueDebt, negativeProfit }
  }, [state.orders, state.debts])

  const revenueTodayTrend = useMemo(
    () => computeTrend(metrics.revenueToday, metrics.revenueYesterday),
    [metrics.revenueToday, metrics.revenueYesterday],
  )
  const revenueMonthTrend = useMemo(
    () => computeTrend(metrics.revenueMonth, metrics.revenuePrevMonth),
    [metrics.revenueMonth, metrics.revenuePrevMonth],
  )
  const profitMonthTrend = useMemo(
    () => computeTrend(metrics.profitMonth, metrics.profitPrevMonth),
    [metrics.profitMonth, metrics.profitPrevMonth],
  )
  const returnRateTrend = useMemo(
    () => computeTrend(metrics.returnRate, metrics.returnRatePrevMonth),
    [metrics.returnRate, metrics.returnRatePrevMonth],
  )


  return (
    <div className="page">
      <PageHeader 
        title="Executive Dashboard (CEO View)" 
        actions={
            <div className="tabs">
                <button className={`tab ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => setViewMode('overview')}>Tổng quan</button>
                <button className={`tab ${viewMode === 'profit' ? 'active' : ''}`} onClick={() => setViewMode('profit')}>Lợi nhuận & Kênh</button>
                <button className={`tab ${viewMode === 'operation' ? 'active' : ''}`} onClick={() => setViewMode('operation')}>Vận hành</button>
            </div>
        }
      />
      
      {viewMode === 'overview' && (
      <>
      {/* 1. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard 
            label="Doanh thu hôm nay" 
            value={formatVnd(metrics.revenueToday)} 
            icon={<DollarSign size={20} />} 
            color="#2563EB" 
            trend={revenueTodayTrend?.trend}
            trendValue={revenueTodayTrend?.trendValue}
        />
        <MetricCard 
            label="Doanh thu tháng" 
            value={formatVnd(metrics.revenueMonth)} 
            icon={<DollarSign size={20} />} 
            color="#2563EB" 
            trend={revenueMonthTrend?.trend}
            trendValue={revenueMonthTrend?.trendValue}
        />
        <MetricCard 
            label="Lợi nhuận tháng" 
            value={formatVnd(metrics.profitMonth)} 
            icon={<TrendingUp size={20} />} 
            color="#16A34A" 
            trend={profitMonthTrend?.trend}
            trendValue={profitMonthTrend?.trendValue}
        />
        <MetricCard 
            label="Giá trị tồn kho" 
            value={formatVnd(metrics.inventoryValue)} 
            icon={<Package size={20} />} 
            color="#F59E0B" 
        />
        <MetricCard 
            label="Tỷ lệ hoàn" 
            value={`${metrics.returnRate.toFixed(1)}%`} 
            icon={<RotateCcw size={20} />} 
            color="#DC2626" 
            trend={returnRateTrend?.trend}
            trendValue={returnRateTrend?.trendValue}
        />
        <MetricCard 
            label="Công nợ phải thu" 
            value={formatVnd(metrics.receivables)} 
            icon={<Wallet size={20} />} 
            color="#8B5CF6" 
        />
      </div>

      {/* 2. Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card">
              <div className="card-title">Doanh thu 12 tháng gần nhất</div>
              <div style={{ height: 300 }}>
                  {hasRevenue ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenue12Months}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12 }}
                              tickFormatter={(val) => formatAxisMoney(Number(val))}
                              domain={[0, (dataMax: number) => (dataMax <= 0 ? 1 : dataMax)]}
                            />
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} contentStyle={{ borderRadius: 8 }} />
                            <Area type="monotone" dataKey="revenue" stroke="#2563EB" fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                      }}
                    >
                      Chưa có doanh thu trong 12 tháng gần nhất
                    </div>
                  )}
              </div>
          </div>
          
          <div className="card">
              <div className="card-title">Cảnh báo quan trọng</div>
              <div style={{ padding: '0 20px' }}>
                  <AlertItem 
                    label="Tồn kho < 30%" 
                    value={`${alerts.lowStockCount} SKU`} 
                    onClick={() => navigate('/inventory?stockLevel=low')}
                  />
                  <AlertItem label="Đơn chưa đối soát" value={`${alerts.unreconciled} đơn`} type="danger" />
                  <AlertItem label="Công nợ quá hạn" value={`${alerts.overdueDebt} khách`} type="danger" />
                  <AlertItem label="Lợi nhuận âm" value="0 đơn" />
              </div>
          </div>
      </div>

      {/* 3. Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
           <div className="card">
              <div className="card-title">Top 5 SKU bán chạy</div>
              <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topSkus} margin={{ left: 40 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>

           <div className="card">
              <div className="card-title">Cơ cấu chi phí</div>
              <div style={{ height: 300 }}>
                  {costBreakdown.total > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                              data={costBreakdown.items}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {costBreakdown.items.map((x) => (
                                <Cell key={x.name} fill={x.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 14,
                      }}
                    >
                      Chưa có dữ liệu chi phí
                    </div>
                  )}
              </div>
           </div>
      </div>

      {/* 4. Aged Stock Report */}
      {agedStock.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">Cảnh báo tồn kho lâu ngày ({'>'} 15 ngày)</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Tổng tồn</th>
                  <th>Tồn {'>'} 15 ngày</th>
                  <th>Giá trị tồn cũ</th>
                </tr>
              </thead>
              <tbody>
                {agedStock.slice(0, 10).map((item) => (
                  <tr key={item.sku.id}>
                    <td>{skuLabel(productsById, item.sku)}</td>
                    <td>{item.totalStock}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{item.agedQty}</td>
                    <td>{formatVnd(item.agedQty * item.sku.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {agedStock.length > 10 && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              ...và {agedStock.length - 10} SKU khác
            </div>
          )}
        </div>
      )}
      </>
      )}

      {viewMode === 'profit' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
               <div className="card">
                  <div className="card-title">Lợi nhuận theo Kho (Tháng này)</div>
                  <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={profitByWarehouse} layout="vertical" margin={{ left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tickFormatter={(val) => formatAxisMoney(val)} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                              <Legend />
                              <Bar dataKey="revenue" name="Doanh thu" fill="#8884d8" barSize={20} />
                              <Bar dataKey="profit" name="Lợi nhuận gộp" fill="#82ca9d" barSize={20} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
               </div>
               <div className="card">
                  <div className="card-title">Doanh thu theo Kênh bán (Tháng này)</div>
                  <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                data={revenueByChannel}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                 dataKey="value"
                                 label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                               >
                                 {revenueByChannel.map((_entry, index) => (
                                   <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                                 ))}
                               </Pie>
                               <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
               </div>
          </div>
      )}

      {viewMode === 'operation' && (
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
               <MetricCard 
                    label="Tỷ lệ Fulfillment" 
                    value={`${metrics.fulfillmentRate.toFixed(1)}%`} 
                    icon={<Package size={20} />} 
                    color="#10B981" 
                />
               <MetricCard 
                    label="Tỷ lệ Hủy đơn" 
                    value={`${metrics.cancelRate.toFixed(1)}%`} 
                    icon={<Minus size={20} />} 
                    color="#EF4444" 
                />
               <MetricCard 
                    label="Giao hàng chậm (>5 ngày)" 
                    value={`${metrics.lateRate.toFixed(1)}%`} 
                    icon={<Truck size={20} />} 
                    color="#F59E0B" 
                />
               <MetricCard 
                    label="Hiệu suất vận hành" 
                    value="98/100" 
                    icon={<Activity size={20} />} 
                    color="#3B82F6" 
                />
          </div>
      )}
    </div>
  )
}

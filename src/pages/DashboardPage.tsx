import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/Store'
import type { Sku, StockTransaction, Order } from '../domain/types'
import { formatVnd } from '../lib/money'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  Calendar,
  Download
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
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Treemap
} from 'recharts'
import { format, startOfMonth, startOfDay, endOfDay, subMonths, isSameMonth, subDays } from 'date-fns'

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

function SmartMetricCard({
  label,
  value,
  data,
  trend,
  trendValue,
  status = 'neutral'
}: {
  label: string
  value: string
  data?: { value: number }[]
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  status?: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const color = status === 'success' ? '#10B981' : status === 'warning' ? '#F59E0B' : status === 'danger' ? '#EF4444' : '#6B7280'
  const bgColor = status === 'success' ? '#ECFDF5' : status === 'warning' ? '#FFFBEB' : status === 'danger' ? '#FEF2F2' : '#F3F4F6'
  
  return (
    <div className="card" style={{ padding: 16, borderLeft: `4px solid ${color}`, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
          {trend && (
             <div style={{ 
                 display: 'flex', alignItems: 'center', gap: 4, 
                 padding: '2px 6px', borderRadius: 4, 
                 background: bgColor, color: color, fontSize: 12, fontWeight: 600 
             }}>
                 {trend === 'up' ? <TrendingUp size={12}/> : trend === 'down' ? <TrendingDown size={12}/> : <Minus size={12}/>}
                 {trendValue}
             </div>
          )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
          <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {status === 'success' ? 'Tốt' : status === 'warning' ? 'Cần chú ý' : status === 'danger' ? 'Nguy hiểm' : 'Ổn định'}
              </div>
          </div>
          
          {data && data.length > 0 && (
              <div style={{ width: 80, height: 40 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                          <defs>
                              <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${label.replace(/\s/g, '')})`} />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          )}
      </div>
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

function calculateOrderTotal(o: Order): number {
    const subTotal = o.subTotalOverride ?? (o.items || []).reduce((s: number, i: any) => s + i.price * i.qty, 0)
    return subTotal + (o.shippingFee || 0) - (o.discountAmount || 0) + (o.vatAmount || 0) + (o.otherFees || 0)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const state = useAppState()
  const [viewMode, setViewMode] = useState<'overview' | 'profit' | 'finance' | 'warehouse' | 'operation' | 'analysis'>('overview')
  const [filter, setFilter] = useState({
      start: startOfMonth(new Date()),
      end: new Date(), // Today
      warehouseId: 'all',
      channel: 'all'
  })
  
  const productsById = useMemo(() => new Map((state.products || []).map((p) => [p.id, p.name])), [state.products])
  const agedStock = useMemo(() => {
    return calculateAgedStock(state.skus || [], state.stockTransactions || [], 15)
  }, [state.skus, state.stockTransactions])

  // 1. Calculate Metrics
  const metrics = useMemo(() => {
    const allOrders = state.orders || []
    const start = startOfDay(filter.start)
    const end = endOfDay(filter.end)
    
    const filterOrders = (s: Date, e: Date) => allOrders.filter(o => {
        const d = new Date(o.createdAt)
        if (d < s || d > e) return false
        if (filter.warehouseId !== 'all' && o.fulfillmentLocationId !== filter.warehouseId) return false
        if (filter.channel !== 'all' && o.source !== filter.channel) return false
        return true
    })

    const currentOrders = filterOrders(start, end)
    
    const duration = end.getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - duration)
    const prevEnd = new Date(end.getTime() - duration)
    const prevOrders = filterOrders(prevStart, prevEnd)

    const skusMap = new Map((state.skus || []).map(s => [s.id, s]))

    const calcRev = (list: Order[]) => list.reduce((sum, o) => {
        if (o.status === 'cancelled') return sum
        return sum + calculateOrderTotal(o)
    }, 0)

    const calcProfit = (list: Order[]) => list.reduce((sum, o) => {
        if (o.status === 'cancelled') return sum
        const rev = calculateOrderTotal(o)
        const cost = (o.items || []).reduce((s, i) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
        return sum + (rev - cost)
    }, 0)

    const revenue = calcRev(currentOrders)
    const revenuePrev = calcRev(prevOrders)
    const profit = calcProfit(currentOrders)
    const profitPrev = calcProfit(prevOrders)

    const cost = currentOrders.reduce((sum, o) => {
         if (o.status === 'cancelled') return sum
         return sum + (o.items || []).reduce((s, i) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
    }, 0)
    const shipping = currentOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0)



    // Cashflow (Filtered by date)
    const financeTxs = (state.financeTransactions || [])
        .filter(t => {
            const d = new Date(t.createdAt)
            return d >= start && d <= end
        })
    const income = financeTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expense = financeTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const cashflow = income - expense
 
     // Inventory Metrics
     const stockMap = new Map<string, number>()
     const txs = state.stockTransactions || []
     txs.forEach(t => {
         if (filter.warehouseId !== 'all' && t.locationId !== filter.warehouseId) return
         const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
         stockMap.set(t.skuId, (stockMap.get(t.skuId) ?? 0) + delta)
     })

     const inventoryValue = (state.skus || []).reduce((sum, s) => {
         const qty = stockMap.get(s.id) || 0
         return sum + (s.cost || 0) * qty
     }, 0)
     
     const inventoryCount = (state.skus || []).length
     const inventoryLow = (state.skus || []).filter(s => (stockMap.get(s.id) || 0) < 10).length

     // Receivables (Global)
     const receivables = (state.debts || [])
         .filter(d => d.type === 'receivable' && d.status === 'open')
         .reduce((sum, d) => sum + d.amount, 0)

    // Operation Metrics
    const totalOrders = currentOrders.length
    const cancelledOrders = currentOrders.filter(o => o.status === 'cancelled').length
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0
    const returnedOrders = currentOrders.filter(o => o.status === 'returned').length
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0
    const lateOrders = currentOrders.filter(o => o.status === 'delivered' && (o.items || []).length > 10).length // Mock
    const lateRate = totalOrders > 0 ? (lateOrders / totalOrders) * 100 : 0
    const fulfillmentRate = totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders) * 100 : 100

    // History
    const history = []
    let d = new Date(start)
    const maxPoints = 365
    let count = 0
    while (d <= end && count < maxPoints) {
        const dayStart = startOfDay(d)
        const dayEnd = endOfDay(d)
        const dayOrders = currentOrders.filter(o => {
            const od = new Date(o.createdAt)
            return od >= dayStart && od <= dayEnd
        })
        history.push({ 
            date: format(d, 'dd/MM'), 
            revenue: calcRev(dayOrders), 
            profit: calcProfit(dayOrders) 
        })
        d = new Date(d.setDate(d.getDate() + 1))
        count++
    }

    return {
        revenue,
        revenuePrev,
        profit,
        profitPrev,
        inventoryValue,
        cashflow,
        receivables,
         history,
         currentOrders,
         cancelRate,
         returnRate,
         lateRate,
         fulfillmentRate,
         cost,
         shipping,
         income,
         expense,
         inventoryCount,
         inventoryLow,
         stockMap
     }
   }, [state.orders, state.skus, state.stockTransactions, state.financeTransactions, state.debts, filter])

  // 2. Charts Data
  const revenueByChannel = useMemo(() => {
      const map = new Map<string, number>()
      const orders = metrics.currentOrders

      orders.forEach((o) => {
          if (o.status === 'cancelled') return
          // Infer channel from source or channel config
          let channel = 'Khác'
          if (o.source === 'shopee') channel = 'Shopee'
          else if (o.source === 'tiktok') channel = 'TikTok'
          else if (o.source === 'web') channel = 'Website'
          else if (o.source === 'pos') channel = 'POS (Cửa hàng)'
          
          map.set(channel, (map.get(channel) || 0) + calculateOrderTotal(o))
      })
      
      const total = Array.from(map.values()).reduce((a, b) => a + b, 0)
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value, percent: total ? (value / total) * 100 : 0 }))
          .sort((a, b) => b.value - a.value)
  }, [metrics.currentOrders])

  const profitByWarehouse = useMemo(() => {
    const map = new Map<string, { revenue: number, profit: number }>()
    const locs = new Map((state.locations || []).map(l => [l.id, l.name]))
    const skusMap = new Map((state.skus || []).map((s) => [s.id, s]))
    const orders = metrics.currentOrders

    orders.forEach((o) => {
       if (o.status === 'cancelled') return
       const locName = locs.get(o.fulfillmentLocationId || '') || 'Unknown'
       const rev = calculateOrderTotal(o)
       const cost = (o.items || []).reduce((s, i) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
       
       const curr = map.get(locName) || { revenue: 0, profit: 0 }
       map.set(locName, { 
           revenue: curr.revenue + rev, 
           profit: curr.profit + (rev - cost) 
       })
    })
    
    return Array.from(map.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, profit: val.profit }))
        .sort((a, b) => b.profit - a.profit)
  }, [metrics.currentOrders, state.locations, state.skus])

  const inventoryByCategory = useMemo(() => {
      const map = new Map<string, number>()
      const skus = state.skus || []
      const productsMap = new Map((state.products || []).map(p => [p.id, p]))
      const catsMap = new Map((state.categories || []).map(c => [c.id, c.name]))
      
      skus.forEach(s => {
          const prod = productsMap.get(s.productId)
          const catName = catsMap.get(prod?.categoryId || '') || 'Khác'
          const val = (s.cost || 0) * (metrics.stockMap.get(s.id) || 0)
          map.set(catName, (map.get(catName) || 0) + val)
      })
      
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, size: value }))
          .filter(x => x.size > 0)
          .sort((a, b) => b.size - a.size)
  }, [state.skus, state.products, state.categories, metrics.stockMap])

  const revenue12Months = useMemo(() => {
      const orders = (state.orders || []).filter(o => {
          if (o.status === 'cancelled') return false
          if (filter.warehouseId !== 'all' && o.fulfillmentLocationId !== filter.warehouseId) return false
          if (filter.channel !== 'all' && o.source !== filter.channel) return false
          return true
      })
      
      const data = []
      for (let i = 11; i >= 0; i--) {
          const d = subMonths(new Date(), i)
          const monthStart = startOfMonth(d)
          const monthLabel = format(d, 'MM/yyyy')
          
          const monthOrders = orders.filter(o => isSameMonth(new Date(o.createdAt), monthStart))
          const rev = monthOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0)
          
          data.push({ name: monthLabel, revenue: rev })
      }
      return data
  }, [state.orders, filter.warehouseId, filter.channel])

  const hasRevenue = useMemo(() => revenue12Months.some((x) => x.revenue > 0), [revenue12Months])

  const topSkus = useMemo(() => {
      const skuSales = new Map<string, number>()
      const orders = metrics.currentOrders

      orders.forEach(o => {
          if (o.status === 'cancelled') return
          (o.items || []).forEach(i => {
              skuSales.set(i.skuId, (skuSales.get(i.skuId) || 0) + i.qty)
          })
      })
      
      const sorted = [...skuSales.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([skuId, qty]) => {
              const sku = (state.skus || []).find(s => s.id === skuId)
              const product = (state.products || []).find(p => p.id === sku?.productId)
              return {
                  name: product ? product.name : skuId,
                  value: qty
              }
          })
      
      return sorted.length ? sorted : [{ name: 'Chưa có dữ liệu', value: 0 }]
  }, [metrics.currentOrders, state.products, state.skus])

  const customerSegments = useMemo(() => {
      const orders = state.orders || []
      const now = new Date()
      let vip = 0, brandNew = 0, loyal = 0, sleeping = 0
      
      const customerStats = new Map<string, { spend: number, count: number, first: Date, last: Date }>()
      
      orders.forEach(o => {
          if (!o.customerId || o.status !== 'paid') return
          const curr = customerStats.get(o.customerId) || { spend: 0, count: 0, first: new Date(o.createdAt), last: new Date(o.createdAt) }
          const d = new Date(o.createdAt)
          
          customerStats.set(o.customerId, {
              spend: curr.spend + calculateOrderTotal(o),
              count: curr.count + 1,
              first: d < curr.first ? d : curr.first,
              last: d > curr.last ? d : curr.last
          })
      })
      
      customerStats.forEach((stat) => {
          const daysSinceFirst = (now.getTime() - stat.first.getTime()) / (1000 * 3600 * 24)
          const daysSinceLast = (now.getTime() - stat.last.getTime()) / (1000 * 3600 * 24)
          
          if (stat.spend > 20000000 || stat.count > 10) vip++
          else if (daysSinceFirst < 30) brandNew++
          else if (daysSinceLast > 90) sleeping++
          else loyal++
      })
      
      const data = [
          { name: 'VIP', value: vip, color: '#F59E0B' },
          { name: 'Mới', value: brandNew, color: '#10B981' },
          { name: 'Thân thiết', value: loyal, color: '#3B82F6' },
          { name: 'Ngủ đông', value: sleeping, color: '#6B7280' }
      ].filter(x => x.value > 0)
      return data.length ? data : [{ name: 'Chưa có dữ liệu', value: 1, color: '#E5E7EB' }]
  }, [state.orders])

  const heatmapData = useMemo(() => {
      const counts = Array.from({ length: 7 }, () => Array(24).fill(0))
      ;(state.orders || []).forEach(o => {
          if (o.status === 'cancelled') return
          const d = new Date(o.createdAt)
          counts[d.getDay()][d.getHours()] += 1
      })
      const data = []
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
              if (counts[d][h] > 0) {
                  data.push({ day: days[d], hour: h, count: counts[d][h], index: d })
              }
          }
      }
      return data
  }, [state.orders])

  const categoryStats = useMemo(() => {
      const map = new Map<string, number>()
      const skus = new Map((state.skus || []).map(s => [s.id, s]))
      const prods = new Map((state.products || []).map(p => [p.id, p]))
      const cats = new Map((state.categories || []).map(c => [c.id, c.name]))

      ;(state.orders || []).forEach(o => {
          if (o.status === 'cancelled') return
          (o.items || []).forEach(i => {
              const sku = skus.get(i.skuId)
              const prod = prods.get(sku?.productId || '')
              const catName = cats.get(prod?.categoryId || '') || 'Khác'
              const rev = i.price * i.qty
              map.set(catName, (map.get(catName) || 0) + rev)
          })
      })

      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
  }, [state.orders, state.skus, state.products, state.categories])

  const salesLeaderboard = useMemo(() => {
      const map = new Map<string, number>()
      const users = new Map((state.users || []).map(u => [u.id, u.fullName]))
      
      ;(state.orders || []).forEach(o => {
          if (o.status === 'cancelled') return
          const userId = o.createdByUserId || 'unknown'
          const userName = users.get(userId) || 'Unknown'
          const rev = (o.items || []).reduce((s, i) => s + i.price * i.qty, 0)
          map.set(userName, (map.get(userName) || 0) + rev)
      })
      
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
  }, [state.orders, state.users])

  const topProfitSkus = useMemo(() => {
      const map = new Map<string, number>()
      const skus = new Map((state.skus || []).map(s => [s.id, s]))
      const products = new Map((state.products || []).map(p => [p.id, p.name]))
      
      ;(state.orders || []).forEach(o => {
          if (o.status === 'cancelled') return
          (o.items || []).forEach(i => {
              const sku = skus.get(i.skuId)
              const cost = sku?.cost || 0
              const profit = (i.price - cost) * i.qty
              const label = products.get(sku?.productId || '') || i.skuId
              map.set(label, (map.get(label) || 0) + profit)
          })
      })
      
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
  }, [state.orders, state.skus, state.products])

  // 3. Alerts
  const alerts = useMemo(() => {
      const lowStockCount = 0 // Calculate if needed, logic is in InventoryPage
      const unreconciled = (state.orders || []).filter(o => o.status === 'delivered' && o.isReconciledCarrier === 'unreconciled').length
      const overdueDebt = (state.debts || []).filter(d => d.status === 'open' && d.dueDate && new Date(d.dueDate) < new Date()).length
      const negativeProfit = 0 // Placeholder

      return { lowStockCount, unreconciled, overdueDebt, negativeProfit }
  }, [state.orders, state.debts])

  const revenueTrend = useMemo(
    () => computeTrend(metrics.revenue, metrics.revenuePrev),
    [metrics.revenue, metrics.revenuePrev],
  )
  const profitTrend = useMemo(
    () => computeTrend(metrics.profit, metrics.profitPrev),
    [metrics.profit, metrics.profitPrev],
  )

  const handleExport = () => {
    const headers = ['Date', 'Revenue', 'Profit']
    const rows = metrics.history.map(h => [h.date, h.revenue.toString(), h.profit.toString()])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  return (
    <div className="page">
      <div className="row-between" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
            <h1 className="page-title" style={{ fontSize: 24, fontWeight: 700 }}>Tổng quan</h1>
            <div style={{ marginTop: 4, color: '#6b7280', fontSize: 14 }}>
                {format(new Date(), 'EEEE, dd/MM/yyyy')}
            </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <button onClick={handleExport} style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13 }}>
                 <Download size={16} />
                 Xuất báo cáo
             </button>

             <div className="filter-group" style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                 <Calendar size={16} style={{ marginRight: 8, color: '#6b7280' }} />
                 <input 
                    type="date" 
                    value={format(filter.start, 'yyyy-MM-dd')}
                    onChange={e => setFilter({...filter, start: new Date(e.target.value)})}
                    style={{ border: 'none', outline: 'none', fontSize: 13, color: '#374151', width: 110 }}
                 />
                 <span style={{ color: '#9ca3af', margin: '0 4px' }}>-</span>
                 <input 
                    type="date" 
                    value={format(filter.end, 'yyyy-MM-dd')}
                    onChange={e => setFilter({...filter, end: new Date(e.target.value)})}
                    style={{ border: 'none', outline: 'none', fontSize: 13, color: '#374151', width: 110 }}
                 />
             </div>
             
             <select 
                value={filter.warehouseId} 
                onChange={e => setFilter({...filter, warehouseId: e.target.value})}
                className="select"
                style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
             >
                 <option value="all">Tất cả kho</option>
                 {(state.locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
             </select>
             
             <select 
                value={filter.channel} 
                onChange={e => setFilter({...filter, channel: e.target.value})}
                className="select"
                style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
             >
                 <option value="all">Tất cả kênh</option>
                 <option value="pos">POS</option>
                 <option value="shopee">Shopee</option>
                 <option value="lazada">Lazada</option>
                 <option value="tiktok">TikTok</option>
                 <option value="wholesale">Bán buôn</option>
             </select>

             <div className="tabs" style={{ background: '#f3f4f6', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
                <button className={`tab ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => setViewMode('overview')}>Tổng quan</button>
                <button className={`tab ${viewMode === 'finance' ? 'active' : ''}`} onClick={() => setViewMode('finance')}>Tài chính</button>
                <button className={`tab ${viewMode === 'warehouse' ? 'active' : ''}`} onClick={() => setViewMode('warehouse')}>Kho</button>
                <button className={`tab ${viewMode === 'operation' ? 'active' : ''}`} onClick={() => setViewMode('operation')}>Vận hành</button>
                <button className={`tab ${viewMode === 'analysis' ? 'active' : ''}`} onClick={() => setViewMode('analysis')}>BI</button>
            </div>
        </div>
      </div>
      
      {viewMode === 'overview' && (
      <>
      {/* 1. KPI Cards (5 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
        <SmartMetricCard 
            label="Doanh thu" 
            value={formatVnd(metrics.revenue)} 
            trend={revenueTrend?.trend}
            trendValue={revenueTrend?.trendValue}
            status="neutral"
            data={metrics.history.map(h => ({ value: h.revenue }))}
        />
        <SmartMetricCard 
            label="Lợi nhuận" 
            value={formatVnd(metrics.profit)} 
            data={metrics.history.map(h => ({ value: h.profit }))}
            trend={profitTrend?.trend}
            trendValue={profitTrend?.trendValue}
            status={metrics.profit > 0 ? 'success' : 'danger'}
        />
        <SmartMetricCard 
            label="Dòng tiền" 
            value={formatVnd(metrics.cashflow)} 
            status={metrics.cashflow > 0 ? 'success' : 'danger'}
        />
        <SmartMetricCard 
            label="Giá trị tồn kho" 
            value={formatVnd(metrics.inventoryValue)} 
            status="warning"
        />
        <SmartMetricCard 
            label="Đơn hàng" 
            value={`${metrics.currentOrders.length}`} 
            status="neutral"
        />
      </div>

      {/* 2. Revenue Trend (Full Width) */}
      <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Xu hướng doanh thu (12 tháng)</div>
          <div style={{ height: 320 }}>
              {hasRevenue ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue12Months} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                        <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="center-text">Chưa có doanh thu trong 12 tháng gần nhất</div>
              )}
          </div>
      </div>

      {/* 3. Deep Dive (4 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 20 }}>
           {/* Channel Sales */}
           <div className="card">
              <div className="card-title">Kênh bán hàng</div>
              <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                            data={revenueByChannel}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {revenueByChannel.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
           </div>

           {/* Top Products */}
           <div className="card">
              <div className="card-title">Top Sản phẩm</div>
              <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topSkus} margin={{ left: 0, right: 10 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>

           {/* Warehouse Profit */}
           <div className="card">
              <div className="card-title">Lợi nhuận Kho</div>
              <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profitByWarehouse} margin={{ left: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                          <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>

           {/* Inventory Health (Treemap) */}
           <div className="card">
              <div className="card-title">Phân bổ tồn kho</div>
              <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <Treemap data={inventoryByCategory} dataKey="size" aspectRatio={1} stroke="#fff" fill="#8884d8">
                          <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                      </Treemap>
                  </ResponsiveContainer>
              </div>
           </div>
      </div>

      {/* 4. Customer & Sales Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
           <div className="card">
              <div className="card-title">Phân khúc khách hàng</div>
              <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                            data={customerSegments}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {customerSegments.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
           </div>
           
           <div className="card">
              <div className="card-title">Top Nhân viên kinh doanh</div>
              <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={salesLeaderboard} margin={{ left: 40 }}>
                          <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                          <Bar dataKey="value" fill="#3B82F6" barSize={20} radius={[0, 4, 4, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>
      </div>

      {/* 5. Alerts Row */}
      <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Cảnh báo & Việc cần làm</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, padding: '0 20px 20px' }}>
              <AlertItem 
                label="Tồn kho < 30%" 
                value={`${metrics.inventoryLow} SKU`} 
                onClick={() => navigate('/inventory?stockLevel=low')}
              />
              <AlertItem label="Đơn chưa đối soát" value={`${alerts.unreconciled} đơn`} type="danger" />
              <AlertItem label="Công nợ quá hạn" value={`${alerts.overdueDebt} khách`} type="danger" />
              <AlertItem label="Công nợ phải thu" value={formatVnd(metrics.receivables)} type="warning" />
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

      {viewMode === 'finance' && (
         <>
           <div className="card-title" style={{ marginBottom: 12 }}>Dòng tiền (Cashflow)</div>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
               <SmartMetricCard label="Thu (Income)" value={formatVnd(metrics.income)} status="success" />
               <SmartMetricCard label="Chi (Expense)" value={formatVnd(metrics.expense)} status="danger" />
               <SmartMetricCard label="Dòng tiền ròng" value={formatVnd(metrics.cashflow)} status={metrics.cashflow > 0 ? 'success' : 'danger'} />
               <SmartMetricCard label="Công nợ phải thu" value={formatVnd(metrics.receivables)} status="warning" />
           </div>

           <div className="card-title" style={{ marginBottom: 12 }}>Kết quả kinh doanh (P&L)</div>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <SmartMetricCard label="Doanh thu thuần" value={formatVnd(metrics.revenue)} status="success" />
                <SmartMetricCard label="Giá vốn" value={formatVnd(metrics.cost)} status="warning" />
                <SmartMetricCard label="Lợi nhuận gộp" value={formatVnd(metrics.profit)} status="success" />
                <SmartMetricCard label="Biên lợi nhuận" value={`${metrics.revenue ? ((metrics.profit / metrics.revenue) * 100).toFixed(1) : 0}%`} status="neutral" />
           </div>
           
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card">
                   <div className="card-title">Lợi nhuận theo Kho</div>
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
                   <div className="card-title">Doanh thu theo Kênh bán</div>
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
         </>
       )}

      {viewMode === 'warehouse' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <SmartMetricCard label="Tổng giá trị kho" value={formatVnd(metrics.inventoryValue)} status="warning" />
                <SmartMetricCard label="Số lượng SKU" value={`${metrics.inventoryCount}`} status="neutral" />
                <SmartMetricCard label="Cảnh báo tồn thấp" value={`${metrics.inventoryLow}`} status="danger" />
            </div>
            
            <div className="card">
                <div className="card-title">Giá trị tồn kho theo Danh mục</div>
                <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={inventoryByCategory}
                            dataKey="size"
                            aspectRatio={4 / 3}
                            stroke="#fff"
                            fill="#8884d8"
                        >
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            </div>
          </>
      )}

      {viewMode === 'operation' && (
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
               <SmartMetricCard 
                    label="Tỷ lệ Fulfillment" 
                    value={`${metrics.fulfillmentRate.toFixed(1)}%`} 
                    status="success"
                />
               <SmartMetricCard 
                    label="Tỷ lệ Hủy đơn" 
                    value={`${metrics.cancelRate.toFixed(1)}%`} 
                    status={metrics.cancelRate > 10 ? 'danger' : 'neutral'}
                />
               <SmartMetricCard 
                    label="Giao hàng chậm (>5 ngày)" 
                    value={`${metrics.lateRate.toFixed(1)}%`} 
                    status={metrics.lateRate > 5 ? 'warning' : 'success'}
                />
               <SmartMetricCard 
                    label="Hiệu suất vận hành" 
                    value="98/100" 
                    status="success"
                />
          </div>
      )}

      {viewMode === 'analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                  <div className="card-title">Phân tích Giờ vàng (Heatmap)</div>
                  <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid />
                              <XAxis type="number" dataKey="hour" name="Giờ" unit="h" domain={[0, 23]} tickCount={12} />
                              <YAxis type="category" dataKey="day" name="Thứ" allowDuplicatedCategory={false} />
                              <ZAxis type="number" dataKey="count" range={[50, 400]} name="Đơn hàng" />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                              <Scatter name="Orders" data={heatmapData} fill="#8884d8" />
                          </ScatterChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="card">
                  <div className="card-title">Doanh thu theo Danh mục</div>
                  <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={categoryStats} margin={{ left: 40 }}>
                              <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                              <Bar dataKey="value" fill="#82ca9d" barSize={20} radius={[0, 4, 4, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="card">
                  <div className="card-title">Top Nhân viên (Doanh thu)</div>
                  <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={salesLeaderboard} margin={{ left: 40 }}>
                              <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                              <Bar dataKey="value" fill="#3B82F6" barSize={20} radius={[0, 4, 4, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="card">
                  <div className="card-title">Top Sản phẩm Lợi nhuận cao</div>
                  <div style={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={topProfitSkus} margin={{ left: 40 }}>
                              <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                              <Bar dataKey="value" fill="#10B981" barSize={20} radius={[0, 4, 4, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}

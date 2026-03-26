import { useCallback, useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/Store'
import type { Sku, StockTransaction, Order } from '../../shared/types/domain'
import { AnalyticsApi, type BusinessKPIs, type RevenueHistory, type TopProduct, type ChannelPerformance } from '../api/analytics'
import { formatVnd } from '../../shared/lib/money'
import { PageHeader } from '../ui-kit/PageHeader'
import { FilterBar } from '../ui-kit/FilterBar'
import { EmptyState } from '../ui-kit/EmptyState'
import { LoadingState } from '../ui-kit/LoadingState'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  Search,
  Calendar,
  Download,
  RefreshCw,
  Plus,
  ShoppingCart,
  Package,
  Boxes,
  Percent,
  Wallet,
  LayoutDashboard,
  DollarSign,
  Activity,
  BarChart3,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  BadgePercent,
  Receipt,
  CheckSquare
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
import { format, startOfMonth, startOfDay, endOfDay, subDays } from 'date-fns'
import { SmartTable, type Column, type SortConfig } from '../ui-kit/listing/SmartTable'

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
  status = 'neutral',
  icon,
  accent,
  meta,
  subtitle,
  isLoading,
  onClick,
}: {
  label: string
  value: string
  data?: { value: number }[]
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  status?: 'success' | 'warning' | 'danger' | 'neutral'
  icon?: React.ReactNode
  accent?: string
  meta?: string
  subtitle?: string
  isLoading?: boolean
  onClick?: () => void
}) {
  const statusClass = status === 'success' ? 'kpi-success' : status === 'warning' ? 'kpi-warning' : status === 'danger' ? 'kpi-danger' : 'kpi-neutral'
  const kpiAccent = accent ?? undefined
  const trendBg =
    kpiAccent === '#2563EB'
      ? 'rgba(37, 99, 235, 0.12)'
      : kpiAccent === '#16A34A'
        ? 'rgba(22, 163, 74, 0.12)'
        : kpiAccent === '#F59E0B'
          ? 'rgba(245, 158, 11, 0.12)'
          : kpiAccent === '#DC2626'
            ? 'rgba(220, 38, 38, 0.12)'
            : kpiAccent === '#7C3AED'
              ? 'rgba(124, 58, 237, 0.12)'
              : undefined
  
  return (
    <div
      className={`card kpi-card kpi-entity ${statusClass}${onClick ? ' clickable' : ''}`}
      style={
        kpiAccent
          ? ({ ['--kpi-accent' as any]: kpiAccent, ['--kpi-trend-bg' as any]: trendBg ?? undefined } as any)
          : undefined
      }
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      <div className="kpi-head">
        <div className="kpi-label">{label}</div>
        {trend ? (
          <div className="kpi-trend">
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trendValue}
          </div>
        ) : null}
      </div>

      <div className="kpi-body">
        <div className="kpi-left">
          {icon ? <div className="kpi-icon">{icon}</div> : null}
          <div>
            <div className={isLoading ? 'kpi-value kpi-skeleton' : 'kpi-value'}>{value}</div>
            <div className="kpi-meta">{meta ?? (status === 'success' ? 'Tốt' : status === 'warning' ? 'Cần chú ý' : status === 'danger' ? 'Nguy hiểm' : 'Ổn định')}</div>
          </div>
        </div>

        {data && data.length > 0 ? (
          <div className="kpi-spark">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--kpi-accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--kpi-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="var(--kpi-accent)" strokeWidth={2} fill={`url(#grad-${label.replace(/\s/g, '')})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      {subtitle ? <div className="kpi-sub">{subtitle}</div> : null}
    </div>
  )
}

function DashboardEmpty({ title, hint, actionLabel, onAction }: { title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  const isLoading = title.toLowerCase().includes('đang tải')
  if (isLoading) return <LoadingState title={title} rows={5} />
  return (
    <EmptyState
      title={title}
      hint={hint}
      action={
        actionLabel && onAction ? (
          <button className="btn btn-primary btn-small" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null
      }
    />
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
    list.sort((a: any, b: any) => {
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

  return result.sort((a: any, b: any) => b.agedQty - a.agedQty)
}

function calculateOrderTotal(o: Order): number {
    const subTotal = o.subTotalOverride ?? (o.items || []).reduce((s: number, i: any) => s + i.price * i.qty, 0)
    return subTotal + (o.shippingFee || 0) - (o.discountAmount || 0) + (o.vatAmount || 0) + (o.otherFees || 0)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]!
  const last = parts.length > 1 ? parts[parts.length - 1]! : ''
  const a = first[0] ?? '?'
  const b = last[0] ?? ''
  return (a + b).toUpperCase()
}

export function DashboardPage() {
  const navigate = useNavigate()
  const state = useAppState()
  const [viewMode, setViewMode] = useState<'overview' | 'profit' | 'finance' | 'warehouse' | 'operation' | 'analysis'>('overview')
  const defaultFilter = useMemo(
    () => ({
      start: startOfMonth(new Date()),
      end: new Date(),
      warehouseId: 'all',
      channel: 'all',
    }),
    [],
  )
  const [filter, setFilter] = useState(defaultFilter)
  const [draftFilter, setDraftFilter] = useState(defaultFilter)

  const [staffRevenueQuery, setStaffRevenueQuery] = useState('')
  const [staffRevenueSort, setStaffRevenueSort] = useState<SortConfig>({ key: 'revenue', direction: 'desc' })
  const [staffRevenuePage, setStaffRevenuePage] = useState(1)
  const [staffRevenuePageSize, setStaffRevenuePageSize] = useState(10)
  
  const [apiKpi, setApiKpi] = useState<BusinessKPIs | null>(null)
  const [apiHistory, setApiHistory] = useState<RevenueHistory[]>([])
  const [apiTopProducts, setApiTopProducts] = useState<TopProduct[]>([])
  const [apiChannels, setApiChannels] = useState<ChannelPerformance[]>([])

  const [apiLoading, setApiLoading] = useState(false)
  const [apiReloadKey, setApiReloadKey] = useState(0)

  const reloadApi = useCallback(() => {
    setApiReloadKey((v) => v + 1)
  }, [])

  useEffect(() => {
    let alive = true
    setApiLoading(true)
    Promise.all([
      AnalyticsApi.getBusinessKPIs(filter.start, filter.end),
      AnalyticsApi.getRevenueHistory(),
      AnalyticsApi.getTopProducts(5),
      AnalyticsApi.getChannelPerformance(filter.start, filter.end),
    ])
      .then(([kpi, history, top, channels]) => {
        if (!alive) return
        setApiKpi(kpi)
        setApiHistory(history)
        setApiTopProducts(top)
        setApiChannels(channels)
      })
      .catch(console.error)
      .finally(() => {
        if (!alive) return
        setApiLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filter.start, filter.end, apiReloadKey])

  useEffect(() => {
    setDraftFilter(filter)
  }, [filter])
  
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
        const cost = (o.items || []).reduce((s: any, i: any) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
        return sum + (rev - cost)
    }, 0)

    const revenue = calcRev(currentOrders)
    const revenuePrev = calcRev(prevOrders)
    const profit = calcProfit(currentOrders)
    const profitPrev = calcProfit(prevOrders)

    const cost = currentOrders.reduce((sum, o) => {
         if (o.status === 'cancelled') return sum
         return sum + (o.items || []).reduce((s: any, i: any) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
    }, 0)
    const shipping = currentOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0)



    const financeTxs = (state.financeTransactions || []).filter((t) => {
      const d = new Date(t.createdAt)
      return d >= start && d <= end
    })
    const financeTxsPrev = (state.financeTransactions || []).filter((t) => {
      const d = new Date(t.createdAt)
      return d >= prevStart && d <= prevEnd
    })
    const income = financeTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expense = financeTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const cashflow = income - expense
    const incomePrev = financeTxsPrev.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expensePrev = financeTxsPrev.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const cashflowPrev = incomePrev - expensePrev
 
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

    const now = new Date()
    const receivableOpen = (state.debts || []).filter((d) => d.type === 'receivable' && d.status === 'open')
    const receivables = receivableOpen.reduce((sum, d) => sum + d.amount, 0)
    const receivableOverdueCount = receivableOpen.filter((d) => d.dueDate && new Date(d.dueDate) < now).length
    const receivableDueSoonCount = receivableOpen.filter((d) => {
      if (!d.dueDate) return false
      const due = new Date(d.dueDate)
      const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)
      return diffDays >= 0 && diffDays <= 7
    }).length

    // Operation Metrics
    const totalOrders = currentOrders.length
    const cancelledOrders = currentOrders.filter(o => o.status === 'cancelled').length
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0
    const returnedOrders = currentOrders.filter(o => o.status === 'returned').length
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0
    const lateRate = 0
    const fulfillmentRate = totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders) * 100 : 100
    const pendingOrdersCount = currentOrders.filter(o => ['confirmed', 'paid', 'picking', 'packed'].includes(o.status)).length

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

    const cashflowHistory = []
    d = new Date(start)
    count = 0
    while (d <= end && count < maxPoints) {
      const dayStart = startOfDay(d)
      const dayEnd = endOfDay(d)
      const dayTxs = financeTxs.filter((t) => {
        const td = new Date(t.createdAt)
        return td >= dayStart && td <= dayEnd
      })
      const dayIncome = dayTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const dayExpense = dayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      cashflowHistory.push({
        date: format(d, 'dd/MM'),
        income: dayIncome,
        expense: dayExpense,
        cashflow: dayIncome - dayExpense,
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
        cashflowPrev,
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
         incomePrev,
         expensePrev,
         inventoryCount,
         inventoryLow,
         stockMap,
         pendingOrdersCount,
         receivableOverdueCount,
         receivableDueSoonCount,
         cashflowHistory
     }
   }, [state.orders, state.skus, state.stockTransactions, state.financeTransactions, state.debts, filter])

  const incomeTrend = useMemo(() => computeTrend(metrics.income, metrics.incomePrev), [metrics.income, metrics.incomePrev])
  const expenseTrend = useMemo(() => computeTrend(metrics.expense, metrics.expensePrev), [metrics.expense, metrics.expensePrev])
  const cashflowTrend = useMemo(() => computeTrend(metrics.cashflow, metrics.cashflowPrev), [metrics.cashflow, metrics.cashflowPrev])
  const margin = useMemo(() => (metrics.revenue ? (metrics.profit / metrics.revenue) * 100 : 0), [metrics.profit, metrics.revenue])
  const marginPrev = useMemo(() => (metrics.revenuePrev ? (metrics.profitPrev / metrics.revenuePrev) * 100 : 0), [metrics.profitPrev, metrics.revenuePrev])
  const marginTrend = useMemo(() => computeTrend(margin, marginPrev), [margin, marginPrev])

  const channelOrderCounts = useMemo(() => {
    const map = new Map<string, number>()
    metrics.currentOrders.forEach((o) => {
      const k = o.source || 'other'
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    return map
  }, [metrics.currentOrders])

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    const start = startOfDay(filter.start)
    const end = endOfDay(filter.end)
    ;(state.financeTransactions || []).forEach((t) => {
      const d = new Date(t.createdAt)
      if (d < start || d > end) return
      if (t.type !== 'expense') return
      const k = t.category || 'Khác'
      map.set(k, (map.get(k) ?? 0) + t.amount)
    })
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0)
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, percent: total ? (value / total) * 100 : 0 }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 8)
  }, [state.financeTransactions, filter.start, filter.end, metrics.cashflowHistory])

  const receivableAging = useMemo(() => {
    const open = (state.debts || []).filter((d) => d.type === 'receivable' && d.status === 'open' && d.dueDate)
    const now = new Date()
    const buckets = {
      notDue: { label: 'Chưa đến hạn', value: 0 },
      d1_7: { label: 'Quá hạn 1–7 ngày', value: 0 },
      d8_30: { label: 'Quá hạn 8–30 ngày', value: 0 },
      d30: { label: 'Quá hạn >30 ngày', value: 0 },
    }
    open.forEach((d) => {
      const due = new Date(d.dueDate!)
      const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24))
      if (days <= 0) buckets.notDue.value += d.amount
      else if (days <= 7) buckets.d1_7.value += d.amount
      else if (days <= 30) buckets.d8_30.value += d.amount
      else buckets.d30.value += d.amount
    })
    const list = Object.values(buckets)
    const total = list.reduce((s, v) => s + v.value, 0)
    return { list, total }
  }, [state.debts])


  const operationScore = useMemo(() => {
    const base = 100
    const score = base - metrics.cancelRate * 0.6 - metrics.returnRate * 0.3 - metrics.lateRate * 0.4
    const clamped = Math.max(0, Math.min(100, score))
    return Math.round(clamped)
  }, [metrics.cancelRate, metrics.returnRate, metrics.lateRate])

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
          .sort((a: any, b: any) => b.value - a.value)
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
       const cost = (o.items || []).reduce((s: any, i: any) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
       
       const curr = map.get(locName) || { revenue: 0, profit: 0 }
       map.set(locName, { 
           revenue: curr.revenue + rev, 
           profit: curr.profit + (rev - cost) 
       })
    })
    
    return Array.from(map.entries())
        .map(([name, val]) => ({ name, revenue: val.revenue, profit: val.profit }))
        .sort((a: any, b: any) => b.profit - a.profit)
  }, [metrics.currentOrders, state.locations, state.skus])

  const bestWarehouseByProfit = useMemo(() => {
    const list = profitByWarehouse.filter((x) => Number(x.revenue) > 0)
    if (!list.length) return null
    const best = [...list].sort((a: any, b: any) => (Number(b.profit) || 0) - (Number(a.profit) || 0))[0]!
    const worstMargin = [...list]
      .map((x) => ({ name: x.name, margin: Number(x.revenue) ? (Number(x.profit) / Number(x.revenue)) * 100 : 0 }))
      .sort((a: any, b: any) => a.margin - b.margin)[0]!
    return {
      bestName: best.name,
      bestProfit: Number(best.profit) || 0,
      worstMarginName: worstMargin.name,
      worstMargin: worstMargin.margin,
    }
  }, [profitByWarehouse])

  const inventoryByCategory = useMemo(() => {
      const map = new Map<string, number>()
      const skus = state.skus || []
      const productsMap = new Map((state.products || []).map((p: any) => [p.id, p]))
      const catsMap = new Map((state.categories || []).map(c => [c.id, c.name]))
      
      skus.forEach(s => {
          const prod = productsMap.get(s.productId)
          const catName = catsMap.get(prod?.categoryId || '') || 'Khác'
          const val = (s.cost || 0) * (metrics.stockMap.get(s.id) || 0)
          map.set(catName, (map.get(catName) || 0) + val)
      })
      
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, size: value }))
          .filter((x: any) => x.size > 0)
          .sort((a: any, b: any) => b.size - a.size)
  }, [state.skus, state.products, state.categories, metrics.stockMap])

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
          .sort((a: any, b: any) => b[1] - a[1])
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
      const orders = metrics.currentOrders
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
          // Logic for segments might need adjustment for short period?
          // If period is 1 month, daysSinceFirst will be small for everyone if we only consider orders in this month?
          // No, we need LIFETIME stats to segment, but filter by activity?
          // If we only look at this month's orders, we lose history.
          // Ideally: Filter customers who bought in this period, but classify them based on LIFETIME history.
          // This requires iterating ALL orders to build profiles, then filtering profiles by activity in period.
          // This is expensive.
          // For now, I will stick to "Segment based on activity in period" or "All time segments".
          // If I use 'state.orders' (All time), the chart is static regardless of date filter.
          // If I use 'metrics.currentOrders', it shows segments of *active* customers.
          // I'll stick to `metrics.currentOrders` for consistency with other charts.
          
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
      ].filter((x: any) => x.value > 0)
      return data.length ? data : [{ name: 'Chưa có dữ liệu', value: 1, color: '#E5E7EB' }]
  }, [metrics.currentOrders])

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
      const prods = new Map((state.products || []).map((p: any) => [p.id, p]))
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
          .sort((a: any, b: any) => b.value - a.value)
  }, [state.orders, state.skus, state.products, state.categories])

  type StaffRevenueRow = {
    id: string
    name: string
    ordersCount: number
    revenue: number
    revenuePercent: number
    avgOrderValue: number
  }

  const staffRevenueRows = useMemo<StaffRevenueRow[]>(() => {
    const users = new Map((state.users || []).map(u => [u.id, u.fullName]))
    const map = new Map<string, { name: string; ordersCount: number; revenue: number }>()

    metrics.currentOrders.forEach((o) => {
      if (o.status === 'cancelled') return
      const userId = o.createdByUserId || 'unknown'
      const userName = users.get(userId) || 'Unknown'
      const rev = calculateOrderTotal(o)

      const curr = map.get(userId) || { name: userName, ordersCount: 0, revenue: 0 }
      map.set(userId, { name: curr.name, ordersCount: curr.ordersCount + 1, revenue: curr.revenue + rev })
    })

    const totalRevenue = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0)
    return Array.from(map.entries()).map(([id, v]) => {
      const avg = v.ordersCount ? v.revenue / v.ordersCount : 0
      return {
        id,
        name: v.name,
        ordersCount: v.ordersCount,
        revenue: v.revenue,
        revenuePercent: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
        avgOrderValue: avg,
      }
    })
  }, [metrics.currentOrders, state.users])

  const salesLeaderboard = useMemo(() => {
    return [...staffRevenueRows]
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((r) => ({ name: r.name, value: r.revenue }))
  }, [staffRevenueRows])

  const staffRevenueRankByRevenue = useMemo(() => {
    const sorted = [...staffRevenueRows].sort((a: any, b: any) => b.revenue - a.revenue)
    const rankMap = new Map<string, number>()
    sorted.forEach((r, i) => rankMap.set(r.id, i + 1))
    return rankMap
  }, [staffRevenueRows])

  const staffRevenueFilteredSorted = useMemo(() => {
    const q = staffRevenueQuery.trim().toLowerCase()
    const filtered = q
      ? staffRevenueRows.filter((r) => r.name.toLowerCase().includes(q))
      : staffRevenueRows

    const sorted = [...filtered]
    const dir = staffRevenueSort.direction === 'asc' ? 1 : -1
    sorted.sort((a: any, b: any) => {
      switch (staffRevenueSort.key) {
        case 'name':
          return a.name.localeCompare(b.name, 'vi') * dir
        case 'ordersCount':
          return (a.ordersCount - b.ordersCount) * dir
        case 'revenuePercent':
          return (a.revenuePercent - b.revenuePercent) * dir
        case 'avgOrderValue':
          return (a.avgOrderValue - b.avgOrderValue) * dir
        case 'revenue':
        default:
          return (a.revenue - b.revenue) * dir
      }
    })

    return sorted
  }, [staffRevenueRows, staffRevenueQuery, staffRevenueSort])

  const staffRevenuePageData = useMemo(() => {
    const start = (staffRevenuePage - 1) * staffRevenuePageSize
    return staffRevenueFilteredSorted.slice(start, start + staffRevenuePageSize)
  }, [staffRevenueFilteredSorted, staffRevenuePage, staffRevenuePageSize])

  const staffRevenueColumns = useMemo<Column<StaffRevenueRow>[]>(() => {
    return [
      {
        key: 'rank',
        title: '#',
        width: 52,
        align: 'right',
        render: (r) => staffRevenueRankByRevenue.get(r.id) ?? '-',
      },
      {
        key: 'name',
        title: 'Nhân viên',
        sortable: true,
        render: (r) => {
          const rank = staffRevenueRankByRevenue.get(r.id) ?? 0
          const badge = rank === 1 ? 'badge badge-info' : rank === 2 ? 'badge badge-success' : rank === 3 ? 'badge badge-warning' : 'badge badge-neutral'
          const badgeLabel = rank ? `#${rank}` : '—'
          return (
            <div className="dash-staff-cell">
              <div className="dash-avatar">{initials(r.name)}</div>
              <div className="dash-staff-meta">
                <div className="dash-staff-name">{r.name}</div>
                <div className="dash-staff-sub">
                  <span className={badge}>{badgeLabel}</span>
                  <span className="dash-staff-subtext">TB/đơn: {formatVnd(r.avgOrderValue)}</span>
                </div>
              </div>
            </div>
          )
        },
      },
      {
        key: 'ordersCount',
        title: 'Số đơn',
        width: 90,
        align: 'right',
        sortable: true,
        render: (r) => r.ordersCount.toLocaleString('vi-VN'),
      },
      {
        key: 'revenue',
        title: 'Doanh thu',
        width: 150,
        align: 'right',
        sortable: true,
        render: (r) => (
          <div className="dash-rev-cell">
            <div className="dash-rev-main">{formatVnd(r.revenue)}</div>
            <div className="dash-rev-sub">
              <div className="dash-progress">
                <div className="dash-progress-bar" style={{ width: `${Math.min(100, Math.max(0, r.revenuePercent))}%` }} />
              </div>
              <span className="dash-rev-pct">{r.revenuePercent.toFixed(1)}%</span>
            </div>
          </div>
        ),
      },
      {
        key: 'avgOrderValue',
        title: 'TB/đơn',
        width: 150,
        align: 'right',
        sortable: true,
        render: (r) => formatVnd(r.avgOrderValue),
      },
      {
        key: 'revenuePercent',
        title: '% tổng',
        width: 90,
        align: 'right',
        sortable: true,
        render: (r) => `${r.revenuePercent.toFixed(1)}%`,
      },
    ]
  }, [staffRevenueRankByRevenue])

  const topProfitSkus = useMemo(() => {
      const map = new Map<string, number>()
      const skus = new Map((state.skus || []).map(s => [s.id, s]))
      const products = new Map((state.products || []).map((p: any) => [p.id, p.name]))
      
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
          .sort((a: any, b: any) => b.value - a.value)
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
    <div className="page dashboard-page">
      <PageHeader
        title={
          viewMode === 'overview'
            ? 'Tổng quan'
            : viewMode === 'finance'
              ? 'Tài chính'
              : viewMode === 'warehouse'
                ? 'Kho'
                : viewMode === 'operation'
                  ? 'Vận hành'
                  : 'BI'
        }
        subtitle={
          viewMode === 'finance'
            ? 'Tổng quan dòng tiền, lợi nhuận và hiệu suất theo kho/kênh'
            : format(new Date(), 'EEEE, dd/MM/yyyy')
        }
        actions={
          <div className="dash-header-actions">
            <button className="btn btn-small" onClick={reloadApi} title="Làm mới">
              <RefreshCw size={16} />
              Làm mới
            </button>
            <button className="btn btn-small" onClick={() => navigate('/orders')} title="Tạo đơn">
              <Plus size={16} />
              Tạo đơn
            </button>
            <button className="btn btn-small" onClick={() => navigate('/stock-vouchers')} title="Nhập kho">
              <Plus size={16} />
              Nhập kho
            </button>
            {viewMode === 'finance' ? (
              <>
                <button className="btn btn-small" onClick={() => navigate('/channel-reconciliation')} title="Đối soát">
                  <CheckSquare size={16} />
                  Đối soát
                </button>
                <button className="btn btn-small" onClick={() => navigate('/finance/cashflow')} title="Ghi nhận chi phí">
                  <Receipt size={16} />
                  Ghi nhận chi phí
                </button>
              </>
            ) : null}
            <button className="btn btn-outline btn-small" onClick={handleExport}>
              <Download size={16} />
              Xuất báo cáo
            </button>
          </div>
        }
      />

      <div className="card dash-filterbar card--nohover">
        <FilterBar
          left={
            <>
              <div className="dash-filter-item">
                <div className="dash-filter-label">Kho</div>
                <select
                  value={draftFilter.warehouseId}
                  onChange={(e) => setDraftFilter({ ...draftFilter, warehouseId: e.target.value })}
                  className="input-compact"
                >
                  <option value="all">Tất cả kho</option>
                  {(state.locations || []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dash-filter-item">
                <div className="dash-filter-label">Kênh bán</div>
                <select
                  value={draftFilter.channel}
                  onChange={(e) => setDraftFilter({ ...draftFilter, channel: e.target.value })}
                  className="input-compact"
                >
                  <option value="all">Tất cả kênh</option>
                  <option value="pos">POS</option>
                  <option value="web">Website</option>
                  <option value="shopee">Shopee</option>
                  <option value="lazada">Lazada</option>
                  <option value="tiktok">TikTok</option>
                  <option value="wholesale">Bán buôn</option>
                </select>
              </div>

              <div className="dash-filter-item dash-filter-date">
                <div className="dash-filter-label">Khoảng thời gian</div>
                <div className="date-range">
                  <Calendar size={16} />
                  <input
                    type="date"
                    value={format(draftFilter.start, 'yyyy-MM-dd')}
                    onChange={(e) => setDraftFilter({ ...draftFilter, start: new Date(e.target.value) })}
                  />
                  <span className="date-range-sep">-</span>
                  <input
                    type="date"
                    value={format(draftFilter.end, 'yyyy-MM-dd')}
                    onChange={(e) => setDraftFilter({ ...draftFilter, end: new Date(e.target.value) })}
                  />
                </div>
              </div>
            </>
          }
          right={
            <>
              <button
                className="btn btn-primary btn-small"
                onClick={() => {
                  setFilter(draftFilter)
                }}
              >
                Áp dụng
              </button>
              <button
                className="btn btn-small"
                onClick={() => {
                  setFilter(defaultFilter)
                  setDraftFilter(defaultFilter)
                }}
              >
                Đặt lại
              </button>
            </>
          }
        />

        <div className="dash-filter-chips">
          <div className="dash-chip">
            {draftFilter.warehouseId === 'all'
              ? 'Tất cả kho'
              : state.locations.find((l) => l.id === draftFilter.warehouseId)?.name ?? 'Kho'}
          </div>
          <div className="dash-chip">{draftFilter.channel === 'all' ? 'Tất cả kênh' : `Kênh: ${draftFilter.channel}`}</div>
          <div className="dash-chip">{format(draftFilter.start, 'dd/MM/yyyy')} - {format(draftFilter.end, 'dd/MM/yyyy')}</div>
          <div className="dash-chip dash-chip-muted">Cập nhật: {format(new Date(), 'HH:mm')}</div>
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => setViewMode('overview')}>
            <LayoutDashboard size={16} />
            Tổng quan
          </button>
          <button className={`dash-tab ${viewMode === 'finance' ? 'active' : ''}`} onClick={() => setViewMode('finance')}>
            <DollarSign size={16} />
            Tài chính
          </button>
          <button className={`dash-tab ${viewMode === 'warehouse' ? 'active' : ''}`} onClick={() => setViewMode('warehouse')}>
            <Boxes size={16} />
            Kho
          </button>
          <button className={`dash-tab ${viewMode === 'operation' ? 'active' : ''}`} onClick={() => setViewMode('operation')}>
            <Activity size={16} />
            Vận hành
          </button>
          <button className={`dash-tab ${viewMode === 'analysis' ? 'active' : ''}`} onClick={() => setViewMode('analysis')}>
            <BarChart3 size={16} />
            BI
          </button>
        </div>

        <div className="dash-channel-tabs">
          {([
            { key: 'all', label: 'Tất cả kênh' },
            { key: 'pos', label: 'POS' },
            { key: 'web', label: 'Website' },
            { key: 'shopee', label: 'Shopee' },
            { key: 'lazada', label: 'Lazada' },
            { key: 'tiktok', label: 'TikTok' },
            { key: 'wholesale', label: 'Bán buôn' },
          ] as const).map((t) => (
            <button
              key={t.key}
              className={`dash-chip-tab ${draftFilter.channel === t.key ? 'active' : ''}`}
              onClick={() => setDraftFilter({ ...draftFilter, channel: t.key })}
            >
              {t.key === 'all'
                ? `${t.label} (${metrics.currentOrders.length.toLocaleString('vi-VN')})`
                : `${t.label} (${(channelOrderCounts.get(t.key) ?? 0).toLocaleString('vi-VN')})`}
            </button>
          ))}
        </div>
      </div>
      
      {viewMode === 'overview' && (
      <>
      {/* 1. KPI Cards (5 cols) - Powered by API */}
      <div className="kpi-grid">
        <SmartMetricCard 
            label="Doanh thu" 
            value={apiKpi ? formatVnd(apiKpi.revenue) : '—'} 
            trend={revenueTrend?.trend}
            trendValue={revenueTrend?.trendValue}
            status="neutral"
            accent="#2563EB"
            icon={<ShoppingCart size={18} />}
            meta="So với kỳ trước"
            isLoading={apiLoading}
            data={apiHistory.map(h => ({ value: h.revenue }))}
            onClick={() => navigate('/analytics/sales')}
        />
        <SmartMetricCard 
            label="Lợi nhuận" 
            value={apiKpi ? formatVnd(apiKpi.netProfit) : '—'} 
            data={apiHistory.map(h => ({ value: h.profit }))}
            trend={profitTrend?.trend}
            trendValue={profitTrend?.trendValue}
            status={(apiKpi?.netProfit || 0) > 0 ? 'success' : 'danger'}
            accent="#16A34A"
            icon={<TrendingUp size={18} />}
            meta="So với kỳ trước"
            isLoading={apiLoading}
            onClick={() => navigate('/analytics/sales')}
        />
        <SmartMetricCard 
            label="Dòng tiền" 
            value={apiKpi ? formatVnd(apiKpi.cashFlow) : '—'} 
            status={(apiKpi?.cashFlow || 0) > 0 ? 'success' : 'danger'}
            accent="#7C3AED"
            icon={<Wallet size={18} />}
            meta="Trong kỳ"
            isLoading={apiLoading}
            onClick={() => navigate('/finance/overview')}
        />
        <SmartMetricCard 
            label="Giá trị tồn kho" 
            value={apiKpi ? formatVnd(apiKpi.inventoryValue) : '—'} 
            status="warning"
            accent="#F59E0B"
            icon={<Boxes size={18} />}
            meta="Giá trị ước tính"
            isLoading={apiLoading}
            onClick={() => navigate('/inventory')}
        />
        <SmartMetricCard 
            label="Đơn chờ xử lý" 
            value={`${metrics.pendingOrdersCount}`} 
            status={metrics.pendingOrdersCount > 10 ? 'warning' : 'success'}
            accent={metrics.pendingOrdersCount > 10 ? '#F59E0B' : '#16A34A'}
            icon={<Package size={18} />}
            meta="Cần xử lý"
            onClick={() => navigate('/orders?status=confirmed')}
        />
        <SmartMetricCard 
            label="Tỷ lệ Xử lý đơn" 
            value={apiKpi ? `${apiKpi.fulfillmentRate}%` : '—'} 
            status="success"
            accent="#16A34A"
            icon={<Percent size={18} />}
            meta="Trong kỳ"
            isLoading={apiLoading}
            onClick={() => navigate('/order-monitoring')}
        />
      </div>

      {/* 2. Revenue Trend (Full Width) */}
      <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Xu hướng doanh thu (12 tháng)</div>
          <div style={{ height: 320 }}>
              {apiHistory.length > 0 && apiHistory.some((h) => Number(h.revenue) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={apiHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                <DashboardEmpty
                  title={apiLoading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu doanh thu'}
                  hint="Tạo đơn hàng hoặc chọn khoảng thời gian khác để xem xu hướng."
                  actionLabel="Tạo đơn"
                  onAction={() => navigate('/orders')}
                />
              )}
          </div>
      </div>

      {/* 3. Deep Dive (4 Columns) */}
      <div className="dash-widgets-4">
           {/* Channel Sales */}
           <div className="card">
              <div className="card-title">Kênh bán hàng</div>
              <div style={{ height: 250 }}>
                  {(apiChannels.length ? apiChannels : revenueByChannel).some((d: any) => Number(d.value) > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                              data={apiChannels.length ? apiChannels : revenueByChannel}
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={86}
                              paddingAngle={5}
                              dataKey="value"
                              nameKey="channel"
                            >
                              {(apiChannels.length ? apiChannels : revenueByChannel).map((_entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#2563EB', '#16A34A', '#F59E0B', '#7C3AED', '#0EA5E9', '#EF4444'][index % 6]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title={apiLoading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu kênh'} hint="Kênh sẽ hiển thị khi có đơn hàng." />
                  )}
              </div>
           </div>

           {/* Top Products */}
           <div className="card">
              <div className="card-title">Top Sản phẩm</div>
              <div style={{ height: 250 }}>
                  {(apiTopProducts.length ? apiTopProducts : topSkus).some((d: any) => Number(d.value) > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={apiTopProducts.length ? apiTopProducts : topSkus} margin={{ left: 0, right: 10 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'transparent' }} formatter={(v: any) => formatVnd(Number(v) || 0)} />
                            <Bar dataKey="value" fill="#2563EB" radius={[0, 6, 6, 0]} barSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title="Chưa có top sản phẩm" hint="Doanh thu theo SKU sẽ xuất hiện khi có đơn." />
                  )}
              </div>
           </div>

           {/* Warehouse Profit */}
           <div className="card">
              <div className="card-title">Lợi nhuận Kho</div>
              <div style={{ height: 250 }}>
                  {profitByWarehouse.some((d) => Math.abs(Number(d.profit) || 0) > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitByWarehouse} margin={{ left: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                            <Bar dataKey="profit" fill="#16A34A" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title="Chưa có dữ liệu lợi nhuận" hint="Hệ thống tính theo giá bán - giá vốn SKU." />
                  )}
              </div>
           </div>

           {/* Inventory Health (Treemap) */}
           <div className="card">
              <div className="card-title">Phân bổ tồn kho</div>
              <div style={{ height: 250 }}>
                  {inventoryByCategory.some((d: any) => Number(d.size) > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap data={inventoryByCategory} dataKey="size" aspectRatio={1} stroke="#fff" fill="#7C3AED">
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                        </Treemap>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title="Chưa có dữ liệu tồn" hint="Nhập kho hoặc chọn kho cụ thể để xem phân bổ." actionLabel="Tồn kho" onAction={() => navigate('/inventory')} />
                  )}
              </div>
           </div>
      </div>

      {/* 4. Customer & Sales Leaderboard */}
      <div className="dash-widgets-2">
           <div className="card">
              <div className="card-title">
                <span>Phân khúc khách hàng</span>
                <button className="btn btn-small" onClick={() => navigate('/customers')}>Xem</button>
              </div>
              <div style={{ height: 300 }}>
                  {customerSegments.some((s: any) => Number(s.value) > 0 && s.name !== 'Chưa có dữ liệu') ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                              data={customerSegments}
                              cx="50%"
                              cy="50%"
                              innerRadius={64}
                              outerRadius={104}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {customerSegments.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color || '#2563EB'} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title="Chưa có dữ liệu phân khúc" hint="Phân khúc sẽ hiển thị khi có lịch sử mua hàng." actionLabel="Khách hàng" onAction={() => navigate('/customers')} />
                  )}
              </div>
           </div>
           
           <div className="card">
              <div className="card-title">
                <span>Top Nhân viên kinh doanh</span>
                <button className="btn btn-small" onClick={() => navigate('/staff')}>Nhân sự</button>
              </div>
              <div style={{ height: 300 }}>
                  {salesLeaderboard.some((s: any) => Number(s.value) > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={salesLeaderboard} margin={{ left: 40 }}>
                            <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                            <Bar dataKey="value" fill="#2563EB" barSize={20} radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <DashboardEmpty title="Chưa có dữ liệu theo nhân viên" hint="Doanh thu theo nhân viên lấy từ đơn hàng đã tạo." actionLabel="Tạo đơn" onAction={() => navigate('/orders')} />
                  )}
              </div>
           </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="dash-table-head">
          <div>
            <div className="dash-section-title">Checklist doanh thu nhân viên</div>
            <div className="dash-section-sub">Tổng {staffRevenueFilteredSorted.length.toLocaleString('vi-VN')} nhân viên trong kỳ</div>
          </div>
          <div className="dash-search">
            <Search size={16} className="dash-search-icon" />
            <input
              placeholder="Tìm theo tên nhân viên..."
              value={staffRevenueQuery}
              onChange={(e) => {
                setStaffRevenueQuery(e.target.value)
                setStaffRevenuePage(1)
              }}
            />
          </div>
        </div>
        <div style={{ padding: 20, height: 460 }}>
          <SmartTable
            columns={staffRevenueColumns}
            data={staffRevenuePageData}
            keyField="id"
            sort={staffRevenueSort}
            onSort={setStaffRevenueSort}
            pagination={{
              page: staffRevenuePage,
              pageSize: staffRevenuePageSize,
              total: staffRevenueFilteredSorted.length,
              onChangePage: setStaffRevenuePage,
              onChangePageSize: (size) => {
                setStaffRevenuePageSize(size)
                setStaffRevenuePage(1)
              },
            }}
            emptyText="Không có dữ liệu doanh thu theo nhân viên"
          />
        </div>
      </div>

      {/* 5. Alerts Row */}
      <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Cảnh báo & Việc cần làm</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, padding: '0 20px 20px' }}>
              <AlertItem 
                label="Dự báo thiếu hàng (AI)" 
                value="Xem chi tiết" 
                type="danger" 
                onClick={() => navigate('/replenishment')}
              />
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
           <div className="finance-section">
             <div className="finance-section-head">
               <div>
                 <div className="finance-section-title">Dòng tiền</div>
                 <div className="finance-section-sub">Thu/chi, dòng tiền ròng và công nợ trong kỳ</div>
               </div>
               <div className="finance-section-actions">
                 <div className="dash-chip dash-chip-muted">Last updated {format(new Date(), 'HH:mm')}</div>
               </div>
             </div>

             <div className="finance-kpi-grid">
               <SmartMetricCard
                 label="Thu (Income)"
                 value={formatVnd(metrics.income)}
                 trend={incomeTrend?.trend}
                 trendValue={incomeTrend?.trendValue}
                 status="success"
                 accent="#16A34A"
                 icon={<ArrowDownLeft size={18} />}
                 meta="So với kỳ trước"
                 data={metrics.cashflowHistory.map((h: any) => ({ value: Number(h.income) || 0 }))}
                 onClick={() => navigate('/finance/cashflow')}
               />
               <SmartMetricCard
                 label="Chi (Expense)"
                 value={formatVnd(metrics.expense)}
                 trend={expenseTrend?.trend}
                 trendValue={expenseTrend?.trendValue}
                 status="danger"
                 accent="#DC2626"
                 icon={<ArrowUpRight size={18} />}
                 meta="So với kỳ trước"
                 data={metrics.cashflowHistory.map((h: any) => ({ value: Number(h.expense) || 0 }))}
                 onClick={() => navigate('/finance/cashflow')}
               />
               <SmartMetricCard
                 label="Dòng tiền ròng"
                 value={formatVnd(metrics.cashflow)}
                 trend={cashflowTrend?.trend}
                 trendValue={cashflowTrend?.trendValue}
                 status={metrics.cashflow > 0 ? 'success' : 'warning'}
                 accent="#7C3AED"
                 icon={<Wallet size={18} />}
                 meta="So với kỳ trước"
                 data={metrics.cashflowHistory.map((h: any) => ({ value: Number(h.cashflow) || 0 }))}
                 onClick={() => navigate('/finance/overview')}
               />
               <SmartMetricCard
                 label="Công nợ phải thu"
                 value={formatVnd(metrics.receivables)}
                 trend={metrics.receivableDueSoonCount > 0 ? 'up' : metrics.receivableOverdueCount > 0 ? 'down' : 'neutral'}
                 trendValue={
                   metrics.receivableDueSoonCount > 0
                     ? `${metrics.receivableDueSoonCount} đến hạn`
                     : metrics.receivableOverdueCount > 0
                       ? `${metrics.receivableOverdueCount} quá hạn`
                       : 'ổn định'
                 }
                 status={metrics.receivableOverdueCount > 0 ? 'danger' : metrics.receivableDueSoonCount > 0 ? 'warning' : 'neutral'}
                 accent="#F59E0B"
                 icon={<HandCoins size={18} />}
                 meta="Theo công nợ mở"
                 subtitle={
                   metrics.receivableOverdueCount > 0
                     ? `Có ${metrics.receivableOverdueCount} khoản quá hạn`
                     : metrics.receivableDueSoonCount > 0
                       ? `Có ${metrics.receivableDueSoonCount} khoản đến hạn 7 ngày`
                       : 'Không có khoản đến hạn'
                 }
                 onClick={() => navigate('/finance/debts')}
               />
             </div>
           </div>

           <div className="finance-section">
             <div className="finance-section-head">
               <div>
                 <div className="finance-section-title">Kết quả kinh doanh</div>
                 <div className="finance-section-sub">Doanh thu, giá vốn, lợi nhuận và biên lợi nhuận</div>
               </div>
               <div className="finance-section-actions">
                 <button className="btn btn-small" onClick={() => navigate('/analytics/sales')}>Báo cáo</button>
               </div>
             </div>

             <div className="finance-kpi-grid">
               <SmartMetricCard
                 label="Doanh thu thuần"
                 value={formatVnd(metrics.revenue)}
                 trend={revenueTrend?.trend}
                 trendValue={revenueTrend?.trendValue}
                 status="neutral"
                 accent="#2563EB"
                 icon={<ShoppingCart size={18} />}
                 meta="So với kỳ trước"
                 data={metrics.history.map((h: any) => ({ value: Number(h.revenue) || 0 }))}
                 onClick={() => navigate('/analytics/sales')}
               />
               <SmartMetricCard
                 label="Giá vốn"
                 value={formatVnd(metrics.cost)}
                 status="warning"
                 accent="#F59E0B"
                 icon={<Receipt size={18} />}
                 meta="Trong kỳ"
                 onClick={() => navigate('/analytics/sales')}
               />
               <SmartMetricCard
                 label="Lợi nhuận gộp"
                 value={formatVnd(metrics.profit)}
                 trend={profitTrend?.trend}
                 trendValue={profitTrend?.trendValue}
                 status={metrics.profit >= 0 ? 'success' : 'danger'}
                 accent="#16A34A"
                 icon={<TrendingUp size={18} />}
                 meta="So với kỳ trước"
                 data={metrics.history.map((h: any) => ({ value: Number(h.profit) || 0 }))}
                 onClick={() => navigate('/analytics/sales')}
               />
               <SmartMetricCard
                 label="Biên lợi nhuận"
                 value={`${margin.toFixed(1)}%`}
                 trend={marginTrend?.trend}
                 trendValue={marginTrend?.trendValue}
                 status={margin >= 25 ? 'success' : margin >= 10 ? 'warning' : 'danger'}
                 accent="#0EA5E9"
                 icon={<BadgePercent size={18} />}
                 meta="So với kỳ trước"
                 onClick={() => navigate('/analytics/sales')}
               />
             </div>
           </div>

           <div className="finance-charts">
             <div className="card">
               <div className="card-title">
                 <span>Lợi nhuận theo kho</span>
                 {bestWarehouseByProfit ? (
                   <span className="badge badge-neutral">
                     Top: {bestWarehouseByProfit.bestName} ({formatVnd(bestWarehouseByProfit.bestProfit)})
                   </span>
                 ) : null}
               </div>
               {profitByWarehouse.some((d) => Math.abs(Number(d.profit) || 0) > 0) ? (
                 <>
                   {bestWarehouseByProfit ? (
                     <div className="finance-chart-sub">
                       Biên thấp nhất: {bestWarehouseByProfit.worstMarginName} ({bestWarehouseByProfit.worstMargin.toFixed(1)}%)
                     </div>
                   ) : null}
                   <div style={{ height: 360 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={profitByWarehouse.slice(0, 5)} layout="vertical" margin={{ left: 24, right: 16 }}>
                         <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                         <XAxis type="number" tickFormatter={(val) => formatAxisMoney(Number(val))} axisLine={false} tickLine={false} />
                         <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                         <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                         <Legend />
                         <Bar dataKey="revenue" name="Doanh thu" fill="#2563EB" barSize={18} radius={[0, 6, 6, 0]} />
                         <Bar dataKey="profit" name="Lợi nhuận gộp" fill="#16A34A" barSize={18} radius={[0, 6, 6, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </>
               ) : (
                 <div style={{ height: 360 }}>
                   <DashboardEmpty title="Chưa có dữ liệu theo kho" hint="Cần đơn hàng và giá vốn SKU để tính lợi nhuận." actionLabel="Tạo đơn" onAction={() => navigate('/orders')} />
                 </div>
               )}
             </div>

             <div className="card">
               <div className="card-title">
                 <span>Doanh thu theo kênh bán</span>
                 <button className="btn btn-small" onClick={() => navigate('/channel-reconciliation')}>Đối soát</button>
               </div>
               {revenueByChannel.some((d: any) => Number(d.value) > 0) ? (
                 <div className="finance-channel-split">
                   <div style={{ height: 320 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie
                           data={revenueByChannel}
                           cx="50%"
                           cy="50%"
                           innerRadius={70}
                           outerRadius={110}
                           paddingAngle={4}
                           dataKey="value"
                           nameKey="name"
                         >
                           {revenueByChannel.map((_entry: any, index: number) => (
                             <Cell key={`cell-${index}`} fill={['#2563EB', '#16A34A', '#F59E0B', '#7C3AED', '#0EA5E9', '#EF4444'][index % 6]} />
                           ))}
                         </Pie>
                         <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>

                   <div className="finance-mini-list">
                     {revenueByChannel
                       .slice(0, 7)
                       .map((c: any) => (
                         <button
                           key={c.name}
                           type="button"
                           className="finance-mini-row"
                           onClick={() => {
                             const k = c.name === 'POS (Cửa hàng)' ? 'pos' : c.name === 'Website' ? 'web' : c.name === 'Shopee' ? 'shopee' : c.name === 'Lazada' ? 'lazada' : c.name === 'TikTok' ? 'tiktok' : 'all'
                             setDraftFilter({ ...draftFilter, channel: k })
                           }}
                         >
                           <div className="finance-mini-left">
                             <span className="finance-mini-name">{c.name}</span>
                             <span className="finance-mini-sub">{c.percent?.toFixed ? `${c.percent.toFixed(1)}%` : ''}</span>
                           </div>
                           <div className="finance-mini-right">{formatVnd(Number(c.value) || 0)}</div>
                         </button>
                       ))}
                     <button className="btn btn-small" onClick={() => navigate('/analytics/sales')}>Xem chi tiết</button>
                   </div>
                 </div>
               ) : (
                 <div style={{ height: 360 }}>
                   <DashboardEmpty title="Chưa có dữ liệu kênh" hint="Kênh sẽ hiển thị khi có đơn hàng." />
                 </div>
               )}
             </div>
           </div>

           <div className="finance-extras">
             <div className="card">
               <div className="card-title">
                 <span>Chi phí theo nhóm</span>
                 <span className="badge badge-neutral">{formatVnd(metrics.expense)}</span>
               </div>
               {expenseByCategory.some((x) => Number(x.value) > 0) ? (
                 <div className="finance-channel-split">
                   <div style={{ height: 260 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie
                           data={expenseByCategory}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={100}
                           paddingAngle={4}
                           dataKey="value"
                           nameKey="name"
                         >
                           {expenseByCategory.map((_entry: any, index: number) => (
                             <Cell key={`cell-${index}`} fill={['#DC2626', '#F59E0B', '#7C3AED', '#2563EB', '#16A34A', '#0EA5E9'][index % 6]} />
                           ))}
                         </Pie>
                         <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                   <div className="finance-mini-list">
                     {expenseByCategory.map((x) => (
                       <div key={x.name} className="finance-mini-row" style={{ cursor: 'default' }}>
                         <div className="finance-mini-left">
                           <span className="finance-mini-name">{x.name}</span>
                           <span className="finance-mini-sub">{x.percent.toFixed(1)}%</span>
                         </div>
                         <div className="finance-mini-right">{formatVnd(x.value)}</div>
                       </div>
                     ))}
                   </div>
                 </div>
               ) : (
                 <div style={{ height: 260 }}>
                   <DashboardEmpty title="Chưa có dữ liệu chi phí" hint="Ghi nhận chi phí trong Dòng tiền để xem breakdown." actionLabel="Ghi chi phí" onAction={() => navigate('/finance/cashflow')} />
                 </div>
               )}
             </div>

             <div className="card">
               <div className="card-title">
                 <span>Aging công nợ</span>
                 <button className="btn btn-small" onClick={() => navigate('/finance/debts')}>Công nợ</button>
               </div>
               {receivableAging.total > 0 ? (
                 <div className="finance-aging">
                   {receivableAging.list.map((b: any) => {
                     const pct = receivableAging.total ? (b.value / receivableAging.total) * 100 : 0
                     return (
                       <div key={b.label} className="finance-aging-row">
                         <div className="finance-aging-left">
                           <div className="finance-aging-label">{b.label}</div>
                           <div className="finance-aging-bar">
                             <div className="finance-aging-barfill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                           </div>
                         </div>
                         <div className="finance-aging-right">
                           <div className="finance-aging-amt">{formatVnd(b.value)}</div>
                           <div className="finance-aging-pct">{pct.toFixed(1)}%</div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ) : (
                 <div style={{ height: 260 }}>
                   <DashboardEmpty title="Chưa có công nợ phải thu" hint="Aging sẽ hiển thị khi có công nợ mở." actionLabel="Công nợ" onAction={() => navigate('/finance/debts')} />
                 </div>
               )}
             </div>

             <div className="card">
               <div className="card-title">
                 <span>Xu hướng lợi nhuận</span>
                 <span className="badge badge-neutral">Trong kỳ</span>
               </div>
               {metrics.history.some((h: any) => Number(h.profit) !== 0) ? (
                 <div style={{ height: 260 }}>
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={metrics.history} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                       <defs>
                         <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#16A34A" stopOpacity={0.12} />
                           <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                       <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(val) => formatAxisMoney(Number(val))} />
                       <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} contentStyle={{ borderRadius: 10 }} />
                       <Area type="monotone" dataKey="profit" stroke="#16A34A" strokeWidth={3} fill="url(#colorProfit)" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div style={{ height: 260 }}>
                   <DashboardEmpty title="Chưa có dữ liệu lợi nhuận" hint="Tạo đơn hàng và cập nhật giá vốn SKU để xem xu hướng." actionLabel="Tạo đơn" onAction={() => navigate('/orders')} />
                 </div>
               )}
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
                    value={`${operationScore}/100`} 
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

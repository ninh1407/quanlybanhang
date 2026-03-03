import { useMemo } from 'react'
import { Sku, StockTransaction } from '../domain/types'
import { differenceInDays, parseISO } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { formatVnd } from '../lib/money'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

function skuLabel(productsById: Map<string, string>, sku: Sku): string {
  const productName = productsById.get(sku.productId) ?? sku.productId
  const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
  return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
}

function averageCostFromSortedTxs(txs: StockTransaction[]): number {
  let qty = 0
  let avg = 0
  txs.forEach((t) => {
    const q = Number(t.qty) || 0
    if (!q) return
    if (t.type === 'in') {
      const unitCost = t.unitCost == null ? 0 : Number(t.unitCost) || 0
      const nextQty = qty + q
      if (nextQty <= 0) {
        qty = 0
        avg = 0
        return
      }
      avg = (avg * qty + unitCost * q) / nextQty
      qty = nextQty
      return
    }
    if (t.type === 'out') {
      qty = Math.max(0, qty - q)
      if (qty === 0) avg = 0
      return
    }
    const diff = q
    if (diff > 0) {
      qty = qty + diff
      return
    }
    qty = Math.max(0, qty + diff)
    if (qty === 0) avg = 0
  })
  return Number.isFinite(avg) ? avg : 0
}

export function InventoryRiskAnalysisPage() {
  const state = useAppState()
  const productsById = useMemo(() => new Map((state.products || []).map((p) => [p.id, p.name])), [state.products])

  // 1. Calculate Stock & Average Cost per SKU
  const skuStats = useMemo(() => {
    const groupedTxs = new Map<string, StockTransaction[]>()
    ;(state.stockTransactions || []).forEach((t) => {
      const arr = groupedTxs.get(t.skuId)
      if (arr) arr.push(t)
      else groupedTxs.set(t.skuId, [t])
    })
    groupedTxs.forEach((arr) => arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

    const stats = new Map<string, { stock: number; avgCost: number; lastSaleDate: string | null }>()
    
    ;(state.skus || []).forEach((s) => {
      const txs = groupedTxs.get(s.id) ?? []
      const avgCost = averageCostFromSortedTxs(txs)
      
      let stock = 0
      let lastSaleDate: string | null = null
      
      txs.forEach(t => {
          if (t.type === 'in') stock += t.qty
          else if (t.type === 'out') {
              stock -= t.qty
              // Assuming 'out' linked to order is a sale. 
              // We can check refType === 'order' or just assume any out is activity
              if (t.refType === 'order') {
                  if (!lastSaleDate || t.createdAt > lastSaleDate) {
                      lastSaleDate = t.createdAt
                  }
              }
          } else {
              stock += t.qty
          }
      })
      
      stats.set(s.id, { stock: Math.max(0, stock), avgCost, lastSaleDate })
    })
    return stats
  }, [state.stockTransactions, state.skus])

  // 2. Dead Stock Analysis
  const deadStockData = useMemo(() => {
    const now = new Date()
    const groups = {
      '30-60': { label: '30-60 ngày', count: 0, value: 0, skus: [] as any[] },
      '60-90': { label: '60-90 ngày', count: 0, value: 0, skus: [] as any[] },
      '>90': { label: '> 90 ngày', count: 0, value: 0, skus: [] as any[] },
    }

    ;(state.skus || []).forEach((s) => {
      const stat = skuStats.get(s.id)
      if (!stat || stat.stock <= 0) return

      const lastSale = stat.lastSaleDate ? parseISO(stat.lastSaleDate) : parseISO(s.createdAt) // If no sale, use created date
      const days = differenceInDays(now, lastSale)
      const value = stat.stock * stat.avgCost

      if (days > 90) {
        groups['>90'].count++
        groups['>90'].value += value
        groups['>90'].skus.push({ sku: s, days, value, stock: stat.stock })
      } else if (days > 60) {
        groups['60-90'].count++
        groups['60-90'].value += value
        groups['60-90'].skus.push({ sku: s, days, value, stock: stat.stock })
      } else if (days > 30) {
        groups['30-60'].count++
        groups['30-60'].value += value
        groups['30-60'].skus.push({ sku: s, days, value, stock: stat.stock })
      }
    })

    return [groups['30-60'], groups['60-90'], groups['>90']]
  }, [skuStats, state.skus])

  // 3. Shrinkage Analysis (Loss)
  const shrinkageData = useMemo(() => {
    const skuLoss = new Map<string, { qty: number; value: number }>()

    ;(state.stockTransactions || []).forEach(t => {
        // Adjustments with negative qty are considered shrinkage/loss
        if (t.type === 'adjust' && t.qty < 0) {
            const stat = skuStats.get(t.skuId)
            const cost = stat?.avgCost ?? 0
            const value = Math.abs(t.qty) * cost
            
            const current = skuLoss.get(t.skuId) ?? { qty: 0, value: 0 }
            skuLoss.set(t.skuId, {
                qty: current.qty + Math.abs(t.qty),
                value: current.value + value
            })
        }
    })

    const sorted = Array.from(skuLoss.entries())
        .map(([skuId, val]) => ({ skuId, ...val }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Top 10

    return sorted.map(item => {
        const sku = (state.skus || []).find(s => s.id === item.skuId)
        return {
            name: sku ? skuLabel(productsById, sku) : item.skuId,
            value: item.value,
            qty: item.qty
        }
    })
  }, [state.stockTransactions, skuStats, state.skus, productsById])

  // 4. Overstock Analysis
  const overstockData = useMemo(() => {
      const result: any[] = []
      ;(state.skus || []).forEach(s => {
          const stat = skuStats.get(s.id)
          if (!stat || stat.stock <= 0) return
          
          // Get max minStock across all locations or use default
          const minStock = Math.max(...(state.skuSettings || []).filter(x => x.skuId === s.id).map(x => x.minStock), 0)
          if (minStock > 0 && stat.stock > minStock * 2) {
              result.push({
                  sku: s,
                  stock: stat.stock,
                  minStock,
                  ratio: (stat.stock / minStock * 100).toFixed(0),
                  value: stat.stock * stat.avgCost
              })
          }
      })
      return result.sort((a, b) => b.value - a.value)
  }, [state.skus, skuStats, state.skuSettings])

  const totalDeadStockValue = deadStockData.reduce((acc, curr) => acc + curr.value, 0)
  const totalShrinkageValue = shrinkageData.reduce((acc, curr) => acc + curr.value, 0)
  const totalOverstockValue = overstockData.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="page">
      <PageHeader title="Phân tích rủi ro tồn kho (Inventory Risk Center)" />

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div className="card">
            <div className="card-title">Tổng giá trị tồn kho chết ({'>'}30 ngày)</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--danger)' }}>
                {formatVnd(totalDeadStockValue)}
            </div>
            <div className="stat-desc">Vốn bị chôn trong hàng không bán được</div>
        </div>
        <div className="card">
            <div className="card-title">Tổng giá trị thất thoát (Shrinkage)</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--warning)' }}>
                {formatVnd(totalShrinkageValue)}
            </div>
            <div className="stat-desc">Do điều chỉnh kho, mất mát, hư hỏng</div>
        </div>
        <div className="card">
            <div className="card-title">Tồn kho vượt mức (Overstock {'>'} 200%)</div>
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--info-600)' }}>
                {formatVnd(totalOverstockValue)}
            </div>
            <div className="stat-desc">Cần xem xét đẩy hàng / khuyến mãi</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
            <div className="card-title">Phân bổ tồn kho chết theo thời gian</div>
            <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deadStockData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(val) => (val / 1000000).toFixed(0) + 'M'} />
                        <Tooltip formatter={(val: number | undefined) => [formatVnd(val ?? 0), 'Giá trị']} />
                        <Legend />
                        <Bar dataKey="value" name="Giá trị tồn" fill="#8884d8">
                            {deadStockData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Top 10 Sản phẩm thất thoát cao nhất</div>
             <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={shrinkageData} margin={{ left: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(val) => (val / 1000000).toFixed(0) + 'M'} />
                        <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                        <Tooltip formatter={(val: number | undefined) => [formatVnd(val ?? 0), 'Giá trị mất']} />
                        <Bar dataKey="value" name="Giá trị mất" fill="#FF8042" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">Tồn kho vượt mức (Overstock {'>'} 200% min-stock)</div>
          <div className="table-wrap">
              <table className="table">
                  <thead>
                      <tr>
                          <th>SKU</th>
                          <th>Tồn hiện tại</th>
                          <th>Định mức Min</th>
                          <th>Tỷ lệ</th>
                          <th>Giá trị tồn dư</th>
                          <th>Gợi ý</th>
                      </tr>
                  </thead>
                  <tbody>
                      {overstockData.map((item, idx) => (
                          <tr key={idx}>
                              <td>{skuLabel(productsById, item.sku)}</td>
                              <td>{item.stock}</td>
                              <td>{item.minStock}</td>
                              <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{item.ratio}%</td>
                              <td>{formatVnd(item.value)}</td>
                              <td>
                                  <span className="badge" style={{ background: 'var(--warning-100)', color: 'var(--warning-700)' }}>
                                      Giảm giá / Flash Sale
                                  </span>
                              </td>
                          </tr>
                      ))}
                      {overstockData.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center' }}>Không có SKU nào vượt mức báo động</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">Chi tiết tồn kho chết ({'>'} 90 ngày)</div>
          <div className="table-wrap">
              <table className="table">
                  <thead>
                      <tr>
                          <th>SKU</th>
                          <th>Số ngày tồn</th>
                          <th>Số lượng</th>
                          <th>Giá trị</th>
                      </tr>
                  </thead>
                  <tbody>
                      {deadStockData[2].skus.sort((a, b) => b.days - a.days).map((item, idx) => (
                          <tr key={idx}>
                              <td>{skuLabel(productsById, item.sku)}</td>
                              <td>{item.days} ngày</td>
                              <td>{item.stock}</td>
                              <td>{formatVnd(item.value)}</td>
                          </tr>
                      ))}
                      {deadStockData[2].skus.length === 0 && (
                          <tr>
                              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                  Không có dữ liệu
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  )
}

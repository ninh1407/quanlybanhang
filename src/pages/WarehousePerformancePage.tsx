import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { formatVnd } from '../lib/money'
import { useAuth } from '../auth/auth'
import { parseISO, subMonths } from 'date-fns'

export function WarehousePerformancePage() {
  const state = useAppState()
  const { checkScope } = useAuth()
  const [period] = useState<30 | 90 | 180>(30)

  const accessibleLocations = useMemo(() => {
      return state.locations.filter(l => l.active && checkScope(l.id))
  }, [state.locations, checkScope])

  const stats = useMemo(() => {
      const now = new Date()
      const start = subMonths(now, period === 30 ? 1 : period === 90 ? 3 : 6)
      
      return accessibleLocations.map(loc => {
          // 1. Turnover
          // Turnover = COGS / Avg Inventory Value
          // Simplified: Sales Qty / Avg Stock Qty
          let salesQty = 0
          let cogs = 0
          // let avgStock = 0 // Need daily snapshot, approximating with current stock
          
          // 2. Fulfillment Rate
          // Orders Shipped / Orders Received
          let totalOrders = 0
          let shippedOrders = 0
          
          // 3. Picking Accuracy (Mocked or derived from returns?)
          // Let's use Return Rate: Returns / Sales
          let returnQty = 0
          
          // 4. Shrinkage
          let shrinkageValue = 0
          
          state.orders.forEach(o => {
              if (o.fulfillmentLocationId !== loc.id) return
              const created = parseISO(o.createdAt)
              if (created < start) return
              
              totalOrders++
              if (['shipped', 'delivered', 'completed'].includes(o.status)) shippedOrders++
              if (o.status === 'returned') returnQty++ // simplified logic
              
              if (o.status === 'paid' || o.status === 'delivered') {
                  o.items.forEach(i => {
                      salesQty += i.qty
                      const sku = state.skus.find(s => s.id === i.skuId)
                      if (sku) cogs += i.qty * sku.cost
                  })
              }
          })
          
          // Calculate Stock Value
          let stockValue = 0
          state.skus.forEach(s => {
              // Naive current stock calculation for this location
              // In real app, use snapshot or ledger
              let qty = 0
              state.stockTransactions.forEach(t => {
                  if (t.locationId !== loc.id || t.skuId !== s.id) return
                  if (t.type === 'in') qty += t.qty
                  else if (t.type === 'out') qty -= t.qty
                  else qty += t.qty
              })
              stockValue += Math.max(0, qty) * s.cost
          })
          
          // Shrinkage from Adjustments
          state.stockTransactions.forEach(t => {
              if (t.locationId !== loc.id || t.type !== 'adjust') return
              const created = parseISO(t.createdAt)
              if (created < start) return
              if (t.qty < 0) {
                  const sku = state.skus.find(s => s.id === t.skuId)
                  if (sku) shrinkageValue += Math.abs(t.qty) * sku.cost
              }
          })

          const turnover = stockValue > 0 ? (cogs / stockValue) : 0
          const fulfillmentRate = totalOrders > 0 ? (shippedOrders / totalOrders) * 100 : 100
          const returnRate = totalOrders > 0 ? (returnQty / totalOrders) * 100 : 0
          const shrinkageRate = stockValue > 0 ? (shrinkageValue / stockValue) * 100 : 0
          
          return {
              id: loc.id,
              name: loc.name,
              turnover: turnover.toFixed(2),
              fulfillmentRate: fulfillmentRate.toFixed(1),
              returnRate: returnRate.toFixed(1),
              shrinkageRate: shrinkageRate.toFixed(2),
              stockValue,
              cogs
          }
      }).sort((a, b) => b.stockValue - a.stockValue)
  }, [accessibleLocations, state.orders, state.stockTransactions, state.skus, period])

  return (
    <div className="page">
      <PageHeader title="Hiệu suất kho" />
      
      <div className="card">
          <div className="card-title">Hiệu suất vận hành (KPIs)</div>
          <div className="table-wrap">
              <table className="table">
                  <thead>
                      <tr>
                          <th>Kho</th>
                          <th>Inventory Turnover</th>
                          <th>Fulfillment Rate</th>
                          <th>Return Rate</th>
                          <th>Shrinkage Rate</th>
                          <th>Stock Value</th>
                      </tr>
                  </thead>
                  <tbody>
                      {stats.map(s => (
                          <tr key={s.id}>
                              <td style={{ fontWeight: 600 }}>{s.name}</td>
                              <td>{s.turnover}x</td>
                              <td style={{ color: Number(s.fulfillmentRate) < 90 ? 'var(--warning)' : 'inherit' }}>
                                  {s.fulfillmentRate}%
                              </td>
                              <td>{s.returnRate}%</td>
                              <td style={{ color: Number(s.shrinkageRate) > 1 ? 'var(--danger)' : 'inherit' }}>
                                  {s.shrinkageRate}%
                              </td>
                              <td>{formatVnd(s.stockValue)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          <div className="card">
              <div className="card-title">Fulfillment Rate Comparison</div>
              <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats} layout="vertical" margin={{ left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} />
                          <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                          <Tooltip />
                          <Bar dataKey="fulfillmentRate" name="Rate %" fill="#82ca9d" barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
          <div className="card">
              <div className="card-title">Inventory Turnover</div>
              <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{fontSize: 11}} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="turnover" name="Turnover" fill="#8884d8" />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../settings/useSettings'
import { useAppState } from '../state/Store'
import { formatVnd } from '../lib/money'
import { PageHeader } from '../ui-kit/PageHeader'
import { 
  MapPin, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  LayoutGrid,
  Activity,
  X
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Location, Sku, StockTransaction, Order, StockCount } from '../domain/types'

// Helper to calculate stock and value per location
function calculateLocationStats(
  locationId: string, 
  skus: Sku[], 
  txs: StockTransaction[],
  orders: Order[],
  stockCounts: StockCount[],
  settings: { lowStockThresholdPercent: number }
) {
  let totalQty = 0
  let totalValue = 0
  let revenue = 0
  let pendingOrders = 0
  let discrepancyAmount = 0
  
  // Calculate Revenue & Pending Orders
  ;(orders || []).forEach(o => {
      if (o.fulfillmentLocationId === locationId) {
          if (o.status === 'paid' || o.status === 'delivered') {
            const orderTotal = o.subTotalOverride ?? (o.items || []).reduce((s, i) => s + i.price * i.qty, 0)
            revenue += orderTotal - (Number(o.discountAmount) || 0)
          }
          if (['confirmed', 'paid', 'packed'].includes(o.status)) {
              pendingOrders++
          }
      }
  })

  // Calculate Inventory Discrepancy (Absolute value of compensation from recent checks)
  ;(stockCounts || []).forEach(sc => {
      if (sc.locationId === locationId && sc.status === 'final') {
          discrepancyAmount += Math.abs(sc.compensationAmount || 0)
      }
  })

  const stockBySku = new Map<string, number>()

  ;(txs || []).forEach(t => {
    if (t.locationId !== locationId) return
    const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
    stockBySku.set(t.skuId, (stockBySku.get(t.skuId) ?? 0) + delta)
  })

  let lowStockCount = 0
  let negativeStockCount = 0
  let activeSkuCount = 0

  const threshold = Number(settings?.lowStockThresholdPercent) || 10

  ;(skus || []).forEach(s => {
    if (!s.active) return
    activeSkuCount++
    const qty = stockBySku.get(s.id) ?? 0
    if (qty !== 0) {
        totalQty += qty
        totalValue += qty * s.cost
    }
    
    if (qty > 0 && qty < threshold) lowStockCount++
    if (qty < 0) negativeStockCount++
  })

  const shortagePercent = activeSkuCount > 0 ? (lowStockCount / activeSkuCount) * 100 : 0

  return { 
      totalQty, 
      totalValue, 
      revenue, 
      lowStockCount, 
      negativeStockCount, 
      stockBySku,
      pendingOrders,
      discrepancyAmount,
      shortagePercent,
      activeSkuCount
  }
}

function WarehouseCard({ 
  location, 
  stats, 
  rank,
  onClick 
}: { 
  location: Location
  stats: ReturnType<typeof calculateLocationStats>
  rank: number
  onClick: () => void
}) {
  const hasAlert = stats.lowStockCount > 0 || stats.negativeStockCount > 0 || stats.discrepancyAmount > 0
  const statusColor = stats.negativeStockCount > 0 ? 'var(--danger)' : stats.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)'

  return (
    <div 
      className="card" 
      onClick={onClick}
      style={{ 
        cursor: 'pointer', 
        borderLeft: `4px solid ${statusColor}`,
        transition: 'transform 0.2s',
        padding: 16,
        position: 'relative'
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ 
          position: 'absolute', 
          top: 12, 
          right: 12, 
          background: 'var(--bg-subtle)', 
          borderRadius: '50%', 
          width: 24, 
          height: 24, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-secondary)'
      }}>
          #{rank}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{location.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{location.code}</div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Giá trị kho</div>
           <div style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{formatVnd(stats.totalValue)}</div>
        </div>
        <div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Đơn chờ xử lý</div>
           <div style={{ fontWeight: 600, color: stats.pendingOrders > 5 ? 'var(--warning-600)' : 'var(--text-primary)' }}>
               {stats.pendingOrders}
           </div>
        </div>
        <div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>% Thiếu hàng</div>
           <div style={{ fontWeight: 600, color: stats.shortagePercent > 20 ? 'var(--danger)' : 'var(--text-primary)' }}>
               {stats.shortagePercent.toFixed(1)}%
           </div>
        </div>
        <div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chênh lệch KK</div>
           <div style={{ fontWeight: 600, color: stats.discrepancyAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
               {formatVnd(stats.discrepancyAmount)}
           </div>
        </div>
      </div>

      {hasAlert && (
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
          {stats.negativeStockCount > 0 && (
            <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> Kho âm ({stats.negativeStockCount})
            </span>
          )}
          {stats.lowStockCount > 0 && (
             <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
               <Package size={12} /> Thiếu ({stats.lowStockCount})
             </span>
          )}
        </div>
      )}
    </div>
  )
}

function WarehouseDetailModal({
    location,
    stats,
    onClose,
    skus,
    productsById,
    onViewInventory
}: {
    location: Location
    stats: ReturnType<typeof calculateLocationStats>
    onClose: () => void
    skus: Sku[]
    productsById: Map<string, string>
    onViewInventory: () => void
}) {
    // Find top low stock items
    const stockItems = skus.map(s => ({
        sku: s,
        qty: stats.stockBySku.get(s.id) ?? 0
    })).filter(x => x.qty < 10 && x.qty > -100) // Filter relevant items
    
    stockItems.sort((a, b) => a.qty - b.qty) // Lowest first

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="card" style={{ width: 600, maxHeight: '80vh', overflow: 'auto', padding: 0 }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Chi tiết kho: {location.name}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onViewInventory} className="btn btn-small btn-primary">Xem tồn kho</button>
                        <button onClick={onClose} className="btn btn-small" style={{ border: 'none' }}><X size={20} /></button>
                    </div>
                </div>
                <div style={{ padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tổng doanh thu</div>
                             <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{formatVnd(stats.revenue)}</div>
                         </div>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tổng giá trị</div>
                             <div style={{ fontSize: 18, fontWeight: 700 }}>{formatVnd(stats.totalValue)}</div>
                         </div>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đơn chờ xử lý</div>
                             <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.pendingOrders}</div>
                         </div>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>% Thiếu hàng</div>
                             <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning-700)' }}>{stats.shortagePercent.toFixed(1)}%</div>
                         </div>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chênh lệch kiểm kê</div>
                             <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{formatVnd(stats.discrepancyAmount)}</div>
                         </div>
                         <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                             <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>SKU / Tổng tồn</div>
                             <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.activeSkuCount} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/ {stats.totalQty}</span></div>
                         </div>
                    </div>

                    <h4>Cảnh báo tồn kho thấp / Âm</h4>
                    {stockItems.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Tên</th>
                                    <th>Tồn</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockItems.slice(0, 10).map(x => (
                                    <tr key={x.sku.id}>
                                        <td>{x.sku.skuCode}</td>
                                        <td>{productsById.get(x.sku.productId)}</td>
                                        <td style={{ color: x.qty < 0 ? 'var(--danger)' : x.qty < 5 ? 'var(--warning)' : 'inherit', fontWeight: 600 }}>
                                            {x.qty}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có cảnh báo.</div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function WarehouseControlTowerPage() {
  const navigate = useNavigate()
  const state = useAppState()
  const { settings } = useSettings()
  const { locations, stockTransactions, skus, products, orders, stockCounts } = state
  
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products])
  
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

  // 1. Process Data
  const locationStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateLocationStats>>()
    locations.forEach(l => {
        map.set(l.id, calculateLocationStats(l.id, skus, stockTransactions, orders, stockCounts, settings))
    })
    return map
  }, [locations, skus, stockTransactions, orders, stockCounts, settings])

  // Ranking logic (by Revenue)
  const ranking = useMemo(() => {
      return locations
        .filter(l => l.active)
        .map(l => ({ id: l.id, val: locationStatsMap.get(l.id)?.revenue || 0 }))
        .sort((a, b) => b.val - a.val)
        .map((x, i) => ({ id: x.id, rank: i + 1 }))
  }, [locations, locationStatsMap])
  
  const getRank = (id: string) => ranking.find(x => x.id === id)?.rank || 99

  const locationsByProvince = useMemo(() => {
      const groups = new Map<string, Location[]>()
      locations.filter(l => l.active).forEach(l => {
          const prov = l.province?.trim() || 'Khác'
          const list = groups.get(prov) ?? []
          list.push(l)
          groups.set(prov, list)
      })
      return groups
  }, [locations])

  // 2. Aggregate Global Stats
  const globalStats = useMemo(() => {
      let totalValue = 0
      let totalWarehouses = locations.filter(l => l.active).length
      let alerts = 0
      
      locationStatsMap.forEach(s => {
          totalValue += s.totalValue
          if (s.lowStockCount > 0 || s.negativeStockCount > 0) alerts++
      })
      
      return { totalValue, totalWarehouses, alerts }
  }, [locations, locationStatsMap])

  // 3. Prepare Chart Data (Performance)
  const chartData = useMemo(() => {
      return locations.filter(l => l.active).map(l => {
          const stats = locationStatsMap.get(l.id)
          return {
              name: l.code,
              value: stats?.totalValue || 0,
              revenue: stats?.revenue || 0,
              qty: stats?.totalQty || 0
          }
      }).sort((a, b) => b.value - a.value)
  }, [locations, locationStatsMap])

  const selectedLocation = selectedLocationId ? locations.find(l => l.id === selectedLocationId) : null

  return (
    <div className="page">
      <PageHeader title="Trung tâm điều hành kho" />

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--primary-100)', borderRadius: '50%', color: 'var(--primary-600)' }}>
                  <MapPin size={24} />
              </div>
              <div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Tổng kho hàng</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{globalStats.totalWarehouses}</div>
              </div>
          </div>
          <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ padding: 12, background: 'var(--success-100)', borderRadius: '50%', color: 'var(--success-600)' }}>
                  <TrendingUp size={24} />
              </div>
              <div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Tổng giá trị tồn</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{formatVnd(globalStats.totalValue)}</div>
              </div>
          </div>
          <div className="card" 
            style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
            onClick={() => navigate('/inventory?stockLevel=low')}
          >
              <div style={{ padding: 12, background: 'var(--warning-100)', borderRadius: '50%', color: 'var(--warning-600)' }}>
                  <Activity size={24} />
              </div>
              <div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cảnh báo kho</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{globalStats.alerts} <span style={{ fontSize: 14, fontWeight: 400 }}>kho</span></div>
              </div>
          </div>
      </div>

      {/* Map / Grid View */}
      <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <LayoutGrid size={20} /> Bản đồ kho theo khu vực
            </h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }}></div>
                    <span>Ổn định</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }}></div>
                    <span>Cảnh báo tồn</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)' }}></div>
                    <span>Rủi ro / Lệch</span>
                </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              {Array.from(locationsByProvince.entries()).map(([province, locs]) => (
                  <div key={province} style={{ background: 'var(--bg-subtle)', padding: 16, borderRadius: 12 }}>
                      <h4 style={{ marginTop: 0, marginBottom: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>
                          {province}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {locs.map(l => {
                              const stats = locationStatsMap.get(l.id)
                              if (!stats) return null
                              return (
                                <WarehouseCard 
                                  key={l.id} 
                                  location={l} 
                                  stats={stats} 
                                  rank={getRank(l.id)}
                                  onClick={() => setSelectedLocationId(l.id)}
                                />
                              )
                          })}
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Performance Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">So sánh hiệu suất (Giá trị tồn vs Doanh thu)</div>
          <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(val) => val >= 1000000000 ? `${(val/1000000000).toFixed(1)}B` : `${(val/1000000).toFixed(0)}M`} 
                      />
                      <Tooltip 
                        formatter={(val: number | undefined) => formatVnd(val ?? 0)} 
                        cursor={{ fill: 'transparent' }}
                      />
                      <Legend />
                      <Bar dataKey="value" name="Giá trị tồn" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revenue" name="Doanh thu" fill="var(--success-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Heatmap (Simplified as Table) */}
      <div className="card">
          <div className="card-title">Phân bố tồn kho (Heatmap)</div>
          <div className="table-wrap">
              <table className="table">
                  <thead>
                      <tr>
                          <th>SKU</th>
                          {locations.filter(l => l.active).map(l => (
                              <th key={l.id} style={{ textAlign: 'center' }}>{l.code}</th>
                          ))}
                      </tr>
                  </thead>
                  <tbody>
                      {skus.slice(0, 10).map(s => (
                          <tr key={s.id}>
                              <td style={{ fontWeight: 500 }}>
                                  <div>{s.skuCode}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{productsById.get(s.productId)}</div>
                              </td>
                              {locations.filter(l => l.active).map(l => {
                                  const stats = locationStatsMap.get(l.id)
                                  const qty = stats?.stockBySku.get(s.id) ?? 0
                                  // Heatmap color logic
                                  let bg = 'transparent'
                                  let color = 'inherit'
                                  if (qty === 0) { bg = 'var(--neutral-100)'; color = 'var(--text-muted)' }
                                  else if (qty < 0) { bg = '#FEF2F2'; color = 'var(--danger)' }
                                  else if (qty < 10) { bg = '#FFFBEB'; color = 'var(--warning-700)' }
                                  else { bg = '#EFF6FF'; color = 'var(--primary-700)' }
                                  
                                  return (
                                      <td key={l.id} style={{ textAlign: 'center', background: bg, color: color }}>
                                          {qty}
                                      </td>
                                  )
                              })}
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Modal */}
      {selectedLocation && selectedLocationId && locationStatsMap.get(selectedLocationId) && (
          <WarehouseDetailModal 
              location={selectedLocation} 
              stats={locationStatsMap.get(selectedLocationId)!}
              onClose={() => setSelectedLocationId(null)}
              skus={skus}
              productsById={productsById}
              onViewInventory={() => navigate(`/inventory?locationId=${selectedLocationId}`)}
          />
      )}
    </div>
  )
}

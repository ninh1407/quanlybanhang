import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../settings/useSettings'
import { useAppState } from '../state/Store'
import { formatVnd } from '../lib/money'
import { PageHeader } from '../ui-kit/PageHeader'
import { FilterBar } from '../ui-kit/FilterBar'
import { EmptyState } from '../ui-kit/EmptyState'
import { LoadingState } from '../ui-kit/LoadingState'
import { Modal } from '../ui-kit/Modal'
import { 
  MapPin, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  LayoutGrid,
  Activity,
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
  const isRisk = stats.negativeStockCount > 0 || stats.discrepancyAmount > 0
  const isWarn = !isRisk && stats.lowStockCount > 0
  const dotColor = isRisk ? 'var(--danger)' : isWarn ? 'var(--warning)' : 'var(--success)'

  return (
    <div className="ct-location" onClick={onClick}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ct-status-dot" style={{ background: dotColor }} />
          <div>
            <div className="ct-location-name">{location.name}</div>
            <div className="ct-location-code">{location.code}</div>
          </div>
        </div>

        <div className="ct-location-metrics">
          <div>
            <div className="ct-metric-label">Giá trị</div>
            <div className="ct-metric-value" style={{ color: 'var(--primary-700)' }}>
              {formatVnd(stats.totalValue)}
            </div>
          </div>
          <div>
            <div className="ct-metric-label">Đơn chờ</div>
            <div className="ct-metric-value" style={{ color: stats.pendingOrders > 5 ? 'var(--warning-700)' : 'var(--text-main)' }}>
              {stats.pendingOrders}
            </div>
          </div>
          <div>
            <div className="ct-metric-label">Thiếu</div>
            <div className="ct-metric-value" style={{ color: stats.shortagePercent > 20 ? 'var(--danger)' : 'var(--text-main)' }}>
              {stats.shortagePercent.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        <span className="ct-rank">#{rank}</span>
        {(stats.negativeStockCount > 0 || stats.lowStockCount > 0) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {stats.negativeStockCount > 0 ? (
              <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                <AlertTriangle size={14} /> Âm ({stats.negativeStockCount})
              </span>
            ) : null}
            {stats.lowStockCount > 0 ? (
              <span style={{ color: 'var(--warning-700)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                <Package size={14} /> Thiếu ({stats.lowStockCount})
              </span>
            ) : null}
          </div>
        )}
      </div>
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
      <Modal
        open={true}
        onClose={onClose}
        title={<span>Chi tiết kho: {location.name}</span>}
        width={760}
        footer={
          <>
            <button onClick={onClose} className="btn btn-outline">Đóng</button>
            <button onClick={onViewInventory} className="btn btn-primary">Xem tồn kho</button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Doanh thu</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: 'var(--success-600)' }}>{formatVnd(stats.revenue)}</div>
          </div>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Giá trị tồn</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{formatVnd(stats.totalValue)}</div>
          </div>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Đơn chờ</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{stats.pendingOrders}</div>
          </div>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>% Thiếu</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: 'var(--warning-700)' }}>{stats.shortagePercent.toFixed(1)}%</div>
          </div>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Chênh lệch KK</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: 'var(--danger-600)' }}>{formatVnd(stats.discrepancyAmount)}</div>
          </div>
          <div className="card card--dense card--flat card--nohover" style={{ marginBottom: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>SKU / Tổng tồn</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>
              {stats.activeSkuCount} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 800 }}>/ {stats.totalQty}</span>
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 900, color: 'var(--text-main)', marginBottom: 10 }}>Cảnh báo tồn kho thấp / âm</div>
        {stockItems.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Tên</th>
                  <th style={{ textAlign: 'right' }}>Tồn</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.slice(0, 12).map(x => (
                  <tr key={x.sku.id}>
                    <td>{x.sku.skuCode}</td>
                    <td>{productsById.get(x.sku.productId)}</td>
                    <td style={{ textAlign: 'right', color: x.qty < 0 ? 'var(--danger)' : x.qty < 5 ? 'var(--warning-700)' : 'inherit', fontWeight: 900 }}>
                      {x.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Không có cảnh báo.</div>
        )}
      </Modal>
    )
}

export function WarehouseControlTowerPage() {
  const navigate = useNavigate()
  const state = useAppState()
  const { settings } = useSettings()
  const { locations, stockTransactions, skus, products, orders, stockCounts } = state
  
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products])
  
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [insightTab, setInsightTab] = useState<'performance' | 'heatmap'>('performance')

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
      const q = query.trim().toLowerCase()
      locations
        .filter(l => l.active)
        .filter(l => {
          if (!q) return true
          const hay = `${l.name} ${l.code} ${l.province ?? ''}`.toLowerCase()
          return hay.includes(q)
        })
        .forEach(l => {
          const prov = l.province?.trim() || 'Khác'
          const list = groups.get(prov) ?? []
          list.push(l)
          groups.set(prov, list)
      })
      Array.from(groups.values()).forEach((list) => list.sort((a, b) => getRank(a.id) - getRank(b.id)))
      return new Map(Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi')))
  }, [locations, query, getRank])

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

  const isLikelyLoading = locations.length === 0 && skus.length === 0 && stockTransactions.length === 0
  const activeLocations = locations.filter(l => l.active)

  return (
    <div className="page">
      <PageHeader title="Trung tâm điều hành kho" subtitle="Tổng quan tình trạng kho theo khu vực" />

      <FilterBar
        left={
          <>
            <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kho / mã / tỉnh..."
                style={{ width: '100%' }}
              />
            </div>
          </>
        }
        right={
          <>
            <button className="btn btn-outline" onClick={() => setQuery('')}>Đặt lại</button>
            <button className="btn btn-primary" onClick={() => navigate('/inventory?stockLevel=low')}>
              <Activity size={16} /> Xem thiếu hàng
            </button>
          </>
        }
      />

      {isLikelyLoading ? (
        <LoadingState title="Đang tải dữ liệu kho..." rows={7} />
      ) : activeLocations.length === 0 ? (
        <EmptyState title="Chưa có kho hoạt động" hint="Kiểm tra danh sách kho hoặc quyền truy cập kho." />
      ) : (
        <>
          <div className="card card--dense card--nohover">
            <div className="ct-kpis">
              <div className="ct-kpi">
                <div className="ct-kpi-ico" style={{ background: 'var(--info-100)', color: 'var(--info-600)' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="ct-kpi-label">Tổng kho hàng</div>
                  <div className="ct-kpi-value">{globalStats.totalWarehouses}</div>
                </div>
              </div>
              <div className="ct-kpi">
                <div className="ct-kpi-ico" style={{ background: 'var(--success-100)', color: 'var(--success-600)' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="ct-kpi-label">Tổng giá trị tồn</div>
                  <div className="ct-kpi-value">{formatVnd(globalStats.totalValue)}</div>
                </div>
              </div>
              <div className="ct-kpi">
                <div className="ct-kpi-ico" style={{ background: 'var(--warning-100)', color: 'var(--warning-700)' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div className="ct-kpi-label">Kho có cảnh báo</div>
                  <div className="ct-kpi-value">{globalStats.alerts}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ct-grid">
            <div className="card card--nohover">
              <div className="card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <LayoutGrid size={18} /> Bản đồ kho theo khu vực
                </span>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="ct-status-dot" style={{ background: 'var(--success)' }} /> Ổn định
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="ct-status-dot" style={{ background: 'var(--warning)' }} /> Cảnh báo tồn
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="ct-status-dot" style={{ background: 'var(--danger)' }} /> Rủi ro / lệch
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {Array.from(locationsByProvince.entries()).map(([province, locs]) => (
                  <div key={province} className="ct-province">
                    <h4 className="ct-province-title">{province}</h4>
                    <div className="ct-locations">
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

            <div className="ct-side">
              <div className="card card--nohover">
                <div className="card-title">
                  <span>Phân tích nhanh</span>
                  <div className="tabs">
                    <button className={`tab ${insightTab === 'performance' ? 'active' : ''}`} onClick={() => setInsightTab('performance')}>
                      Hiệu suất
                    </button>
                    <button className={`tab ${insightTab === 'heatmap' ? 'active' : ''}`} onClick={() => setInsightTab('heatmap')}>
                      Heatmap
                    </button>
                  </div>
                </div>

                {insightTab === 'performance' ? (
                  <div style={{ height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.slice(0, 14)} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) =>
                            val >= 1000000000 ? `${(val / 1000000000).toFixed(1)}B` : `${(val / 1000000).toFixed(0)}M`
                          }
                        />
                        <Tooltip formatter={(val: number | undefined) => formatVnd(val ?? 0)} cursor={{ fill: 'transparent' }} />
                        <Legend />
                        <Bar dataKey="value" name="Giá trị tồn" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="revenue" name="Doanh thu" fill="var(--success-600)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          {activeLocations.slice(0, 6).map(l => (
                            <th key={l.id} style={{ textAlign: 'center' }}>
                              {l.code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {skus.slice(0, 10).map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 900 }}>
                              <div>{s.skuCode}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{productsById.get(s.productId)}</div>
                            </td>
                            {activeLocations.slice(0, 6).map(l => {
                              const stats = locationStatsMap.get(l.id)
                              const qty = stats?.stockBySku.get(s.id) ?? 0
                              let bg = 'transparent'
                              let color = 'inherit'
                              if (qty === 0) {
                                bg = 'var(--neutral-100)'
                                color = 'var(--text-muted)'
                              } else if (qty < 0) {
                                bg = 'var(--danger-50)'
                                color = 'var(--danger)'
                              } else if (qty < 10) {
                                bg = 'var(--warning-50)'
                                color = 'var(--warning-700)'
                              } else {
                                bg = 'var(--info-50)'
                                color = 'var(--primary-700)'
                              }
                              return (
                                <td key={l.id} style={{ textAlign: 'center', background: bg, color: color, fontWeight: 900 }}>
                                  {qty}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                      Hiển thị 6 kho đầu tiên để gọn UI.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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

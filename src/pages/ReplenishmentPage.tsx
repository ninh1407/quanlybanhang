import { useMemo, useState } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { formatVnd } from '../lib/money'
import { InventoryRequest, TransferOrder } from '../domain/types'
import { useDialogs } from '../ui-kit/Dialogs'
import { soldQtyBySku } from '../domain/analytics'
import { newId } from '../lib/id'
import { nowIso } from '../lib/date'
import { useAuth } from '../auth/auth'
import { Settings, ArrowRight, ShoppingCart, Truck } from 'lucide-react'
import { SkuSettings } from '../domain/types'

export function ReplenishmentPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const dialogs = useDialogs()
  const [viewMode, setViewMode] = useState<'suggestion' | 'settings'>('suggestion')
  const [leadTimeDays, setLeadTimeDays] = useState(7)
  const [safetyStockDays, setSafetyStockDays] = useState(14)
  const [analysisPeriod, setAnalysisPeriod] = useState<30 | 60 | 90>(30)
  
  // New: Filter by location
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  const [centralLocationId, setCentralLocationId] = useState<string>('')

  // Initialize central location
  useMemo(() => {
      if (!centralLocationId && state.locations.length > 0) {
          const central = state.locations.find(l => l.active)
          if (central) setCentralLocationId(central.id)
      }
  }, [state.locations, centralLocationId])

  // Settings Logic
  const [settingsFilterLoc, setSettingsFilterLoc] = useState<string>(state.locations[0]?.id || '')
  
  const handleSaveSetting = (skuId: string, field: keyof SkuSettings, value: number) => {
      if (!settingsFilterLoc) return
      const current = state.skuSettings.find(s => s.skuId === skuId && s.locationId === settingsFilterLoc)
      
      const next: SkuSettings = current 
        ? { ...current, [field]: value }
        : {
            skuId,
            locationId: settingsFilterLoc,
            minStock: 0,
            maxStock: 0,
            safetyStock: 0,
            leadTimeDays: 0,
            [field]: value
        }
      dispatch({ type: 'skuSettings/upsert', setting: next })
  }

  // 1. Calculate Velocity based on selected period
  const salesVelocity = useMemo(() => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - analysisPeriod)
      
      const soldMap = soldQtyBySku(state.orders, start, end)
      
      const velocityMap = new Map<string, number>()
      soldMap.forEach((qty, skuId) => {
          velocityMap.set(skuId, qty / analysisPeriod)
      })
      return velocityMap
  }, [state.orders, analysisPeriod])

  // 2. Calculate Current Stock (per location)
  const stockMap = useMemo(() => {
      const m = new Map<string, number>()
      state.stockTransactions.forEach(t => {
          // If a specific location is selected, only count stock there
          if (selectedLocationId !== 'all' && t.locationId !== selectedLocationId) return
          
          const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
          m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
      })
      return m
  }, [state.stockTransactions, selectedLocationId])

  // 3. Central Warehouse Stock (for transfer suggestions)
  const centralStockMap = useMemo(() => {
      if (!centralLocationId) return new Map<string, number>()

      const m = new Map<string, number>()
      state.stockTransactions.forEach(t => {
          if (t.locationId !== centralLocationId) return
          const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
          m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
      })
      return m
  }, [state.stockTransactions, centralLocationId])

  // 4. Generate Suggestions
  const suggestions = useMemo(() => {
      return state.skus
        .filter(s => s.kind === 'single' && s.active)
        .map(s => {
            const velocity = salesVelocity.get(s.id) ?? 0
            const currentStock = stockMap.get(s.id) ?? 0
            
            // Override with configured settings if available
            const setting = selectedLocationId !== 'all' 
                ? state.skuSettings.find(x => x.skuId === s.id && x.locationId === selectedLocationId)
                : null

            const effectiveLeadTime = setting?.leadTimeDays ?? leadTimeDays
            const effectiveSafetyStock = setting?.safetyStock ?? (velocity * safetyStockDays)
            const minStock = setting?.minStock ?? 0
            
            // Reorder Point Formula
            const calculatedROP = (velocity * effectiveLeadTime) + effectiveSafetyStock
            const reorderPoint = Math.max(minStock, calculatedROP)
            
            const suggestedQty = Math.ceil(Math.max(0, reorderPoint - currentStock))
            
            // Suggest Source: 
            // If viewing specific location (Branch) AND it's not Central: Always Transfer from Central.
            // If viewing Central OR All: Purchase.
            const isBranchView = selectedLocationId !== 'all' && selectedLocationId !== centralLocationId
            const centralStock = centralStockMap.get(s.id) ?? 0
            
            return {
                sku: s,
                product: state.products.find(p => p.id === s.productId),
                velocity,
                currentStock,
                reorderPoint,
                suggestedQty,
                estimatedCost: suggestedQty * s.cost,
                type: isBranchView ? 'transfer' : 'purchase',
                centralStock // Pass for UI to show availability
            }
        })
        .filter(x => x.suggestedQty > 0)
        .sort((a, b) => b.suggestedQty - a.suggestedQty)
  }, [state.skus, state.products, state.skuSettings, salesVelocity, stockMap, leadTimeDays, safetyStockDays, centralStockMap, selectedLocationId, centralLocationId])

  const createPurchaseRequest = async () => {
      const items = suggestions.filter(x => x.type === 'purchase')
      if (items.length === 0) return

      const confirmed = await dialogs.confirm({ 
          message: `Tạo yêu cầu nhập hàng (PO) cho ${items.length} SKU?` 
      })
      if (!confirmed) return

      const request: InventoryRequest = {
          id: newId('req'),
          code: '',
          type: 'in',
          status: 'pending_manager',
          warehouseId: selectedLocationId === 'all' ? state.locations.find(l => l.active)?.id || '' : selectedLocationId,
          items: items.map(s => ({
              skuId: s.sku.id,
              qty: s.suggestedQty,
              note: 'Auto-replenishment (Purchase)'
          })),
          note: `Tự động tạo từ Replenishment Engine. Period: ${analysisPeriod} days.`,
          logs: [{
              id: newId('log'),
              action: 'create',
              actorId: user?.id || 'system',
              timestamp: nowIso(),
              note: 'Auto-generated PO'
          }],
          createdBy: user?.id || 'system',
          createdAt: nowIso(),
          updatedAt: nowIso()
      }

      dispatch({ type: 'requests/upsert', request })
      await dialogs.alert({ message: 'Đã tạo yêu cầu nhập hàng!' })
  }

  const createTransferRequest = async () => {
      const items = suggestions.filter(x => x.type === 'transfer')
      if (items.length === 0) return
      
      if (!centralLocationId || selectedLocationId === 'all') return

      const confirmed = await dialogs.confirm({ 
          message: `Tạo phiếu YÊU CẦU chuyển kho từ Kho trung tâm cho ${items.length} SKU?` 
      })
      if (!confirmed) return

      const order: TransferOrder = {
          id: newId('to'),
          code: '',
          status: 'requested', // Directly requested
          fromLocationId: centralLocationId,
          toLocationId: selectedLocationId,
          lines: items.map(s => ({
              skuId: s.sku.id,
              requestedQty: s.suggestedQty,
              shippedQty: 0,
              receivedQty: 0,
              lostQty: 0,
              unitCost: s.sku.cost,
              note: 'Auto-replenishment (Transfer Request)'
          })),
          shippingFee: 0,
          logs: [{
              id: newId('log'),
              action: 'create',
              actorId: user?.id || 'system',
              timestamp: nowIso(),
              note: 'Auto-generated Transfer Request'
          }],
          createdByUserId: user?.id || 'system',
          createdAt: nowIso(),
          updatedAt: nowIso()
      }

      dispatch({ type: 'transferOrders/upsert', order })
      await dialogs.alert({ message: 'Đã tạo phiếu yêu cầu chuyển kho!' })
  }

  const purchaseItems = suggestions.filter(x => x.type === 'purchase')
  const transferItems = suggestions.filter(x => x.type === 'transfer')

  if (viewMode === 'settings') {
      return (
          <div className="page">
              <PageHeader 
                title="Cấu hình định mức tồn kho (Replenishment Settings)" 
                onBack={() => setViewMode('suggestion')}
              />
              <div className="card">
                  <div className="field">
                      <label>Chọn kho để cấu hình</label>
                      <select value={settingsFilterLoc} onChange={e => setSettingsFilterLoc(e.target.value)}>
                          {state.locations.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </select>
                  </div>
                  
                  <div className="table-wrap">
                      <table className="table">
                          <thead>
                              <tr>
                                  <th>SKU</th>
                                  <th>Min Stock</th>
                                  <th>Max Stock</th>
                                  <th>Safety Stock</th>
                                  <th>Lead Time (Ngày)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {state.skus.filter(s => s.kind === 'single' && s.active).map(s => {
                                  const setting = state.skuSettings.find(x => x.skuId === s.id && x.locationId === settingsFilterLoc)
                                  return (
                                      <tr key={s.id}>
                                          <td>
                                              <div style={{ fontWeight: 500 }}>{s.skuCode}</div>
                                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                  {state.products.find(p => p.id === s.productId)?.name}
                                              </div>
                                          </td>
                                          <td>
                                              <input 
                                                type="number" 
                                                className="input-small"
                                                value={setting?.minStock ?? 0} 
                                                onChange={e => handleSaveSetting(s.id, 'minStock', Number(e.target.value))}
                                                style={{ width: 80 }}
                                              />
                                          </td>
                                          <td>
                                              <input 
                                                type="number" 
                                                className="input-small"
                                                value={setting?.maxStock ?? 0} 
                                                onChange={e => handleSaveSetting(s.id, 'maxStock', Number(e.target.value))}
                                                style={{ width: 80 }}
                                              />
                                          </td>
                                          <td>
                                              <input 
                                                type="number" 
                                                className="input-small"
                                                value={setting?.safetyStock ?? 0} 
                                                onChange={e => handleSaveSetting(s.id, 'safetyStock', Number(e.target.value))}
                                                style={{ width: 80 }}
                                              />
                                          </td>
                                          <td>
                                              <input 
                                                type="number" 
                                                className="input-small"
                                                value={setting?.leadTimeDays ?? 0} 
                                                onChange={e => handleSaveSetting(s.id, 'leadTimeDays', Number(e.target.value))}
                                                style={{ width: 80 }}
                                              />
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="page">
      <PageHeader 
        title="Purchase Suggestion Center" 
        actions={
            <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setViewMode('settings')}>
                    <Settings size={16} /> Cấu hình định mức
                </button>
                {transferItems.length > 0 && selectedLocationId !== 'all' && (
                    <button className="btn btn-secondary" onClick={createTransferRequest}>
                        <Truck size={16} /> Tạo phiếu chuyển ({transferItems.length})
                    </button>
                )}
                <button className="btn btn-primary" disabled={!purchaseItems.length} onClick={createPurchaseRequest}>
                    <ShoppingCart size={16} /> Tạo đơn nhập hàng ({purchaseItems.length})
                </button>
            </div>
        }
      />

      <div className="card">
          <div className="grid-form" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 16 }}>
              <div className="field">
                  <label>Phạm vi phân tích</label>
                  <select 
                    value={analysisPeriod} 
                    onChange={e => setAnalysisPeriod(Number(e.target.value) as any)}
                  >
                      <option value={30}>30 ngày gần nhất</option>
                      <option value={60}>60 ngày gần nhất</option>
                      <option value={90}>90 ngày gần nhất</option>
                  </select>
              </div>
              <div className="field">
                  <label>Kho cần bổ sung</label>
                  <select 
                    value={selectedLocationId} 
                    onChange={e => setSelectedLocationId(e.target.value)}
                  >
                      <option value="all">Tất cả kho (Tổng hợp)</option>
                      {state.locations.filter(l => l.active).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                  </select>
              </div>
              <div className="field">
                  <label>Nguồn bổ sung (Kho TT)</label>
                  <select 
                    value={centralLocationId} 
                    onChange={e => setCentralLocationId(e.target.value)}
                  >
                      {state.locations.filter(l => l.active).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                  </select>
              </div>
              <div className="field">
                  <label>Lead Time (Ngày)</label>
                  <input type="number" value={leadTimeDays} onChange={e => setLeadTimeDays(Number(e.target.value))} />
              </div>
              <div className="field">
                  <label>Safety Stock (Ngày)</label>
                  <input type="number" value={safetyStockDays} onChange={e => setSafetyStockDays(Number(e.target.value))} />
              </div>
          </div>

          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              <div style={{ flex: 1, background: 'var(--bg-subtle)', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cần nhập hàng (Purchase)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-600)' }}>
                      {purchaseItems.length} SKU
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatVnd(purchaseItems.reduce((s, x) => s + x.estimatedCost, 0))}
                  </div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-subtle)', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Có thể điều chuyển (Transfer)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success-600)' }}>
                      {transferItems.length} SKU
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatVnd(transferItems.reduce((s, x) => s + x.estimatedCost, 0))}
                  </div>
              </div>
          </div>

          <div className="table-wrap">
              <table className="table">
                  <thead>
                      <tr>
                          <th>SKU</th>
                          <th>Tốc độ bán (ngày)</th>
                          <th>Tồn hiện tại</th>
                          {selectedLocationId !== 'all' && selectedLocationId !== centralLocationId && <th>Tồn Kho TT</th>}
                          <th>Điểm đặt hàng</th>
                          <th>Gợi ý</th>
                          <th>Hành động</th>
                      </tr>
                  </thead>
                  <tbody>
                      {suggestions.map(x => (
                          <tr key={x.sku.id}>
                              <td>
                                  <div style={{ fontWeight: 500 }}>{x.sku.skuCode}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{x.product?.name}</div>
                              </td>
                              <td>{x.velocity.toFixed(2)}</td>
                              <td>{x.currentStock}</td>
                              {selectedLocationId !== 'all' && selectedLocationId !== centralLocationId && (
                                  <td style={{ color: x.centralStock < x.suggestedQty ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
                                      {x.centralStock}
                                  </td>
                              )}
                              <td>{x.reorderPoint.toFixed(0)}</td>
                              <td style={{ fontWeight: 700, color: x.type === 'transfer' ? 'var(--success-600)' : 'var(--primary-600)' }}>
                                  {x.suggestedQty}
                              </td>
                              <td>
                                  {x.type === 'transfer' ? (
                                      <span className="badge" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>
                                          <ArrowRight size={12} style={{ marginRight: 4 }} /> Yêu cầu chuyển
                                      </span>
                                  ) : (
                                      <span className="badge" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
                                          <ShoppingCart size={12} style={{ marginRight: 4 }} /> Mua mới
                                      </span>
                                  )}
                              </td>
                          </tr>
                      ))}
                      {!suggestions.length && (
                          <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                  Kho hàng đang ở mức an toàn.
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

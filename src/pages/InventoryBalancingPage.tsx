import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Sku, TransferOrder } from '../../shared/types/domain'
import { subDays, parseISO } from 'date-fns'
import { ArrowRight, Truck, TrendingUp, AlertTriangle, Package, DollarSign } from 'lucide-react'
import { newId } from '../../shared/lib/id'
import { nowIso } from '../../shared/lib/date'
import { useAuth } from '../auth/auth'
import { useDialogs } from '../ui-kit/Dialogs'
import { formatVnd } from '../../shared/lib/money'

function skuLabel(productsById: Map<string, string>, sku: Sku): string {
  const productName = productsById.get(sku.productId) ?? sku.productId
  const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
  return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
}

export function InventoryBalancingPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user } = useAuth()
  const dialogs = useDialogs()
  
  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const locations = useMemo(() => state.locations.filter(l => l.active), [state.locations])

  function createTransfer(s: any) {
      const id = newId('to')
      const transfer: TransferOrder = {
          id,
          code: `TO-${id.slice(-6).toUpperCase()}`,
          status: 'draft',
          fromLocationId: s.from,
          toLocationId: s.to,
          lines: [{
              skuId: s.sku.id,
              requestedQty: s.qty,
              shippedQty: 0,
              receivedQty: 0,
              lostQty: 0,
              unitCost: s.sku.cost || 0,
              note: s.reason
          }],
          shippingFee: 0,
          logs: [],
          createdByUserId: user?.id || 'system',
          createdAt: nowIso(),
          updatedAt: nowIso()
      }
      dispatch({ type: 'transferOrders/upsert', order: transfer })
      dialogs.alert({ message: 'Đã tạo phiếu chuyển kho nháp.' }).then(() => {
           navigate('/transfer-orders')
      })
  }

  // 1. Calculate Stock & Sales per AppLocation per SKU
  const analysis = useMemo(() => {
    // Map<skuId, Map<locationId, { stock: number, sales30d: number }>>
    const data = new Map<string, Map<string, { stock: number; sales30d: number }>>()

    // Init structure
    state.skus.forEach(s => {
        if (s.kind !== 'single') return
        const locMap = new Map<string, { stock: number; sales30d: number }>()
        locations.forEach(l => {
            locMap.set(l.id, { stock: 0, sales30d: 0 })
        })
        data.set(s.id, locMap)
    })

    // Fill Stock
    state.stockTransactions.forEach(t => {
        if (!t.locationId) return
        const sMap = data.get(t.skuId)
        if (!sMap) return
        const lData = sMap.get(t.locationId)
        if (!lData) return

        if (t.type === 'in') lData.stock += t.qty
        else if (t.type === 'out') lData.stock -= t.qty
        else lData.stock += t.qty // adjust
    })

    // Fill Sales (Last 30 days)
    const now = new Date()
    const cutoff = subDays(now, 30)
    
    state.orders.forEach(o => {
        if (o.status !== 'paid' && o.status !== 'delivered' && o.status !== 'shipped') return
        const created = parseISO(o.createdAt)
        if (created < cutoff) return
        
        // Use fulfillmentLocationId or fallback to first location
        const locId = o.fulfillmentLocationId || locations[0]?.id
        if (!locId) return

        o.items.forEach((item: any) => {
            const sMap = data.get(item.skuId)
            if (!sMap) return
            const lData = sMap.get(locId)
            if (!lData) return
            lData.sales30d += item.qty
        })
    })

    return data
  }, [state.stockTransactions, state.orders, state.skus, locations])

  // 2. Identify Opportunities
  const { list: suggestions, stats } = useMemo(() => {
      const list: { sku: Sku; from: string; to: string; qty: number; reason: string }[] = []
      const shortageLocsSet = new Set<string>()
      const excessLocsSet = new Set<string>()

      analysis.forEach((locMap, skuId) => {
          const sku = state.skus.find(s => s.id === skuId)
          if (!sku) return

          // Identify Excess and Shortage locations
          const excessLocs: { id: string; qty: number }[] = []
          const shortageLocs: { id: string; qty: number }[] = []

          locMap.forEach((d, locId) => {
              // Rule: Excess if Stock > Sales * 2 (buffer) AND Stock > 10 (min threshold)
              // If sales is 0, threshold is just absolute stock > 10
              const excessThreshold = Math.max(10, d.sales30d * 2)
              if (d.stock > excessThreshold) {
                  excessLocs.push({ id: locId, qty: d.stock - excessThreshold })
                  excessLocsSet.add(locId)
              }

              // Rule: Shortage if Stock < Sales * 0.5 (safety) AND Sales > 0
              const shortageThreshold = Math.max(5, d.sales30d * 0.5)
              if (d.stock < shortageThreshold && d.sales30d > 0) {
                  shortageLocs.push({ id: locId, qty: shortageThreshold - d.stock })
                  shortageLocsSet.add(locId)
              }
          })

          // Match them
          excessLocs.forEach(ex => {
              shortageLocs.forEach(sh => {
                  if (ex.qty <= 0 || sh.qty <= 0) return
                  
                  const transferQty = Math.min(ex.qty, sh.qty)
                  if (transferQty > 0) {
                      list.push({
                          sku,
                          from: ex.id,
                          to: sh.id,
                          qty: Math.floor(transferQty),
                          reason: `Kho dư ${Math.floor(ex.qty)} - Kho thiếu ${Math.floor(sh.qty)}`
                      })
                      
                      // Reduce available excess/shortage for next match
                      ex.qty -= transferQty
                      sh.qty -= transferQty
                  }
              })
          })
      })

      const totalValue = list.reduce((acc, item) => acc + (item.qty * (item.sku.cost || 0)), 0)

      return {
          list,
          stats: {
              shortageLocCount: shortageLocsSet.size,
              excessLocCount: excessLocsSet.size,
              skuCount: list.length,
              totalValue
          }
      }
  }, [analysis, state.skus])

  return (
    <div className="page">
      <PageHeader title="Cân bằng kho (Inventory Balancing)" />

      <div className="dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} className="text-danger" />
                  Kho thiếu hàng
              </div>
              <div className="stat-value text-danger">{stats.shortageLocCount}</div>
              <div className="stat-desc">Số kho đang dưới định mức an toàn</div>
          </div>
          <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={18} className="text-warning" />
                  Kho dư hàng
              </div>
              <div className="stat-value text-warning">{stats.excessLocCount}</div>
              <div className="stat-desc">Số kho tồn vượt quá nhu cầu bán</div>
          </div>
          <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} className="text-primary" />
                  SKU cần điều chuyển
              </div>
              <div className="stat-value text-primary">{stats.skuCount}</div>
              <div className="stat-desc">Số mã hàng có thể cân bằng ngay</div>
          </div>
          <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} className="text-success" />
                  Giá trị tồn cần cân bằng
              </div>
              <div className="stat-value text-success">{formatVnd(stats.totalValue)}</div>
              <div className="stat-desc">Tối ưu dòng tiền chết</div>
          </div>
      </div>

      <div className="card">
        <div className="card-title">Chi tiết đề xuất điều chuyển</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU / Sản phẩm</th>
                <th>Kho dư</th>
                <th />
                <th>Kho thiếu</th>
                <th>SL chuyển</th>
                <th>Giá trị</th>
                <th>Ghi chú</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s, idx) => {
                  const fromLoc = locations.find(l => l.id === s.from)
                  const toLoc = locations.find(l => l.id === s.to)
                  const value = s.qty * (s.sku.cost || 0)
                  return (
                      <tr key={idx}>
                          <td>{skuLabel(productsById, s.sku)}</td>
                          <td>
                              <span className="badge badge-warning">{fromLoc?.name}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}><ArrowRight size={16} /></td>
                          <td>
                              <span className="badge badge-success">{toLoc?.name}</span>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{s.qty}</td>
                          <td>{formatVnd(value)}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.reason}</td>
                          <td>
                              <button className="btn btn-small btn-primary" onClick={() => createTransfer(s)}>
                                  <Truck size={14} style={{ marginRight: 4 }} />
                                  Chuyển hàng
                              </button>
                          </td>
                      </tr>
                  )
              })}
              {suggestions.length === 0 && (
                  <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Không có đề xuất điều chuyển nào. Các kho đang cân bằng tốt!
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

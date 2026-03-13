import { memo, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { prevMonthRange, soldQtyBySku } from '../domain/analytics'
import type { Location, Sku, StockTransaction, StockTxType, StockTransactionAttachment } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { useDialogs } from '../ui-kit/Dialogs'
import { CheckSquare, Square, Database, AlertTriangle, ArrowUp, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { useSettings } from '../settings/useSettings'
import { useListView } from '../ui-kit/listing/useListView'
import { Pagination } from '../ui-kit/listing/Pagination'

function skuLabel(productsById: Map<string, string>, sku: Sku): string {
  const productName = productsById.get(sku.productId) ?? sku.productId
  const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
  return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
}

function locationLabel(loc: Location): string {
  return `${loc.code} - ${loc.name}`
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

type StockListFilters = {
  locationId: string
  categoryId: string
  supplierId: string
  stockLevel: 'all' | 'low' | 'negative'
}

type StockListSortKey = 'sku' | 'stock' | 'avgCost'

type StockHistoryFilters = {
  locationId: 'all' | string
  type: 'all' | StockTxType
  from: string
  to: string
}

function toMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function rangeMs(from: string, to: string): { startMs: number | null; endMs: number | null } {
  const startMs = from ? toMs(`${from}T00:00:00.000Z`) : null
  const endMs = to ? toMs(`${to}T23:59:59.999Z`) : null
  return { startMs, endMs }
}

const StockRow = memo(function StockRow(props: {
  sku: Sku
  productName: string
  stock: number
  avgCost: number
  selected: boolean
  onSelect: () => void
}) {
  const { sku, productName, stock, avgCost, selected, onSelect } = props
  
  // Custom logic: >50 Green, 10-50 Yellow, <10 Red
  let color = 'var(--text-main)'
  if (stock > 50) color = 'var(--success)'
  else if (stock >= 10) color = 'var(--warning-700)'
  else color = 'var(--danger)'

  return (
    <tr className={selected ? 'tr-selected' : ''}>
      <td className="sticky-col-1" style={{ background: selected ? 'var(--primary-50)' : 'var(--bg-surface)' }}>
        <div 
            onClick={(e) => { e.stopPropagation(); onSelect() }} 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {selected ? <CheckSquare size={18} color="var(--primary-600)" /> : <Square size={18} color="var(--text-muted)" />}
        </div>
      </td>
      <td className="sticky-col-2" style={{ background: selected ? 'var(--primary-50)' : 'var(--bg-surface)' }}>
         <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-700)' }}>{sku.skuCode}</div>
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{productName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
             {sku.color} {sku.size ? `/ ${sku.size}` : ''}
        </div>
      </td>
      <td>
         <span style={{ fontWeight: 600, color }}>{stock}</span>
      </td>
      <td>{formatVnd(stock * avgCost)}</td>
    </tr>
  )
})

export function InventoryPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canWrite = can('inventory:write')
  const dialogs = useDialogs()
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()

  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )

  const { user } = useAuth()
  const defaultLocationId = (user?.role === 'admin' || user?.role === 'manager') ? 'all' : (locations[0]?.id ?? '')

  const stockList = useListView<StockListFilters>('inventory:stock', {
    q: '',
    sortKey: 'sku',
    sortDir: 'asc',
    page: 1,
    pageSize: 50,
    filters: {
      locationId: defaultLocationId,
      categoryId: '',
      supplierId: '',
      stockLevel: 'all'
    },
  })

  useEffect(() => {
      const locId = searchParams.get('locationId')
      const stockLevel = searchParams.get('stockLevel')
      if (locId || stockLevel) {
          stockList.patchFilters({
              locationId: locId || stockList.state.filters.locationId,
              stockLevel: (stockLevel as any) || 'all'
          })
      }
  }, []) 

  const historyList = useListView<StockHistoryFilters>('inventory:history', {
    q: '',
    sortKey: 'createdAt',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    filters: {
      locationId: 'all',
      type: 'all',
      from: '',
      to: '',
    },
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const skus = useMemo(
    () =>
      state.skus
        .filter((s) => s.kind === 'single')
        .slice()
        .sort((a, b) => skuLabel(productsById, a).localeCompare(skuLabel(productsById, b))),
    [productsById, state.skus],
  )
  const stockQtyBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  }, [state.stockTransactions])
  const prevRange = useMemo(() => prevMonthRange(), [])
  const soldPrevBySkuId = useMemo(() => {
    return soldQtyBySku(state.orders, prevRange.start, prevRange.end)
  }, [prevRange.end, prevRange.start, state.orders])
  
  const lowStockSkus = useMemo(() => {
    return skus.filter((s) => {
      const soldPrev = soldPrevBySkuId.get(s.id) ?? 0
      const stock = stockQtyBySkuId.get(s.id) ?? 0
      const threshold = Math.max(0, Math.min(100, Number(settings.lowStockThresholdPercent) || 0)) / 100
      return soldPrev > 0 && stock < soldPrev * threshold
    })
  }, [settings.lowStockThresholdPercent, skus, soldPrevBySkuId, stockQtyBySkuId])

  const skusById = useMemo(() => new Map(state.skus.map((s) => [s.id, s])), [state.skus])
  const txs = useMemo(
    () => state.stockTransactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.stockTransactions],
  )

  const [skuId, setSkuId] = useState(skus[0]?.id ?? '')
  const locationId = stockList.state.filters.locationId
  const [type, setType] = useState<StockTxType>('in')
  const [qty, setQty] = useState<number>(1)
  const [unitCost, setUnitCost] = useState<number>(0)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState<StockTransactionAttachment[]>([])

  const stockQtyAtLocationBySkuId = (() => {
    const m = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      if (locationId && locationId !== 'all' && t.locationId !== locationId) return
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  })()

  const averageCostBySkuId = useMemo(() => {
    const grouped = new Map<string, StockTransaction[]>()
    state.stockTransactions.forEach((t) => {
      const arr = grouped.get(t.skuId)
      if (arr) arr.push(t)
      else grouped.set(t.skuId, [t])
    })
    grouped.forEach((arr) => arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

    const m = new Map<string, number>()
    state.skus.forEach((s) => {
      if (s.kind !== 'single') return
      m.set(s.id, averageCostFromSortedTxs(grouped.get(s.id) ?? []))
    })
    return m
  }, [state.skus, state.stockTransactions])

  const stockRows = (() => {
    const needle = stockList.state.q.trim().toLowerCase()
    const { categoryId, supplierId, stockLevel } = stockList.state.filters
    
    const rows = skus
      .map((s) => {
        const stock = stockQtyAtLocationBySkuId.get(s.id) ?? 0
        const avgCost = averageCostBySkuId.get(s.id) ?? 0
        const label = skuLabel(productsById, s)
        const product = state.products.find(p => p.id === s.productId)
        return { sku: s, label, stock, avgCost, product }
      })
      .filter((r) => {
        if (categoryId && r.product?.categoryId !== categoryId) return false
        if (supplierId && r.product?.supplierId !== supplierId) return false
        
        if (stockLevel === 'low') {
            const soldPrev = soldPrevBySkuId.get(r.sku.id) ?? 0
            const threshold = Math.max(0, Math.min(100, Number(settings.lowStockThresholdPercent) || 0)) / 100
            if (!(soldPrev > 0 && r.stock < soldPrev * threshold)) return false
        }
        if (stockLevel === 'negative' && r.stock >= 0) return false
        
        if (!needle) return true
        return `${r.label} ${r.sku.skuCode}`.toLowerCase().includes(needle)
      })

    const dir = stockList.state.sortDir === 'asc' ? 1 : -1
    const key = stockList.state.sortKey as StockListSortKey
    rows.sort((a, b) => {
      if (key === 'stock') return dir * (a.stock - b.stock)
      if (key === 'avgCost') return dir * (a.avgCost - b.avgCost)
      return dir * a.label.localeCompare(b.label)
    })
    return rows
  })()

  const pagedStockRows = (() => {
    const start = (stockList.state.page - 1) * stockList.state.pageSize
    const end = start + stockList.state.pageSize
    return stockRows.slice(start, end)
  })()

  const filteredHistoryTxs = (() => {
    const needle = historyList.state.q.trim().toLowerCase()
    const { startMs, endMs } = rangeMs(historyList.state.filters.from, historyList.state.filters.to)
    const locFilter = historyList.state.filters.locationId
    const typeFilter = historyList.state.filters.type

    const base = txs.filter((t) => {
      if (locFilter !== 'all' && t.locationId !== locFilter) return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      const ms = toMs(t.createdAt)
      if (startMs != null && ms < startMs) return false
      if (endMs != null && ms > endMs) return false
      if (!needle) return true
      const sku = skusById.get(t.skuId)
      const productName = sku ? productsById.get(sku.productId) ?? sku.productId : ''
      const hay = [t.code, t.note, t.type, sku?.skuCode ?? '', productName].join(' ').toLowerCase()
      return hay.includes(needle)
    })

    const dir = historyList.state.sortDir === 'asc' ? 1 : -1
    switch (historyList.state.sortKey) {
      case 'qty':
        base.sort((a, b) => dir * ((a.type === 'out' ? -a.qty : a.qty) - (b.type === 'out' ? -b.qty : b.qty)))
        break
      case 'code':
        base.sort((a, b) => dir * String(a.code).localeCompare(String(b.code)))
        break
      case 'createdAt':
      default:
        base.sort((a, b) => dir * String(a.createdAt).localeCompare(String(b.createdAt)))
        break
    }
    return base
  })()

  const pagedHistoryTxs = (() => {
    const start = (historyList.state.page - 1) * historyList.state.pageSize
    const end = start + historyList.state.pageSize
    return filteredHistoryTxs.slice(start, end)
  })()

  function addTx() {
    if (!canWrite) return
    if (!skuId) return
    if (!locationId) return
    if (type === 'adjust' && !note.trim()) {
      void dialogs.alert({ message: 'Vui lòng nhập lý do điều chỉnh tồn (bắt buộc).' })
      return
    }
    const createdAt = nowIso()
    dispatch({
      type: 'stock/add',
      meta: type === 'adjust' ? { reason: note.trim() } : undefined,
      tx: {
        id: newId('stk'),
        code: '',
        type,
        skuId,
        locationId,
        qty: Number(qty) || 0,
        unitCost: type === 'in' ? Number(unitCost) || 0 : null,
        note: note.trim(),
        entryDate,
        createdAt,
        refType: 'manual',
        refId: null,
        attachments,
      },
    })
    setQty(1)
    setUnitCost(0)
    setEntryDate(new Date().toISOString().slice(0, 10))
    setNote('')
    setAttachments([])
  }

  const toggleSelect = (id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
      })
  }

  const toggleSelectAll = () => {
      if (selectedIds.size === pagedStockRows.length && pagedStockRows.length > 0) {
          setSelectedIds(new Set())
      } else {
          setSelectedIds(new Set(pagedStockRows.map(r => r.sku.id)))
      }
  }

  const stats = useMemo(() => {
     const totalItems = skus.length
     const totalStock = stockRows.reduce((acc, r) => acc + r.stock, 0)
     const totalValue = stockRows.reduce((acc, r) => acc + (r.stock * r.avgCost), 0)
     const lowStock = lowStockSkus.length
     return { totalItems, totalStock, totalValue, lowStock }
  }, [skus.length, stockRows, lowStockSkus.length])

  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
      <PageHeader title="Quản lý kho" />

      {/* KPI Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
               <Database size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Giá trị tồn kho</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{formatVnd(stats.totalValue)}</div>
            </div>
         </div>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-50)', color: 'var(--success-600)' }}>
               <ArrowUp size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Tổng số lượng</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.totalStock}</div>
            </div>
         </div>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--info-50)', color: 'var(--info-600)' }}>
               <AlertTriangle size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Sản phẩm (SKU)</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.totalItems}</div>
            </div>
         </div>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, border: stats.lowStock > 0 ? '2px solid var(--warning)' : undefined }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--warning-50)', color: 'var(--warning-600)' }}>
               <AlertTriangle size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Cảnh báo tồn thấp</div>
               <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning-700)' }}>{stats.lowStock}</div>
            </div>
         </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
          {/* Left Panel: Current Stock */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-title">Tồn kho hiện tại</div>
            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div className="field">
                <select value={locationId} onChange={(e) => stockList.patchFilters({ locationId: e.target.value })} style={{ fontSize: 13, padding: '6px 8px' }}>
                  {(user?.role === 'admin' || user?.role === 'manager') && <option value="all">Tất cả kho</option>}
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locationLabel(l)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <input
                  value={stockList.state.q}
                  onChange={(e) => stockList.patch({ q: e.target.value })}
                  placeholder="Tìm SKU..."
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
            </div>
            
            <div className="table-wrap" style={{ flex: 1, minHeight: 0 }}>
              <table className="table sticky-header">
                <thead>
                  <tr>
                    <th className="sticky-col-1" style={{ width: 40 }}>
                        <div onClick={toggleSelectAll} style={{ cursor: 'pointer' }}>
                            {selectedIds.size > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                    </th>
                    <th className="sticky-col-2">SKU</th>
                    <th>Sản phẩm</th>
                    <th>Tồn</th>
                    <th>Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStockRows.map((r) => (
                    <StockRow
                      key={r.sku.id}
                      sku={r.sku}
                      productName={productsById.get(r.sku.productId) ?? r.sku.productId}
                      stock={r.stock}
                      avgCost={r.avgCost}
                      selected={selectedIds.has(r.sku.id)}
                      onSelect={() => toggleSelect(r.sku.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            
            <Pagination
              page={stockList.state.page}
              pageSize={stockList.state.pageSize}
              totalItems={stockRows.length}
              onChangePage={(page) => stockList.patch({ page })}
            />
          </div>

          {/* Right Panel: Add Transaction & History */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {canWrite && (
              <div style={{ marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                 <div className="card-title" style={{ fontSize: 14 }}>Nhập / Xuất nhanh</div>
                 
                 {/* Tabs for In/Out/Adjust */}
                 <div className="tabs" style={{ marginBottom: 16 }}>
                    <button className={`tab ${type === 'in' ? 'active' : ''}`} onClick={() => setType('in')}>
                        <LogIn size={14} /> Nhập kho
                    </button>
                    <button className={`tab ${type === 'out' ? 'active' : ''}`} onClick={() => setType('out')}>
                        <LogOut size={14} /> Xuất kho
                    </button>
                    <button className={`tab ${type === 'adjust' ? 'active' : ''}`} onClick={() => setType('adjust')}>
                        <RefreshCw size={14} /> Điều chỉnh
                    </button>
                 </div>

                 <div className="grid-form" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                    <div className="field">
                       <label style={{ fontSize: 11 }}>Sản phẩm (SKU)</label>
                       <select value={skuId} onChange={(e) => setSkuId(e.target.value)} style={{ fontSize: 13, padding: '8px' }}>
                         {skus.map((s) => (
                           <option key={s.id} value={s.id}>{skuLabel(productsById, s)}</option>
                         ))}
                       </select>
                    </div>
                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div className="field">
                           <label style={{ fontSize: 11 }}>Số lượng</label>
                           <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ fontSize: 13, padding: '8px' }} />
                        </div>
                        {type === 'in' && (
                             <div className="field">
                               <label style={{ fontSize: 11 }}>Giá nhập</label>
                               <input type="number" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} style={{ fontSize: 13, padding: '8px' }} />
                            </div>
                        )}
                    </div>
                    <div className="field">
                        <label style={{ fontSize: 11 }}>Ghi chú</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ fontSize: 13, padding: '8px' }} />
                    </div>
                    <button className="btn btn-primary" onClick={addTx} style={{ height: 36 }}>
                         {type === 'in' ? 'Nhập kho' : type === 'out' ? 'Xuất kho' : 'Cập nhật tồn'}
                    </button>
                 </div>
              </div>
            )}
            
            <div className="card-title" style={{ fontSize: 14 }}>Lịch sử gần đây</div>
            <div className="table-wrap" style={{ flex: 1, minHeight: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Loại</th>
                    <th>SL</th>
                    <th>SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistoryTxs.slice(0, 15).map((t) => { // Show max 15 recent
                    const sku = skusById.get(t.skuId)
                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12 }} className="text-muted">{formatDateTime(t.createdAt)}</td>
                        <td>
                            <span className={`badge ${t.type === 'in' ? 'badge-success' : t.type === 'out' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                {t.type === 'in' ? 'Nhập' : t.type === 'out' ? 'Xuất' : 'ĐC'}
                            </span>
                        </td>
                        <td style={{ fontWeight: 600, color: t.type === 'out' ? 'var(--danger)' : 'var(--success)' }}>
                            {t.type === 'out' ? -t.qty : t.qty}
                        </td>
                        <td style={{ fontSize: 12 }}>{sku?.skuCode}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
      </div>
      
      <style>{`
        .sticky-col-1 {
            position: sticky;
            left: 0;
            z-index: 10;
            background: var(--bg-surface);
            border-right: 1px solid var(--border-color);
        }
        .sticky-col-2 {
            position: sticky;
            left: 48px;
            z-index: 10;
            background: var(--bg-surface);
            border-right: 1px solid var(--border-color);
        }
        .tr-selected td {
            background: var(--primary-50);
        }
      `}</style>
    </div>
  )
}

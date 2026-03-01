import { memo, useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { prevMonthRange, soldQtyBySku } from '../domain/analytics'
import type { Location, Sku, StockTransaction, StockTxType, StockTransactionAttachment } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { exportCsv, exportXlsx } from '../lib/export'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { useDialogs } from '../ui-kit/Dialogs'
import { Upload, X, Paperclip } from 'lucide-react'
import { useSettings } from '../settings/useSettings'
import { validateAttachmentFiles } from '../lib/attachments'
import { useListView } from '../ui-kit/listing/useListView'
import { Pagination } from '../ui-kit/listing/Pagination'
import { SavedViewsBar } from '../ui-kit/listing/SavedViewsBar'

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
}) {
  const { sku, productName, stock, avgCost } = props
  return (
    <tr>
      <td>
        {productName} ({sku.skuCode})
      </td>
      <td>{stock}</td>
      <td>{formatVnd(avgCost)}</td>
    </tr>
  )
})

const HistoryRow = memo(function HistoryRow(props: {
  tx: StockTransaction
  sku: Sku | undefined
  loc: Location | null
  productName: string
}) {
  const { tx, sku, loc, productName } = props
  return (
    <tr>
      <td style={{ fontFamily: 'monospace' }}>{tx.code}</td>
      <td>{formatDateTime(tx.createdAt)}</td>
      <td>
        {productName} {sku ? `(${sku.skuCode})` : tx.skuId}
      </td>
      <td>{loc ? loc.code : ''}</td>
      <td>{tx.type === 'in' ? 'Nhập' : tx.type === 'out' ? 'Xuất' : 'Điều chỉnh'}</td>
      <td>{tx.type === 'out' ? -tx.qty : tx.qty}</td>
      <td>
        <div>{tx.note}</div>
        {tx.attachments && tx.attachments.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {tx.attachments.map(a => (
              <a 
                key={a.id} 
                href={a.dataUrl} 
                target="_blank" 
                rel="noreferrer"
                className="badge badge-neutral"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Paperclip size={12} /> {a.name}
              </a>
            ))}
          </div>
        )}
      </td>
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

  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )

  const stockList = useListView<StockListFilters>('inventory:stock', {
    q: '',
    sortKey: 'sku',
    sortDir: 'asc',
    page: 1,
    pageSize: 50,
    filters: {
      locationId: locations[0]?.id ?? '',
    },
  })

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
  const locationsById = useMemo(() => new Map(state.locations.map((l) => [l.id, l])), [state.locations])
  const txs = useMemo(
    () => state.stockTransactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.stockTransactions],
  )

  function exportStock(kind: 'csv' | 'xlsx') {
    const rows = stockRows.map((r) => ({
      SKU: r.label,
      'Mã SKU': r.sku.skuCode,
      Tồn: r.stock,
      'Giá vốn TB': r.avgCost,
      'Vị trí': locationsById.get(locationId)?.code ?? '',
    }))
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    if (kind === 'csv') exportCsv(`ton-kho-${stamp}.csv`, rows)
    else exportXlsx(`ton-kho-${stamp}.xlsx`, 'TonKho', rows)
  }

  function exportStockHistory(kind: 'csv' | 'xlsx') {
    const rows = filteredHistoryTxs.map((t) => ({
      'Mã': t.code,
      Ngày: t.createdAt,
      SKU: skusById.get(t.skuId)?.skuCode ?? t.skuId,
      'Vị trí': t.locationId ? locationsById.get(t.locationId)?.code ?? '' : '',
      Loại: t.type,
      'Số lượng': t.qty,
      'Giá nhập': t.unitCost ?? '',
      'Ghi chú': t.note,
      'Tham chiếu': `${t.refType}${t.refId ? `:${t.refId}` : ''}`,
    }))
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    if (kind === 'csv') exportCsv(`lich-su-kho-${stamp}.csv`, rows)
    else exportXlsx(`lich-su-kho-${stamp}.xlsx`, 'LichSuKho', rows)
  }

  const [skuId, setSkuId] = useState(skus[0]?.id ?? '')
  const locationId = stockList.state.filters.locationId
  const [type, setType] = useState<StockTxType>('in')
  const [qty, setQty] = useState<number>(1)
  const [unitCost, setUnitCost] = useState<number>(0)
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState<StockTransactionAttachment[]>([])

  const stockQtyAtLocationBySkuId = (() => {
    const m = new Map<string, number>()
    if (!locationId) return m
    state.stockTransactions.forEach((t) => {
      if (t.locationId !== locationId) return
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  })()

  const locationStats = useMemo(() => {
    const locId = stockList.state.filters.locationId
    const internalOrders = state.orders.filter(o => o.type === 'internal' && (o.status === 'shipped' || o.status === 'delivered' || o.status === 'paid'))
    
    let revenue = 0
    let shippedQty = 0
    
    internalOrders.forEach(o => {
      // Filter by location if selected
      const oLocId = o.fulfillmentLocationId ?? locations.find(l => l.active)?.id
      if (locId && oLocId !== locId) return

      // Revenue
      revenue += (o.subTotalOverride ?? o.items.reduce((s, i) => s + i.price * i.qty, 0)) - (Number(o.discountAmount) || 0)

      // Shipped Qty
      shippedQty += o.items.reduce((s, i) => s + i.qty, 0)
    })

    return { revenue, shippedQty }
  }, [stockList.state.filters.locationId, state.orders, locations])

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
    const rows = skus
      .map((s) => {
        const stock = stockQtyAtLocationBySkuId.get(s.id) ?? 0
        const avgCost = averageCostBySkuId.get(s.id) ?? 0
        const label = skuLabel(productsById, s)
        return { sku: s, label, stock, avgCost }
      })
      .filter((r) => {
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

  

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    const validated = validateAttachmentFiles(e.target.files)
    if (!validated.ok) {
      await dialogs.alert({ message: validated.error })
      e.target.value = ''
      return
    }
    const files = validated.files
    const newAttachments: StockTransactionAttachment[] = []
    
    for (const file of files) {
      const reader = new FileReader()
      const p = new Promise<StockTransactionAttachment>((resolve) => {
        reader.onload = (evt) => {
          resolve({
            id: newId('att'),
            name: file.name,
            dataUrl: evt.target?.result as string,
            createdAt: nowIso()
          })
        }
        reader.readAsDataURL(file)
      })
      newAttachments.push(await p)
    }
    
    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = '' 
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

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
        createdAt,
        refType: 'manual',
        refId: null,
        attachments,
      },
    })
    setQty(1)
    setUnitCost(0)
    setNote('')
    setAttachments([])
  }

  return (
    <div className="page">
      <PageHeader title="Quản lý kho" />

      <div className="row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => exportStock('xlsx')}>
          Xuất tồn Excel
        </button>
        <button className="btn" onClick={() => exportStock('csv')}>
          Xuất tồn CSV
        </button>
        <button className="btn" onClick={() => exportStockHistory('xlsx')}>
          Xuất lịch sử Excel
        </button>
        <button className="btn" onClick={() => exportStockHistory('csv')}>
          Xuất lịch sử CSV
        </button>
      </div>

      {lowStockSkus.length ? (
        <div className="card">
          <div className="card-title">Cảnh báo tồn kho thấp</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Tồn</th>
                  <th>Bán kỳ trước</th>
                </tr>
              </thead>
              <tbody>
                {lowStockSkus.map((s) => {
                  const stock = stockQtyBySkuId.get(s.id) ?? 0
                  const soldPrev = soldPrevBySkuId.get(s.id) ?? 0
                  return (
                    <tr key={s.id}>
                      <td>{skuLabel(productsById, s)}</td>
                      <td>{stock}</td>
                      <td>{soldPrev}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="card">
          <div className="card-title">Ghi nhận nhập/xuất/điều chỉnh</div>
          <div className="grid-form">
            <div className="field">
              <label>SKU</label>
              <select value={skuId} onChange={(e) => setSkuId(e.target.value)}>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {skuLabel(productsById, s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vị trí kho</label>
              <select value={locationId} onChange={(e) => stockList.patchFilters({ locationId: e.target.value })}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Loại</label>
              <select value={type} onChange={(e) => setType(e.target.value as StockTxType)}>
                <option value="in">Nhập</option>
                <option value="out">Xuất</option>
                <option value="adjust">Điều chỉnh (+/-)</option>
              </select>
            </div>
            <div className="field">
              <label>Số lượng</label>
              <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Giá nhập</label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                disabled={type !== 'in'}
              />
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field">
                <label>Chứng từ / Ảnh</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="btn btn-small" style={{ cursor: 'pointer' }}>
                    <Upload size={14} /> Chọn file
                    <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                  </label>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {attachments.length} file đã chọn
                  </span>
                </div>
                {attachments.length > 0 && (
                   <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {attachments.map(a => (
                        <div key={a.id} className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {a.name}
                          <button 
                            onClick={() => removeAttachment(a.id)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                   </div>
                )}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={addTx}>
              Ghi nhận
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Tồn kho hiện tại</div>
        <div className="row">
          <div className="field" style={{ width: 320 }}>
            <label>Vị trí kho</label>
            <select value={locationId} onChange={(e) => stockList.patchFilters({ locationId: e.target.value })}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {locationLabel(l)}
                </option>
              ))}
            </select>
            {locationId && (
              <div className="hint" style={{ marginTop: 4 }}>
                <div>Doanh thu kho: <b>{formatVnd(locationStats.revenue)}</b></div>
                <div>Số lượng xuất: <b>{locationStats.shippedQty}</b> sp</div>
              </div>
            )}
          </div>
          <div className="field" style={{ width: 320 }}>
            <label>Tìm kiếm SKU</label>
            <input
              value={stockList.state.q}
              onChange={(e) => stockList.patch({ q: e.target.value })}
              placeholder="Tên, mã SKU…"
            />
          </div>
          <div className="field" style={{ width: 220 }}>
            <label>Sắp xếp</label>
            <select value={stockList.state.sortKey} onChange={(e) => stockList.patch({ sortKey: e.target.value })}>
              <option value="sku">SKU</option>
              <option value="stock">Tồn</option>
              <option value="avgCost">Giá vốn TB</option>
            </select>
          </div>
          <div className="field" style={{ width: 200 }}>
            <label>Chiều</label>
            <select value={stockList.state.sortDir} onChange={(e) => stockList.patch({ sortDir: e.target.value as 'asc' | 'desc' })}>
              <option value="asc">Tăng dần</option>
              <option value="desc">Giảm dần</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Saved views</label>
            <SavedViewsBar
              views={stockList.views}
              onApply={stockList.applyView}
              onSave={stockList.saveCurrentAs}
              onDelete={stockList.deleteView}
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn" onClick={stockList.reset}>
              Reset
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Tồn</th>
                <th>Giá vốn TB</th>
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
          onChangePageSize={(pageSize) => stockList.patch({ pageSize })}
        />
      </div>

      <div className="card">
        <div className="card-title">Lịch sử</div>

        <div className="grid-form" style={{ marginBottom: 12 }}>
          <div className="field field-span-2">
            <label>Tìm kiếm</label>
            <input
              value={historyList.state.q}
              onChange={(e) => historyList.patch({ q: e.target.value })}
              placeholder="Mã phiếu, SKU, ghi chú…"
            />
          </div>
          <div className="field">
            <label>Kho</label>
            <select
              value={historyList.state.filters.locationId}
              onChange={(e) => historyList.patchFilters({ locationId: e.target.value as 'all' | string })}
            >
              <option value="all">Tất cả</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {locationLabel(l)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Loại</label>
            <select
              value={historyList.state.filters.type}
              onChange={(e) => historyList.patchFilters({ type: e.target.value as 'all' | StockTxType })}
            >
              <option value="all">Tất cả</option>
              <option value="in">Nhập</option>
              <option value="out">Xuất</option>
              <option value="adjust">Điều chỉnh</option>
            </select>
          </div>
          <div className="field">
            <label>Từ ngày</label>
            <input type="date" value={historyList.state.filters.from} onChange={(e) => historyList.patchFilters({ from: e.target.value })} />
          </div>
          <div className="field">
            <label>Đến ngày</label>
            <input type="date" value={historyList.state.filters.to} onChange={(e) => historyList.patchFilters({ to: e.target.value })} />
          </div>
          <div className="field">
            <label>Sắp xếp</label>
            <select value={historyList.state.sortKey} onChange={(e) => historyList.patch({ sortKey: e.target.value })}>
              <option value="createdAt">Ngày</option>
              <option value="code">Mã</option>
              <option value="qty">Số lượng</option>
            </select>
          </div>
          <div className="field">
            <label>Chiều</label>
            <select value={historyList.state.sortDir} onChange={(e) => historyList.patch({ sortDir: e.target.value as 'asc' | 'desc' })}>
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </div>
          <div className="field field-span-2">
            <label>Saved views</label>
            <SavedViewsBar
              views={historyList.views}
              onApply={historyList.applyView}
              onSave={historyList.saveCurrentAs}
              onDelete={historyList.deleteView}
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn" onClick={historyList.reset}>
              Reset
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ngày</th>
                <th>SKU</th>
                <th>Vị trí</th>
                <th>Loại</th>
                <th>Số lượng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {pagedHistoryTxs.map((t) => {
                const sku = skusById.get(t.skuId)
                const loc = t.locationId ? (locationsById.get(t.locationId) ?? null) : null
                return (
                  <HistoryRow
                    key={t.id}
                    tx={t}
                    sku={sku}
                    loc={loc}
                    productName={sku ? (productsById.get(sku.productId) ?? sku.productId) : ''}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={historyList.state.page}
          pageSize={historyList.state.pageSize}
          totalItems={filteredHistoryTxs.length}
          onChangePage={(page) => historyList.patch({ page })}
          onChangePageSize={(pageSize) => historyList.patch({ pageSize })}
        />
      </div>
    </div>
  )
}

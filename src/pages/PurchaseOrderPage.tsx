import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Pagination } from '../ui-kit/listing/Pagination'
import { useListView } from '../ui-kit/listing/useListView'
import { useDialogs } from '../ui-kit/Dialogs'

type Filters = {
  status: 'all' | PurchaseOrderStatus
}

function statusLabel(s: PurchaseOrderStatus): string {
  if (s === 'draft') return 'Nháp'
  if (s === 'ordered') return 'Đã đặt'
  if (s === 'received') return 'Đã nhập kho'
  if (s === 'cancelled') return 'Hủy'
  return s
}

export function PurchaseOrderPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canWrite = can('products:read') // Using products:read as per menu config, ideally products:write or purchase:write
  const dialogs = useDialogs()

  const locations = useMemo(() => state.locations.filter(l => l.active), [state.locations])
  const suppliers = useMemo(() => state.suppliers, [state.suppliers])
  const skus = useMemo(() => state.skus.filter(s => s.active && s.kind === 'single'), [state.skus])
  
  const suppliersById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers])
  const locationsById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])
  const productsById = useMemo(() => new Map(state.products.map(p => [p.id, p])), [state.products])
  const skusById = useMemo(() => new Map(skus.map(s => [s.id, s])), [skus])

  const list = useListView<Filters>('purchase_orders', {
    q: '',
    sortKey: 'createdAt',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    filters: { status: 'all' }
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => selectedId ? state.purchaseOrders.find(o => o.id === selectedId) ?? null : null, [selectedId, state.purchaseOrders])

  const items = useMemo(() => {
    const needle = list.state.q.trim().toLowerCase()
    return state.purchaseOrders
      .filter(o => list.state.filters.status === 'all' || o.status === list.state.filters.status)
      .filter(o => !needle || o.code.toLowerCase().includes(needle) || suppliersById.get(o.supplierId)?.name.toLowerCase().includes(needle))
      .sort((a, b) => (list.state.sortDir === 'asc' ? 1 : -1) * (a.createdAt.localeCompare(b.createdAt)))
  }, [state.purchaseOrders, list.state, suppliersById])

  const paged = useMemo(() => {
    const start = (list.state.page - 1) * list.state.pageSize
    return items.slice(start, start + list.state.pageSize)
  }, [items, list.state.page, list.state.pageSize])

  function create() {
    if (!canWrite) return
    const now = nowIso()
    const po: PurchaseOrder = {
      id: newId('po'),
      code: `PO-${now.slice(2, 7).replace('-', '')}-${Math.floor(Math.random() * 1000)}`,
      status: 'draft',
      supplierId: suppliers[0]?.id ?? '',
      warehouseId: locations[0]?.id ?? '',
      items: [],
      totalAmount: 0,
      note: '',
      createdAt: now,
      updatedAt: now
    }
    dispatch({ type: 'purchaseOrders/upsert', order: po })
    setSelectedId(po.id)
  }

  function update(patch: Partial<PurchaseOrder>) {
    if (!selected || !canWrite) return
    const next = { ...selected, ...patch, updatedAt: nowIso() }
    // Recalculate total
    next.totalAmount = next.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0)
    dispatch({ type: 'purchaseOrders/upsert', order: next })
  }

  function updateLine(idx: number, patch: Partial<PurchaseOrderLine>) {
    if (!selected) return
    const newItems = [...selected.items]
    newItems[idx] = { ...newItems[idx], ...patch }
    
    // Recalculate total immediately for this update
    const next = { ...selected, items: newItems, updatedAt: nowIso() }
    next.totalAmount = next.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0)
    
    dispatch({ type: 'purchaseOrders/upsert', order: next })
  }

  function addLine() {
    if (!selected) return
    const sku = skus[0]
    const newItem: PurchaseOrderLine = { skuId: sku?.id ?? '', qty: 1, unitCost: sku?.cost ?? 0, receivedQty: 0 }
    
    const next = { ...selected, items: [...selected.items, newItem], updatedAt: nowIso() }
    next.totalAmount = next.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0)
    
    dispatch({ type: 'purchaseOrders/upsert', order: next })
  }

  function removeLine(idx: number) {
    if (!selected) return
    const newItems = selected.items.filter((_, i) => i !== idx)
    
    const next = { ...selected, items: newItems, updatedAt: nowIso() }
    next.totalAmount = next.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0)
    
    dispatch({ type: 'purchaseOrders/upsert', order: next })
  }

  async function remove() {
    if (!selected || !canWrite) return
    const ok = await dialogs.confirm({ message: 'Xóa đơn mua hàng này?', dangerous: true })
    if (ok) {
        dispatch({ type: 'purchaseOrders/delete', id: selected.id })
        setSelectedId(null)
    }
  }

  function skuLabel(skuId: string) {
      const sku = skusById.get(skuId)
      if (!sku) return skuId
      const p = productsById.get(sku.productId)
      return `${p?.name} (${sku.skuCode})`
  }

  return (
    <div className="page">
      <PageHeader title="Đơn mua hàng" />
      
      <div className="card">
        <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
                <input 
                    placeholder="Tìm kiếm..." 
                    value={list.state.q} 
                    onChange={e => list.patch({ q: e.target.value })}
                    style={{ width: 200 }}
                />
                <select 
                    value={list.state.filters.status}
                    onChange={e => list.patchFilters({ status: e.target.value as any })}
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="draft">Nháp</option>
                    <option value="ordered">Đã đặt</option>
                    <option value="received">Đã nhập</option>
                </select>
            </div>
            {canWrite && <button className="btn btn-primary" onClick={create}>+ Tạo đơn</button>}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
            <table className="table">
                <thead>
                    <tr>
                        <th>Mã</th>
                        <th>NCC</th>
                        <th>Kho nhập</th>
                        <th>Trạng thái</th>
                        <th>Tổng tiền</th>
                        <th>Ngày tạo</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {paged.map(po => (
                        <tr key={po.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.code}</td>
                            <td>{suppliersById.get(po.supplierId)?.name ?? po.supplierId}</td>
                            <td>{locationsById.get(po.warehouseId)?.name ?? po.warehouseId}</td>
                            <td>{statusLabel(po.status)}</td>
                            <td>{po.totalAmount.toLocaleString()}</td>
                            <td>{po.createdAt.slice(0, 10)}</td>
                            <td className="cell-actions">
                                <button className="btn btn-small" onClick={() => setSelectedId(po.id)}>Xem</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <Pagination 
            page={list.state.page} 
            pageSize={list.state.pageSize} 
            totalItems={items.length} 
            onChangePage={p => list.patch({ page: p })}
            onChangePageSize={p => list.patch({ pageSize: p })}
        />
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelectedId(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 900, maxWidth: '95vw' }}>
                <div className="row-between" style={{ marginBottom: 16 }}>
                    <h3>Đơn mua hàng: {selected.code}</h3>
                    <div className="row" style={{ gap: 8 }}>
                        {selected.status === 'draft' && <button className="btn btn-danger" onClick={remove}>Xóa</button>}
                        <button className="btn" onClick={() => setSelectedId(null)}>Đóng</button>
                    </div>
                </div>

                <div className="grid-form">
                    <div className="field">
                        <label>Nhà cung cấp</label>
                        <select 
                            value={selected.supplierId} 
                            onChange={e => update({ supplierId: e.target.value })}
                            disabled={selected.status !== 'draft'}
                        >
                            <option value="">Chọn NCC</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label>Kho nhập</label>
                        <select 
                            value={selected.warehouseId} 
                            onChange={e => update({ warehouseId: e.target.value })}
                            disabled={selected.status !== 'draft'}
                        >
                            <option value="">Chọn kho</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label>Trạng thái</label>
                        <select 
                            value={selected.status} 
                            onChange={e => update({ status: e.target.value as any })}
                        >
                            <option value="draft">Nháp</option>
                            <option value="ordered">Đã đặt hàng</option>
                            <option value="received">Đã nhập kho</option>
                            <option value="cancelled">Hủy</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>Ghi chú</label>
                        <input value={selected.note} onChange={e => update({ note: e.target.value })} />
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16, marginBottom: 0 }}>
                    <div className="row-between" style={{ marginBottom: 8 }}>
                        <h4>Chi tiết hàng hóa</h4>
                        {selected.status === 'draft' && <button className="btn btn-small" onClick={addLine}>+ Thêm dòng</button>}
                    </div>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Sản phẩm (SKU)</th>
                                    <th style={{ width: 100 }}>SL Đặt</th>
                                    <th style={{ width: 120 }}>Đơn giá</th>
                                    <th style={{ width: 120 }}>Thành tiền</th>
                                    {selected.status === 'received' && <th style={{ width: 100 }}>SL Nhập</th>}
                                    <th style={{ width: 50 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {selected.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <select 
                                                value={item.skuId} 
                                                onChange={e => {
                                                    const s = skusById.get(e.target.value)
                                                    updateLine(idx, { skuId: e.target.value, unitCost: s?.cost ?? 0 })
                                                }}
                                                disabled={selected.status !== 'draft'}
                                                style={{ width: '100%' }}
                                            >
                                                {skus.map(s => (
                                                    <option key={s.id} value={s.id}>{skuLabel(s.id)}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input 
                                                type="number" 
                                                value={item.qty} 
                                                onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                disabled={selected.status !== 'draft'}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number" 
                                                value={item.unitCost} 
                                                onChange={e => updateLine(idx, { unitCost: Number(e.target.value) })}
                                                disabled={selected.status !== 'draft'}
                                            />
                                        </td>
                                        <td>
                                            {(item.qty * item.unitCost).toLocaleString()}
                                        </td>
                                        {selected.status === 'received' && (
                                            <td>
                                                <input 
                                                    type="number" 
                                                    value={item.receivedQty} 
                                                    onChange={e => updateLine(idx, { receivedQty: Number(e.target.value) })}
                                                />
                                            </td>
                                        )}
                                        <td className="cell-actions">
                                            {selected.status === 'draft' && (
                                                <button className="btn btn-small btn-danger" onClick={() => removeLine(idx)}>X</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Tổng cộng:</td>
                                    <td style={{ fontWeight: 700 }}>{selected.totalAmount.toLocaleString()}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

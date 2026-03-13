import { ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import type { StockVoucher, StockVoucherLine, StockVoucherStatus, StockVoucherType } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { Pagination } from '../ui-kit/listing/Pagination'
import { SavedViewsBar } from '../ui-kit/listing/SavedViewsBar'
import { useListView } from '../ui-kit/listing/useListView'
import { useDialogs } from '../ui-kit/Dialogs'
import { differenceInDays, parseISO } from 'date-fns'

type VoucherFilters = {
  type: 'all' | StockVoucherType
  status: 'all' | StockVoucherStatus
  dateRange: 'all' | 'today' | '7d' | '30d'
}

function VoucherTypeBadge({ type }: { type: StockVoucherType }) {
  if (type === 'in') return <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ArrowDownCircle size={14} /> Nhập kho</span>
  if (type === 'out') return <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUpCircle size={14} /> Xuất kho</span>
  return <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={14} /> Điều chuyển</span>
}

function voucherStatusLabel(s: StockVoucherStatus): string {
  if (s === 'draft') return 'Nháp'
  if (s === 'submitted') return 'Chờ duyệt'
  if (s === 'posted' || s === 'final') return 'Đã ghi sổ'
  return 'Hủy'
}

function effectiveVoucherStatus(s: StockVoucherStatus): Exclude<StockVoucherStatus, 'final'> {
  if (s === 'final') return 'posted'
  return s
}

function toMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

export function StockVouchersPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can, user } = useAuth()
  const canWrite = can('inventory:write')
  const isAdmin = user?.role === 'admin'
  const canApproveVoucher = user?.role === 'admin' || user?.role === 'manager'
  const nav = useNavigate()
  const location = useLocation()
  const dialogs = useDialogs()

  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )
  const skus = useMemo(
    () => state.skus.filter((s) => s.active && s.kind === 'single').slice().sort((a, b) => a.skuCode.localeCompare(b.skuCode)),
    [state.skus],
  )
  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const locationsById = useMemo(() => new Map(state.locations.map((l) => [l.id, l])), [state.locations])
  const skusById = useMemo(() => new Map(state.skus.map((s) => [s.id, s])), [state.skus])

  const list = useListView<VoucherFilters>('stock_vouchers', {
    q: '',
    sortKey: 'createdAt',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    filters: { type: 'all', status: 'all', dateRange: 'all' },
  })

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const openId = (location.state as { openId?: string } | null)?.openId
    return openId ?? null
  })
  const selected = useMemo(
    () => (selectedId ? state.stockVouchers.find((v) => v.id === selectedId) ?? null : null),
    [selectedId, state.stockVouchers],
  )

  function closeSelected() {
    setSelectedId(null)
    const openId = (location.state as { openId?: string } | null)?.openId
    if (openId) nav(location.pathname, { replace: true, state: null })
  }

  const vouchers = useMemo(() => {
    const needle = list.state.q.trim().toLowerCase()
    const now = new Date()
    
    const filtered = state.stockVouchers
      .filter((v) => (list.state.filters.type === 'all' ? true : v.type === list.state.filters.type))
      .filter((v) => (list.state.filters.status === 'all' ? true : effectiveVoucherStatus(v.status) === list.state.filters.status))
      .filter((v) => {
          if (list.state.filters.dateRange === 'all') return true
          const d = parseISO(v.createdAt)
          const diff = differenceInDays(now, d)
          if (list.state.filters.dateRange === 'today') return diff === 0
          if (list.state.filters.dateRange === '7d') return diff <= 7
          if (list.state.filters.dateRange === '30d') return diff <= 30
          return true
      })
      .filter((v) => {
        if (!needle) return true
        const hay = [v.code, v.type, v.status, v.note].join(' ').toLowerCase()
        return hay.includes(needle)
      })
      .slice()
      .sort((a, b) => {
        const dir = list.state.sortDir === 'asc' ? 1 : -1
        if (list.state.sortKey === 'code') return dir * String(a.code).localeCompare(String(b.code))
        return dir * (toMs(String(a.createdAt)) - toMs(String(b.createdAt)))
      })
    return filtered
  }, [list.state.filters, list.state.q, list.state.sortDir, list.state.sortKey, state.stockVouchers])

  const paged = useMemo(() => {
    const start = (list.state.page - 1) * list.state.pageSize
    const end = start + list.state.pageSize
    return vouchers.slice(start, end)
  }, [list.state.page, list.state.pageSize, vouchers])

  function skuLabel(skuId: string): string {
    const sku = skusById.get(skuId)
    if (!sku) return skuId
    const productName = productsById.get(sku.productId) ?? sku.productId
    const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
    return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
  }

  function createVoucher() {
    if (!canWrite) return
    const createdAt = nowIso()
    const v: StockVoucher = {
      id: newId('vch'),
      code: '',
      type: 'in',
      status: 'draft',
      fromLocationId: null,
      toLocationId: locations[0]?.id ?? null,
      note: '',
      createdAt,
      createdByUserId: state.currentUserId,
      finalizedAt: null,
      lines: [],
    }
    dispatch({ type: 'stockVouchers/upsert', voucher: v })
    setSelectedId(v.id)
  }

  function updateSelected(patch: Partial<StockVoucher>) {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    dispatch({ type: 'stockVouchers/upsert', voucher: { ...selected, ...patch } })
  }

  function addLine() {
    if (!selected) return
    if (selected.status !== 'draft') return
    const next: StockVoucherLine = {
      skuId: skus[0]?.id ?? '',
      qty: 1,
      unitCost: selected.type === 'out' ? null : 0,
      note: '',
    }
    updateSelected({ lines: [...selected.lines, next] })
  }

  function updateLine(idx: number, patch: Partial<StockVoucherLine>) {
    if (!selected) return
    const lines = selected.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    updateSelected({ lines })
  }

  function removeLine(idx: number) {
    if (!selected) return
    updateSelected({ lines: selected.lines.filter((_, i) => i !== idx) })
  }

  async function finalizeSelected() {
    if (!canWrite) return
    if (!selected) return
    const reason = await dialogs.prompt({ message: 'Nhập lý do ghi sổ phiếu (khuyến nghị):', initialValue: '' })
    if (reason == null) return
    dispatch({ type: 'stockVouchers/finalize', id: selected.id, meta: { reason: reason.trim() } })
  }

  async function submitSelected() {
    if (!canWrite) return
    if (!selected) return
    const reason = await dialogs.prompt({ message: 'Nhập lý do gửi duyệt (khuyến nghị):', initialValue: '' })
    if (reason == null) return
    dispatch({ type: 'stockVouchers/submit', id: selected.id, meta: { reason: reason.trim() } })
  }

  function cancelSelected() {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    updateSelected({ status: 'cancelled' })
  }

  async function deleteSelected() {
    if (!canWrite) return
    if (!selected) return
    const ok = await dialogs.confirm({ message: `Xóa phiếu ${selected.code || selected.id}?`, dangerous: true })
    if (!ok) return
    const reason = await dialogs.prompt({ message: 'Nhập lý do xóa phiếu (bắt buộc):', required: true })
    if (reason == null) return
    if (!reason.trim()) {
      await dialogs.alert({ message: 'Vui lòng nhập lý do.' })
      return
    }
    dispatch({ type: 'stockVouchers/delete', id: selected.id, meta: { reason: reason.trim() } })
    setSelectedId(null)
  }

  return (
    <div className="page">
      <PageHeader title="Phiếu kho" />

      <div className="card">
        <div className="card-title">Tìm kiếm / lọc</div>
        <div className="grid-form">
          <div className="field field-span-2">
            <label>Tìm kiếm</label>
            <input value={list.state.q} onChange={(e) => list.patch({ q: e.target.value })} placeholder="Mã phiếu, ghi chú…" />
          </div>
          <div className="field">
            <label>Loại</label>
            <select
              value={list.state.filters.type}
              onChange={(e) => list.patchFilters({ type: e.target.value as VoucherFilters['type'] })}
            >
              <option value="all">Tất cả</option>
              <option value="in">Nhập</option>
              <option value="out">Xuất</option>
              <option value="transfer">Điều chuyển</option>
            </select>
          </div>
          <div className="field">
            <label>Trạng thái</label>
            <select
              value={list.state.filters.status}
              onChange={(e) => list.patchFilters({ status: e.target.value as VoucherFilters['status'] })}
            >
              <option value="all">Tất cả</option>
              <option value="draft">Nháp</option>
              <option value="submitted">Chờ duyệt</option>
              <option value="posted">Đã ghi sổ</option>
              <option value="cancelled">Hủy</option>
            </select>
          </div>
          <div className="field">
            <label>Thời gian</label>
            <div className="row" style={{ gap: 4 }}>
                <button className={`btn btn-small ${list.state.filters.dateRange === 'all' ? 'btn-primary' : ''}`} onClick={() => list.patchFilters({ dateRange: 'all' })}>Tất cả</button>
                <button className={`btn btn-small ${list.state.filters.dateRange === 'today' ? 'btn-primary' : ''}`} onClick={() => list.patchFilters({ dateRange: 'today' })}>Hôm nay</button>
                <button className={`btn btn-small ${list.state.filters.dateRange === '7d' ? 'btn-primary' : ''}`} onClick={() => list.patchFilters({ dateRange: '7d' })}>7 ngày</button>
                <button className={`btn btn-small ${list.state.filters.dateRange === '30d' ? 'btn-primary' : ''}`} onClick={() => list.patchFilters({ dateRange: '30d' })}>30 ngày</button>
            </div>
          </div>
          <div className="field">
            <label>Sắp xếp</label>
            <select value={list.state.sortKey} onChange={(e) => list.patch({ sortKey: e.target.value })}>
              <option value="createdAt">Ngày tạo</option>
              <option value="code">Mã phiếu</option>
            </select>
          </div>
          <div className="field">
            <label>Chiều</label>
            <select value={list.state.sortDir} onChange={(e) => list.patch({ sortDir: e.target.value as 'asc' | 'desc' })}>
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </div>
        </div>
        <div className="row row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Hiển thị {vouchers.length} phiếu</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <SavedViewsBar views={list.views} onApply={list.applyView} onSave={list.saveCurrentAs} onDelete={list.deleteView} />
            <button className="btn btn-small" onClick={list.reset}>
              Reset
            </button>
            {canWrite ? (
              <button className="btn btn-primary" onClick={createVoucher}>
                + Tạo phiếu
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Ngày</th>
                <th>Ghi chú</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paged.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v.code || v.id}</td>
                  <td><VoucherTypeBadge type={v.type} /></td>
                  <td>{voucherStatusLabel(v.status)}</td>
                  <td>{v.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  <td>{v.note}</td>
                  <td className="cell-actions">
                    <button className="btn btn-small" onClick={() => setSelectedId(v.id)}>
                      Mở
                    </button>
                    <button className="btn btn-small" onClick={() => nav(`/movements/${v.id}/print`)}>
                      In/PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={list.state.page}
          pageSize={list.state.pageSize}
          totalItems={vouchers.length}
          onChangePage={(page) => list.patch({ page })}
          onChangePageSize={(pageSize) => list.patch({ pageSize })}
        />
      </div>

      {selected ? (
        <div className="modal-overlay" onClick={closeSelected}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 920, maxWidth: '95vw' }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h3>
                Phiếu: <span style={{ fontFamily: 'monospace' }}>{selected.code || selected.id}</span>
              </h3>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => nav(`/movements/${selected.id}/print`)}>
                  In/PDF
                </button>
                {effectiveVoucherStatus(selected.status) === 'draft' && canWrite && !canApproveVoucher ? (
                  <button className="btn btn-primary" onClick={submitSelected}>
                    Gửi duyệt
                  </button>
                ) : null}
                {(effectiveVoucherStatus(selected.status) === 'draft' || effectiveVoucherStatus(selected.status) === 'submitted') && canWrite && canApproveVoucher ? (
                  <button className="btn btn-primary" onClick={finalizeSelected}>
                    Ghi sổ
                  </button>
                ) : null}
                {effectiveVoucherStatus(selected.status) === 'draft' && canWrite ? (
                  <button className="btn" onClick={cancelSelected}>
                    Hủy
                  </button>
                ) : null}
                {effectiveVoucherStatus(selected.status) !== 'posted' && canWrite ? (
                  <button className="btn btn-danger" onClick={deleteSelected}>
                    Xóa
                  </button>
                ) : null}
                <button className="btn" onClick={closeSelected}>
                  Đóng
                </button>
              </div>
            </div>

            <div className="grid-form">
              <div className="field">
                <label>Loại</label>
                <select
                  value={selected.type}
                  onChange={(e) => {
                    const t = e.target.value as StockVoucherType
                    updateSelected({
                      type: t,
                      fromLocationId: t === 'in' ? null : selected.fromLocationId,
                      toLocationId: t === 'out' ? null : selected.toLocationId,
                    })
                  }}
                  disabled={!canWrite || selected.status !== 'draft'}
                >
                  <option value="in">Nhập kho</option>
                  <option value="out">Xuất kho</option>
                  <option value="transfer">Điều chuyển</option>
                </select>
              </div>

              {selected.type !== 'in' ? (
                <div className="field">
                  <label>Kho xuất</label>
                  <select
                    value={selected.fromLocationId ?? ''}
                    onChange={(e) => updateSelected({ fromLocationId: e.target.value || null })}
                    disabled={!canWrite || selected.status !== 'draft'}
                  >
                    <option value="">(Chọn)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {selected.type !== 'out' ? (
                <div className="field">
                  <label>{selected.type === 'transfer' ? 'Kho nhận' : 'Kho nhập'}</label>
                  <select
                    value={selected.toLocationId ?? ''}
                    onChange={(e) => updateSelected({ toLocationId: e.target.value || null })}
                    disabled={!canWrite || selected.status !== 'draft'}
                  >
                    <option value="">(Chọn)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="field field-span-2">
                <label>Ghi chú</label>
                <input value={selected.note} onChange={(e) => updateSelected({ note: e.target.value })} disabled={!canWrite || selected.status !== 'draft'} />
              </div>
              
              {selected.type === 'in' && (
                 <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                    <div className="field">
                      <label>Số hóa đơn (NCC)</label>
                      <input 
                        value={selected.invoiceNumber ?? ''} 
                        onChange={(e) => updateSelected({ invoiceNumber: e.target.value })} 
                        disabled={!canWrite || selected.status !== 'draft'} 
                        placeholder="Số hóa đơn xuất kho..."
                      />
                    </div>
                    <div className="field">
                      <label>Mã VAT</label>
                      <input 
                        value={selected.vat ?? ''} 
                        onChange={(e) => updateSelected({ vat: e.target.value })} 
                        disabled={!canWrite || selected.status !== 'draft'} 
                        placeholder="Mã VAT lô hàng..."
                      />
                    </div>
                 </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Dòng hàng
                </div>
                {selected.status === 'draft' && canWrite ? (
                  <button className="btn btn-small" onClick={addLine}>
                    + Thêm dòng
                  </button>
                ) : null}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th style={{ width: 120 }}>Số lượng</th>
                      {isAdmin && <th style={{ width: 140 }}>Giá nhập</th>}
                      <th>Ghi chú</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l, idx) => (
                      <tr key={`${l.skuId}-${idx}`}>
                        <td>
                          <select
                            value={l.skuId}
                            onChange={(e) => updateLine(idx, { skuId: e.target.value })}
                            disabled={!canWrite || selected.status !== 'draft'}
                          >
                            {skus.map((s) => (
                              <option key={s.id} value={s.id}>
                                {skuLabel(s.id)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={l.qty}
                            onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 0 })}
                            disabled={!canWrite || selected.status !== 'draft'}
                          />
                        </td>
                        {isAdmin && (
                        <td>
                          <input
                            type="number"
                            value={l.unitCost ?? 0}
                            onChange={(e) => updateLine(idx, { unitCost: selected.type === 'out' ? null : Number(e.target.value) || 0 })}
                            disabled={!canWrite || selected.status !== 'draft' || selected.type === 'out'}
                          />
                        </td>
                        )}
                        <td>
                          <input
                            value={l.note}
                            onChange={(e) => updateLine(idx, { note: e.target.value })}
                            disabled={!canWrite || selected.status !== 'draft'}
                          />
                        </td>
                        <td className="cell-actions">
                          {selected.status === 'draft' && canWrite ? (
                            <button className="btn btn-small btn-danger" onClick={() => removeLine(idx)}>
                              Xóa
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                {selected.lines.length} dòng • {selected.type === 'transfer' && selected.fromLocationId
                  ? `Chuyển: ${locationsById.get(selected.fromLocationId)?.code ?? ''} → ${locationsById.get(selected.toLocationId ?? '')?.code ?? ''}`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


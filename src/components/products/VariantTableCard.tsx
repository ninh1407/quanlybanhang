import { useMemo, useState } from 'react'
import { CheckSquare, Edit3, Square } from 'lucide-react'
import type { SkuDraft, SkuDraftErrors, VariantStatusFilter, VariantStockFlag } from './types'
import { VariantBulkEditModal } from './VariantBulkEditModal'
import { VariantTableToolbar } from './VariantTableToolbar'
type BulkField = 'price' | 'cost' | 'unit' | 'active' | 'color' | 'size' | 'material' | 'volume' | 'capacity' | 'power'
type IssueFilter = 'all' | 'has_issue' | 'missing_sku' | 'duplicate_sku' | 'missing_price' | 'missing_cost'
function toUpper(s: string): string {
  return (s || '').trim().toUpperCase()
}
function statusBadge(active: boolean, qty: number): { cls: string; label: string } {
  if (!active) return { cls: 'badge-neutral', label: 'Ngưng' }
  if (qty === 0) return { cls: 'badge-danger', label: 'Hết hàng' }
  if (qty <= 5) return { cls: 'badge-warning', label: 'Tồn thấp' }
  return { cls: 'badge-success', label: 'Đang bán' }
}
function hasDuplicateIssue(messages: string[]): boolean {
  const text = (messages || []).join(' ').toLowerCase()
  return text.includes('trùng') || text.includes('tồn tại')
}
export function VariantTableCard(props: {
  drafts: SkuDraft[]
  onChangeDraft: (skuId: string, patch: Partial<SkuDraft>) => void
  qtyBySkuId: Map<string, number>
  errors: SkuDraftErrors
  onOpenSku: (skuId: string) => void
  onBulkApply: (ids: string[], patch: Partial<SkuDraft>) => void
  onRegenerateSkuCodesFor: (ids: string[]) => void
}) {
  const { drafts, onChangeDraft, qtyBySkuId, errors, onOpenSku, onBulkApply, onRegenerateSkuCodesFor } = props
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<VariantStatusFilter>('all')
  const [stockFlag, setStockFlag] = useState<VariantStockFlag>('all')
  const [issue, setIssue] = useState<IssueFilter>('all')

  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkField, setBulkField] = useState<BulkField>('price')
  const [bulkValueText, setBulkValueText] = useState('')
  const [bulkActive, setBulkActive] = useState<'1' | '0'>('1')

  const filtered = useMemo(() => {
    let list = drafts.slice()
    const query = q.trim().toLowerCase()
    if (query) {
      list = list.filter((d) => {
        return (
          d.skuCode.toLowerCase().includes(query) ||
          (d.color || '').toLowerCase().includes(query) ||
          (d.size || '').toLowerCase().includes(query) ||
          (d.material || '').toLowerCase().includes(query) ||
          (d.volume || '').toLowerCase().includes(query) ||
          (d.capacity || '').toLowerCase().includes(query) ||
          (d.power || '').toLowerCase().includes(query)
        )
      })
    }
    if (status !== 'all') {
      list = list.filter((d) => (status === 'active' ? d.active : !d.active))
    }
    if (stockFlag !== 'all') {
      list = list.filter((d) => {
        const qty = qtyBySkuId.get(d.id) ?? 0
        if (stockFlag === 'out_of_stock') return qty === 0
        if (stockFlag === 'low_stock') return qty > 0 && qty <= 5
        return qty > 0
      })
    }

    if (issue !== 'all') {
      list = list.filter((d) => {
        const rowErrors = errors[d.id] || []
        const code = (d.skuCode || '').trim()
        const price = Number(d.price) || 0
        const cost = Number(d.cost) || 0
        if (issue === 'has_issue') return rowErrors.length > 0 || !code || price <= 0 || cost <= 0
        if (issue === 'missing_sku') return !code
        if (issue === 'duplicate_sku') return hasDuplicateIssue(rowErrors)
        if (issue === 'missing_price') return price <= 0
        if (issue === 'missing_cost') return cost <= 0
        return true
      })
    }
    return list
  }, [drafts, q, status, stockFlag, issue, qtyBySkuId, errors])

  const visibleIds = useMemo(() => filtered.map((d) => d.id), [filtered])
  const allSelected = selected.size > 0 && visibleIds.every((id) => selected.has(id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
      if (everySelected) {
        visibleIds.forEach((id) => next.delete(id))
        return next
      }
      visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyBulk() {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (bulkField === 'active') {
      onBulkApply(ids, { active: bulkActive === '1' })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'unit') {
      const unit = bulkValueText.trim()
      if (!unit) return
      onBulkApply(ids, { unit })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'color') {
      onBulkApply(ids, { color: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'size') {
      onBulkApply(ids, { size: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'material') {
      onBulkApply(ids, { material: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'volume') {
      onBulkApply(ids, { volume: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'capacity') {
      onBulkApply(ids, { capacity: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    if (bulkField === 'power') {
      onBulkApply(ids, { power: bulkValueText.trim() })
      setBulkOpen(false)
      return
    }
    const n = Number(bulkValueText)
    if (!Number.isFinite(n)) return
    if (bulkField === 'price') onBulkApply(ids, { price: n })
    if (bulkField === 'cost') onBulkApply(ids, { cost: n })
    setBulkOpen(false)
  }

  function selectIssues() {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((d) => {
        const rowErrors = errors[d.id] || []
        const code = (d.skuCode || '').trim()
        const price = Number(d.price) || 0
        const cost = Number(d.cost) || 0
        if (rowErrors.length > 0 || !code || price <= 0 || cost <= 0) next.add(d.id)
      })
      return next
    })
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <VariantTableToolbar
        filteredCount={filtered.length}
        selectedCount={selected.size}
        query={q}
        onChangeQuery={setQ}
        status={status}
        onChangeStatus={setStatus}
        stockFlag={stockFlag}
        onChangeStockFlag={setStockFlag}
        issue={issue}
        onChangeIssue={setIssue}
        onOpenBulk={() => setBulkOpen(true)}
        onRegenerateSkuCodes={() => onRegenerateSkuCodesFor(Array.from(selected))}
        onSelectIssues={selectIssues}
      />

      <div className="table-wrap" style={{ maxHeight: 420 }}>
        <table className="table sticky-header">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <button type="button" className="btn btn-small" onClick={toggleAll} title="Chọn tất cả">
                  {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </th>
              <th style={{ width: 240 }}>skuCode</th>
              <th style={{ width: 120 }}>Màu</th>
              <th style={{ width: 120 }}>Size</th>
              <th style={{ width: 140 }}>Trạng thái</th>
              <th style={{ width: 120 }}>Tồn</th>
              <th style={{ width: 120 }} className="text-right">Giá</th>
              <th style={{ width: 120 }} className="text-right">Vốn</th>
              <th style={{ width: 120 }}>Đơn vị</th>
              <th style={{ width: 110 }} className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const qty = qtyBySkuId.get(d.id) ?? 0
              const rowErrors = errors[d.id] || []
              const price = Number(d.price) || 0
              const cost = Number(d.cost) || 0
              const state = statusBadge(d.active, qty)
              return (
                <tr key={d.id}>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => toggleOne(d.id)}>
                      {selected.has(d.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                  <td>
                    <input
                      value={d.skuCode}
                      onChange={(e) => onChangeDraft(d.id, { skuCode: toUpper(e.target.value) })}
                      style={{ fontFamily: 'monospace' }}
                    />
                    {rowErrors.length > 0 && <div className="text-danger" style={{ fontSize: 12 }}>{rowErrors[0]}</div>}
                    {rowErrors.length === 0 && !d.skuCode.trim() && <div className="text-danger" style={{ fontSize: 12 }}>Thiếu skuCode</div>}
                  </td>
                  <td>
                    <input value={d.color} onChange={(e) => onChangeDraft(d.id, { color: e.target.value })} />
                  </td>
                  <td>
                    <input value={d.size} onChange={(e) => onChangeDraft(d.id, { size: e.target.value })} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${state.cls}`}>{state.label}</span>
                      <select value={d.active ? '1' : '0'} onChange={(e) => onChangeDraft(d.id, { active: e.target.value === '1' })} className="input-compact">
                        <option value="1">Bán</option>
                        <option value="0">Ngưng</option>
                      </select>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 900 }}>{qty}</span>
                    <span className="text-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                      {qty === 0 ? '(hết)' : qty <= 5 ? '(thấp)' : ''}
                    </span>
                  </td>
                  <td className="text-right">
                    <input type="number" value={d.price} onChange={(e) => onChangeDraft(d.id, { price: Number(e.target.value) })} />
                    {price <= 0 && <div className="text-muted" style={{ fontSize: 12 }}>Thiếu giá</div>}
                  </td>
                  <td className="text-right">
                    <input type="number" value={d.cost} onChange={(e) => onChangeDraft(d.id, { cost: Number(e.target.value) })} />
                    {cost <= 0 && <div className="text-muted" style={{ fontSize: 12 }}>Thiếu vốn</div>}
                  </td>
                  <td>
                    <input value={d.unit} onChange={(e) => onChangeDraft(d.id, { unit: e.target.value })} />
                  </td>
                  <td className="text-right">
                    <button type="button" className="btn btn-small" onClick={() => onOpenSku(d.id)}>
                      <Edit3 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <VariantBulkEditModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        selectedCount={selected.size}
        field={bulkField}
        onChangeField={setBulkField}
        valueText={bulkValueText}
        onChangeValueText={setBulkValueText}
        activeValue={bulkActive}
        onChangeActiveValue={setBulkActive}
        onApply={applyBulk}
      />
    </div>
  )
}


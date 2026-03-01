import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { getStockQty } from '../domain/stock'
import type { Location, Sku, StockCount, StockCountAttachmentType, StockTxType } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { validateAttachmentFiles } from '../lib/attachments'
import { useDialogs } from '../ui-kit/Dialogs'
import { MoneyInput } from '../ui-kit/MoneyInput'

function locationLabel(loc: Location): string {
  return `${loc.code} - ${loc.name}`
}

function skuLabel(productsById: Map<string, string>, sku: Sku): string {
  const productName = productsById.get(sku.productId) ?? sku.productId
  const attrs = [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ')
  return `${productName}${attrs ? ` - ${attrs}` : ''} (${sku.skuCode})`
}

const attachmentOptions: { value: StockCountAttachmentType; label: string }[] = [
  { value: 'report', label: 'Biên bản' },
  { value: 'signature', label: 'Chữ ký' },
  { value: 'other', label: 'Khác' },
]

export function StockCountsPage() {
  const { state, dispatch } = useStore()
  const { can, user } = useAuth()
  const canWrite = can('inventory:write')
  const dialogs = useDialogs()

  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const skus = useMemo(
    () =>
      state.skus
        .filter((s) => s.kind === 'single' && s.active)
        .slice()
        .sort((a, b) => skuLabel(productsById, a).localeCompare(skuLabel(productsById, b))),
    [productsById, state.skus],
  )
  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )

  const counts = useMemo(
    () => state.stockCounts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.stockCounts],
  )

  const [selectedId, setSelectedId] = useState<string | null>(counts[0]?.id ?? null)
  const selected = useMemo(
    () => (selectedId ? state.stockCounts.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, state.stockCounts],
  )

  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [responsibleUserId, setResponsibleUserId] = useState<string>('')
  const [compensationAmount, setCompensationAmount] = useState<number>(0)
  const [lineSkuId, setLineSkuId] = useState<string>(skus[0]?.id ?? '')
  const [lineCountedQty, setLineCountedQty] = useState<number>(0)

  const [pendingCode, setPendingCode] = useState('')
  const [pendingBatch, setPendingBatch] = useState('')
  const [pendingQty, setPendingQty] = useState(0)
  const [pendingNote, setPendingNote] = useState('')

  function create() {
    if (!canWrite) return
    if (!locationId) return
    const createdAt = nowIso()
    const sc: StockCount = {
      id: newId('sc'),
      code: '',
      locationId,
      status: 'draft',
      note: note.trim(),
      createdAt,
      createdByUserId: user?.id ?? null,
      responsibleUserId: responsibleUserId || null,
      compensationAmount: Math.max(0, Number(compensationAmount) || 0),
      lines: [],
      pendingItems: [],
      attachments: [],
    }
    dispatch({ type: 'stockCounts/upsert', stockCount: sc })
    setSelectedId(sc.id)
    setNote('')
    setCompensationAmount(0)
    setResponsibleUserId('')
  }

  async function remove(id: string) {
    if (!canWrite) return
    const ok = await dialogs.confirm({ message: 'Xóa phiếu kiểm kho?', dangerous: true })
    if (!ok) return
    dispatch({ type: 'stockCounts/delete', id })
    if (selectedId === id) setSelectedId(null)
  }

  function update(patch: Partial<StockCount>) {
    if (!selected) return
    dispatch({ type: 'stockCounts/upsert', stockCount: { ...selected, ...patch } })
  }

  function addLine() {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    if (!lineSkuId) return
    const existed = selected.lines.find((l) => l.skuId === lineSkuId)
    const nextLines = existed
      ? selected.lines.map((l) => (l.skuId === lineSkuId ? { ...l, countedQty: Number(lineCountedQty) || 0 } : l))
      : [...selected.lines, { skuId: lineSkuId, countedQty: Number(lineCountedQty) || 0 }]
    update({ lines: nextLines })
    setLineCountedQty(0)
  }

  function removeLine(skuId: string) {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    update({ lines: selected.lines.filter((l) => l.skuId !== skuId) })
  }

  function addPendingItem() {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    if (!pendingCode.trim()) return

    const next = {
      internalCode: pendingCode.trim(),
      batchCode: pendingBatch.trim(),
      qty: Number(pendingQty) || 0,
      note: pendingNote.trim(),
    }
    update({ pendingItems: [...(selected.pendingItems || []), next] })
    setPendingCode('')
    setPendingBatch('')
    setPendingQty(0)
    setPendingNote('')
  }

  function removePendingItem(idx: number) {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    const current = selected.pendingItems || []
    update({ pendingItems: current.filter((_, i) => i !== idx) })
  }

  async function addAttachments(type: StockCountAttachmentType, files: FileList | null) {
    if (!canWrite) return
    if (!selected) return
    const validated = validateAttachmentFiles(files)
    if (!validated.ok) {
      await dialogs.alert({ message: validated.error })
      return
    }
    if (!validated.files.length) return
    if (selected.status !== 'draft') return
    const createdAt = nowIso()
    const readers = validated.files.map(
      (f) =>
        new Promise<{ id: string; type: StockCountAttachmentType; name: string; dataUrl: string; createdAt: string } | null>(
          (resolve) => {
            const r = new FileReader()
            r.onload = () => {
              const dataUrl = typeof r.result === 'string' ? r.result : ''
              if (!dataUrl) return resolve(null)
              resolve({ id: newId('att'), type, name: f.name, dataUrl, createdAt })
            }
            r.onerror = () => resolve(null)
            r.readAsDataURL(f)
          },
        ),
    )
    const next = (await Promise.all(readers)).filter(Boolean) as NonNullable<(typeof readers)[number] extends Promise<infer R> ? R : never>[]
    if (!next.length) return
    update({ attachments: [...selected.attachments, ...next] })
  }

  function removeAttachment(id: string) {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    update({ attachments: selected.attachments.filter((a) => a.id !== id) })
  }

  function finalize() {
    if (!canWrite) return
    if (!selected) return
    if (selected.status !== 'draft') return
    const createdAt = nowIso()

    selected.lines.forEach((l) => {
      const systemQty = getStockQty(state.stockTransactions, l.skuId, selected.locationId)
      const diff = (Number(l.countedQty) || 0) - systemQty
      if (!diff) return
      const txType: StockTxType = 'adjust'
      dispatch({
        type: 'stock/add',
        meta: { reason: `Điều chỉnh theo kiểm kho ${selected.code}` },
        tx: {
          id: newId('stk'),
          code: '',
          type: txType,
          skuId: l.skuId,
          locationId: selected.locationId,
          qty: diff,
          unitCost: null,
          note: `Điều chỉnh theo kiểm kho ${selected.code}`,
          createdAt,
          refType: 'stock_count',
          refId: selected.id,
          attachments: [],
        },
      })
    })

    const comp = Math.max(0, Number(selected.compensationAmount) || 0)
    if (comp > 0) {
      dispatch({
        type: 'finance/add',
        tx: {
          id: newId('fin'),
          code: '',
          type: 'income',
          amount: comp,
          category: 'Đền bù kiểm kê',
          note: `Đền bù theo ${selected.code}`,
          createdAt,
          refType: 'stock_count',
          refId: selected.id,
          attachments: [],
        },
      })
    }

    update({ status: 'final' })
  }

  const selectedLocation = selected ? state.locations.find((l) => l.id === selected.locationId) ?? null : null
  const staff = useMemo(() => state.users.slice().sort((a, b) => a.username.localeCompare(b.username)), [state.users])

  return (
    <div className="page">
      <PageHeader title="Kiểm kho định kỳ" />

      {canWrite ? (
        <div className="card">
          <div className="card-title">Tạo phiếu kiểm kho</div>
          <div className="grid-form">
            <div className="field">
              <label>Vị trí kho</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Nhân viên phụ trách</label>
              <select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
                <option value="">Chưa chọn</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Đền bù (nếu lệch)</label>
              <MoneyInput value={compensationAmount} onChange={setCompensationAmount} />
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={create}>
              Tạo phiếu
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Danh sách phiếu</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Vị trí</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
                <th>Đền bù</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => {
                const loc = state.locations.find((l) => l.id === c.locationId)
                return (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{loc ? loc.code : ''}</td>
                    <td>{formatDateTime(c.createdAt)}</td>
                    <td>{c.status === 'final' ? 'Đã chốt' : 'Nháp'}</td>
                    <td>{formatVnd(c.compensationAmount)}</td>
                    <td className="cell-actions">
                      <button className="btn btn-small" onClick={() => setSelectedId(c.id)}>
                        Chi tiết
                      </button>
                      {canWrite ? (
                        <button className="btn btn-small btn-danger" onClick={() => remove(c.id)}>
                          Xóa
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="card">
          <div className="row row-between">
            <div className="card-title">
              Phiếu: {selected.code} ({selectedLocation ? selectedLocation.code : ''}) -{' '}
              {selected.status === 'final' ? 'Đã chốt' : 'Nháp'}
            </div>
            {selected.status === 'draft' && canWrite ? (
              <button className="btn btn-primary" onClick={finalize}>
                Chốt kiểm kho
              </button>
            ) : null}
          </div>

          <div className="grid-form">
            <div className="field">
              <label>Nhân viên phụ trách</label>
              <select
                value={selected.responsibleUserId ?? ''}
                onChange={(e) => update({ responsibleUserId: e.target.value || null })}
                disabled={selected.status !== 'draft'}
              >
                <option value="">Chưa chọn</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Đền bù</label>
              <MoneyInput
                value={selected.compensationAmount}
                onChange={(v) => update({ compensationAmount: v })}
                disabled={selected.status !== 'draft'}
              />
            </div>
            <div className="field field-span-2">
              <label>Ghi chú</label>
              <input value={selected.note} onChange={(e) => update({ note: e.target.value })} disabled={selected.status !== 'draft'} />
            </div>
          </div>

          {selected.status === 'draft' && canWrite ? (
            <div className="card">
              <div className="card-title">Thêm dòng kiểm kho</div>
              <div className="grid-form">
                <div className="field">
                  <label>SKU</label>
                  <select value={lineSkuId} onChange={(e) => setLineSkuId(e.target.value)}>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {skuLabel(productsById, s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Số lượng kiểm</label>
                  <input type="number" value={lineCountedQty} onChange={(e) => setLineCountedQty(Number(e.target.value))} />
                </div>
              </div>
              <div className="row">
                <button className="btn btn-primary" onClick={addLine}>
                  Thêm/Cập nhật
                </button>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-title">Hàng chờ xử lý (Không trừ kho, chỉ ghi nhận)</div>
            {selected.status === 'draft' && canWrite && (
              <>
                <div className="grid-form">
                  <div className="field">
                    <label>Mã nội bộ SP</label>
                    <input value={pendingCode} onChange={(e) => setPendingCode(e.target.value)} placeholder="Nhập mã..." />
                  </div>
                  <div className="field">
                    <label>Mã lô</label>
                    <input value={pendingBatch} onChange={(e) => setPendingBatch(e.target.value)} placeholder="Nhập lô..." />
                  </div>
                  <div className="field">
                    <label>Số lượng</label>
                    <input type="number" value={pendingQty} onChange={(e) => setPendingQty(Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <label>Ghi chú</label>
                    <input value={pendingNote} onChange={(e) => setPendingNote(e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-primary" onClick={addPendingItem}>
                    Thêm dòng
                  </button>
                </div>
              </>
            )}

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã nội bộ</th>
                    <th>Mã lô</th>
                    <th>Số lượng</th>
                    <th>Ghi chú</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(selected.pendingItems || []).map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.internalCode}</td>
                      <td>{item.batchCode}</td>
                      <td>{item.qty}</td>
                      <td>{item.note}</td>
                      <td className="cell-actions">
                        {selected.status === 'draft' && canWrite && (
                          <button className="btn btn-small btn-danger" onClick={() => removePendingItem(idx)}>
                            Xóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            <div className="card">
              <div className="card-title">Danh sách kiểm</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Hệ thống</th>
                    <th>Kiểm</th>
                    <th>Chênh lệch</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((l) => {
                    const sku = skus.find((s) => s.id === l.skuId)
                    const systemQty = getStockQty(state.stockTransactions, l.skuId, selected.locationId)
                    const diff = (Number(l.countedQty) || 0) - systemQty
                    return (
                      <tr key={l.skuId}>
                        <td>{sku ? skuLabel(productsById, sku) : l.skuId}</td>
                        <td>{systemQty}</td>
                        <td>{l.countedQty}</td>
                        <td>{diff}</td>
                        <td className="cell-actions">
                          {selected.status === 'draft' && canWrite ? (
                            <button className="btn btn-small btn-danger" onClick={() => removeLine(l.skuId)}>
                              Xóa
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Biên bản và chữ ký</div>
            <div className="row">
              {attachmentOptions.map((opt) => (
                <label key={opt.value} className="btn btn-small">
                  {opt.label}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    disabled={selected.status !== 'draft'}
                    onChange={(e) => {
                      addAttachments(opt.value, e.target.files)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Tên file</th>
                    <th>Ngày</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.attachments.map((a) => (
                    <tr key={a.id}>
                      <td>{attachmentOptions.find((x) => x.value === a.type)?.label ?? a.type}</td>
                      <td>
                        <a href={a.dataUrl} target="_blank" rel="noreferrer">
                          {a.name}
                        </a>
                      </td>
                      <td>{formatDateTime(a.createdAt)}</td>
                      <td className="cell-actions">
                        {selected.status === 'draft' && canWrite ? (
                          <button className="btn btn-small btn-danger" onClick={() => removeAttachment(a.id)}>
                            Xóa
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

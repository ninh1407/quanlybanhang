import { useMemo, useState } from 'react'
import { Grid3X3 } from 'lucide-react'
import type { SkuDraft } from './types'

type AxisKey = 'color' | 'size' | 'material' | 'volume' | 'capacity' | 'power'

function labelAxis(k: AxisKey): string {
  if (k === 'color') return 'Màu'
  if (k === 'size') return 'Size'
  if (k === 'material') return 'Material'
  if (k === 'volume') return 'Volume'
  if (k === 'capacity') return 'Capacity'
  return 'Power'
}

function uniqValues(drafts: SkuDraft[], key: AxisKey): string[] {
  const set = new Set<string>()
  drafts.forEach((d) => {
    const v = String((d as any)[key] || '').trim()
    if (v) set.add(v)
  })
  return Array.from(set).sort((a: any, b: any) => a.localeCompare(b))
}

export function VariantMatrixCard(props: {
  drafts: SkuDraft[]
  qtyBySkuId: Map<string, number>
  onOpenSku: (skuId: string) => void
}) {
  const { drafts, qtyBySkuId, onOpenSku } = props
  const [axisX, setAxisX] = useState<AxisKey>('size')
  const [axisY, setAxisY] = useState<AxisKey>('color')

  const rows = useMemo(() => uniqValues(drafts, axisY), [drafts, axisY])
  const cols = useMemo(() => uniqValues(drafts, axisX), [drafts, axisX])

  const cellByKey = useMemo(() => {
    const m = new Map<string, SkuDraft>()
    drafts.forEach((d) => {
      const x = String((d as any)[axisX] || '').trim()
      const y = String((d as any)[axisY] || '').trim()
      if (!x || !y) return
      m.set(`${y}::${x}`, d)
    })
    return m
  }, [drafts, axisX, axisY])

  const usable = rows.length > 0 && cols.length > 0

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
          <Grid3X3 size={16} /> Matrix tồn kho
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select value={axisY} onChange={(e) => setAxisY(e.target.value as AxisKey)} className="input-compact">
            {(['color', 'size', 'material', 'volume', 'capacity', 'power'] as AxisKey[]).map((k) => (
              <option key={k} value={k}>
                Trục Y: {labelAxis(k)}
              </option>
            ))}
          </select>
          <select value={axisX} onChange={(e) => setAxisX(e.target.value as AxisKey)} className="input-compact">
            {(['size', 'color', 'material', 'volume', 'capacity', 'power'] as AxisKey[]).map((k) => (
              <option key={k} value={k}>
                Trục X: {labelAxis(k)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!usable ? (
        <div className="text-muted" style={{ fontSize: 13 }}>
          Cần có ít nhất 2 thuộc tính (ví dụ: Màu và Size) để hiển thị ma trận.
        </div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>{labelAxis(axisY)} \ {labelAxis(axisX)}</th>
                {cols.map((c) => (
                  <th key={c} className="text-right">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <td style={{ fontWeight: 800 }}>{r}</td>
                  {cols.map((c) => {
                    const sku = cellByKey.get(`${r}::${c}`) || null
                    if (!sku) return <td key={c} className="text-right text-muted">-</td>
                    const qty = qtyBySkuId.get(sku.id) ?? 0
                    const badge = !sku.active ? 'badge-neutral' : qty === 0 ? 'badge-danger' : qty <= 5 ? 'badge-warning' : 'badge-success'
                    const label = !sku.active ? 'Ngưng' : qty === 0 ? 'Hết' : qty <= 5 ? 'Thấp' : 'Bán'
                    return (
                      <td key={c} className="text-right">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => onOpenSku(sku.id)}
                          style={{ minWidth: 78, justifyContent: 'flex-end' }}
                          title={sku.skuCode}
                        >
                          <span className={`badge ${badge}`} style={{ marginRight: 8 }}>{label}</span>
                          <span style={{ fontWeight: 900 }}>{qty}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


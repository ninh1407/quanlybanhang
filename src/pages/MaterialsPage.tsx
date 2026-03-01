import { memo, useMemo, useState } from 'react'
import type { Product, Sku, StockTransaction } from '../domain/types'
import { useAppState } from '../state/Store'
import { formatVnd } from '../lib/money'
import { PageHeader } from '../ui-kit/PageHeader'

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

const MaterialRow = memo(function MaterialRow(props: {
  sku: Sku
  product: Product | undefined
  stock: number
  avgCost: number
}) {
  const { sku, product, stock, avgCost } = props
  const attrs = [sku.color.trim(), sku.size.trim(), sku.material?.trim()].filter(Boolean).join(' / ')
  
  return (
    <tr>
      <td>{product?.name} {attrs ? `(${attrs})` : ''}</td>
      <td>{sku.skuCode}</td>
      <td>{stock}</td>
      <td>{formatVnd(avgCost)}</td>
    </tr>
  )
})

export function MaterialsPage() {
  const state = useAppState()

  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')

  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products])
  const materials = useMemo(() => {
    return state.skus
      .filter((s) => s.kind === 'single')
      .map((s) => {
        const p = productsById.get(s.productId)
        return { sku: s, product: p }
      })
      .filter((x) => x.product && x.product.isMaterial)
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''))
  }, [productsById, state.skus])

  const stockQtyAtLocationBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    if (!locationId) return m
    state.stockTransactions.forEach((t) => {
      if (t.locationId !== locationId) return
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  }, [locationId, state.stockTransactions])

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

  return (
    <div className="page">
      <PageHeader title="Vật tư đóng gói" />

      <div className="card">
        <div className="card-title">Tồn theo vị trí</div>
        <div className="row">
          <div className="field" style={{ width: 320 }}>
            <label>Vị trí kho</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} - {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vật tư</th>
                <th>SKU</th>
                <th>Tồn</th>
                <th>Giá vốn TB</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(({ sku, product }) => (
                <MaterialRow
                  key={sku.id}
                  sku={sku}
                  product={product}
                  stock={stockQtyAtLocationBySkuId.get(sku.id) ?? 0}
                  avgCost={averageCostBySkuId.get(sku.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

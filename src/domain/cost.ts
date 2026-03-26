import type { Id, StockTransaction } from '../../shared/types/domain'

export function getAverageCost(stockTransactions: StockTransaction[], skuId: Id): number {
  const txs = stockTransactions
    .filter((t) => t.skuId === skuId)
    .slice()
    .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt))

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

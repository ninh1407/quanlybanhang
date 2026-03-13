import type { Id, StockTransaction } from './types'

export function getStockQty(
  stockTransactions: StockTransaction[],
  skuId: Id,
  locationId?: Id | null,
): number {
  return stockTransactions
    .filter((t) => t.skuId === skuId && (locationId === undefined ? true : t.locationId === locationId))
    .reduce((acc, t) => {
      if (t.type === 'in') return acc + t.qty
      if (t.type === 'out') return acc - t.qty
      return acc + t.qty
    }, 0)
}

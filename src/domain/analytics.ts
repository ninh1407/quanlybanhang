import type { Id, Order } from '../../shared/types/domain'

export function prevMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
  return { start: startPrevMonth, end: startThisMonth }
}

export function soldQtyBySku(orders: Order[], start: Date, end: Date): Map<Id, number> {
  const map = new Map<Id, number>()
  const startMs = start.getTime()
  const endMs = end.getTime()

  orders.forEach((o) => {
    if (o.status !== 'paid' && o.status !== 'delivered') return
    const t = new Date(o.createdAt).getTime()
    if (Number.isNaN(t)) return
    if (t < startMs || t >= endMs) return
    (o.items || []).forEach((it) => {
      map.set(it.skuId, (map.get(it.skuId) ?? 0) + it.qty)
    })
  })

  return map
}

import type { AppState } from '../state/types'
import type { StockTransaction } from '../domain/types'
import { loadSettings } from '../settings/settings'
import { prevMonthRange, soldQtyBySku } from '../domain/analytics'

export type NotificationType = 'low_stock' | 'overdue_debt' | 'stock_count_draft' | 'carrier_unreconciled' | 'info' | 'success' | 'warning' | 'error'

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  detail: string
  createdAt: string
  href: string
}

function nowIsoDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function stockQtyBySkuAtLocation(state: AppState, locationId: string): Map<string, number> {
  const m = new Map<string, number>()
  state.stockTransactions.forEach((t: StockTransaction) => {
    if (locationId && t.locationId !== locationId) return
    const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
    m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
  })
  return m
}

export function deriveNotifications(state: AppState): NotificationItem[] {
  const s = loadSettings()
  const stamp = new Date().toISOString()
  const today = nowIsoDay()

  const items: NotificationItem[] = []

  const thresholdPct = Math.max(0, Math.min(100, Number(s.lowStockThresholdPercent) || 0)) / 100
  if (thresholdPct > 0) {
    const locId = s.defaultLocationId || state.locations.find((l) => l.active)?.id || ''
    const qtyBySku = stockQtyBySkuAtLocation(state, locId)
    const prev = prevMonthRange()
    const soldPrevBySkuId = soldQtyBySku(state.orders, prev.start, prev.end)
    const low = state.skus
      .filter((sku) => sku.active && sku.kind === 'single')
      .filter((sku) => {
        const soldPrev = soldPrevBySkuId.get(sku.id) ?? 0
        if (soldPrev <= 0) return false
        const stock = qtyBySku.get(sku.id) ?? 0
        return stock < soldPrev * thresholdPct
      })
      .slice(0, 100)

    if (low.length) {
      items.push({
        id: `low_stock:${today}:${locId}:${thresholdPct}`,
        type: 'low_stock',
        title: 'Tồn kho thấp',
        detail: `${low.length} SKU dưới ngưỡng (${Math.round(thresholdPct * 100)}% bán kỳ trước)`,
        createdAt: stamp,
        href: '/inventory',
      })
    }
  }

  const overdue = state.debts.filter((d) => d.status === 'open' && d.dueDate && d.dueDate < today)
  if (overdue.length) {
    items.push({
      id: `overdue_debt:${today}`,
      type: 'overdue_debt',
      title: 'Công nợ quá hạn',
      detail: `${overdue.length} công nợ đang quá hạn`,
      createdAt: stamp,
      href: '/finance/debts',
    })
  }

  const drafts = state.stockCounts.filter((sc) => sc.status === 'draft')
  if (drafts.length) {
    items.push({
      id: `stock_count_draft:${today}`,
      type: 'stock_count_draft',
      title: 'Kiểm kho chờ xử lý',
      detail: `${drafts.length} phiếu kiểm kho đang ở trạng thái nháp`,
      createdAt: stamp,
      href: '/stock-counts',
    })
  }

  const carrierUnrec = state.orders.filter((o) => o.status === 'delivered' && o.isReconciledCarrier === 'unreconciled')
  if (carrierUnrec.length) {
    items.push({
      id: `carrier_unreconciled:${today}`,
      type: 'carrier_unreconciled',
      title: 'Đơn chưa đối soát vận chuyển',
      detail: `${carrierUnrec.length} đơn đã giao nhưng chưa đối soát`,
      createdAt: stamp,
      href: '/orders',
    })
  }

  return items
}


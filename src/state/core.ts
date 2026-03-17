import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import type {
  AuditLog,
  Category,
  Customer,
  Debt,
  FinanceTransaction,
  StockCount,
  Order,
  Product,
  Sku,
  StockTransaction,
  StockVoucher,
  StockLedgerEntry,
  Supplier,
  User,
  InventoryRequest,
  AppDocument,
} from '../domain/types'
import type { AppActionWithMeta as AppAction, AppState, WarehouseState } from './types'
import { createEmptyWarehouseState } from './seed'

export function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const idx = items.findIndex((x) => x.id === item.id)
  if (idx === -1) return [item, ...items]
  const copy = items.slice()
  copy[idx] = item
  return copy
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((x) => x.id !== id)
}

export function yearMonthFromIso(iso: string): string {
  const text = typeof iso === 'string' ? iso : ''
  if (text.length >= 7) return text.slice(0, 7).replace('-', '')
  return new Date().toISOString().slice(0, 7).replace('-', '')
}

export function toWarehouseState(state: AppState): WarehouseState {
  return {
    categories: state.categories,
    suppliers: state.suppliers,
    products: state.products,
    skus: state.skus,
    customers: state.customers,
    orders: state.orders,
    purchaseOrders: state.purchaseOrders,
    stockTransactions: state.stockTransactions,
    stockVouchers: state.stockVouchers,
    stockCounts: state.stockCounts,
    stockLedger: state.stockLedger,
    financeTransactions: state.financeTransactions,
    debts: state.debts,
    requests: state.requests,
    transferOrders: state.transferOrders,
    notifications: state.notifications,
    skuSettings: state.skuSettings,
    auditLogs: state.auditLogs,
    sequences: state.sequences,
    allocationRules: state.allocationRules,
    documents: state.documents,
  }
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'auth/login':
      return { ...state, currentUserId: action.userId, currentLocationId: null, ...createEmptyWarehouseState() }
    case 'auth/logout':
      return { ...state, currentUserId: null, currentLocationId: null, ...createEmptyWarehouseState() }
    case 'sync':
      return action.state
    case 'session/switchLocation':
      {
        if (!action.locationId) return { ...state, currentLocationId: null, ...createEmptyWarehouseState() }
        const currentUser = state.currentUserId ? state.users.find((u) => u.id === state.currentUserId) ?? null : null
        const isAdmin = currentUser?.role === 'admin'
        const allowed = isAdmin ? true : (currentUser?.allowedLocationIds ?? []).includes(action.locationId)
        if (!allowed) return { ...state, currentLocationId: null, ...createEmptyWarehouseState() }
        return {
          ...state,
          currentLocationId: action.locationId,
          ...action.warehouse,
        }
      }
    case 'audit/add':
      return { ...state, auditLogs: [action.log, ...state.auditLogs].slice(0, 2000) }
    case 'categories/upsert':
      return { ...state, categories: upsertById(state.categories, action.category) }
    case 'categories/delete':
      return { ...state, categories: removeById(state.categories, action.id) }
    case 'suppliers/upsert':
      return { ...state, suppliers: upsertById(state.suppliers, action.supplier) }
    case 'suppliers/delete':
      return { ...state, suppliers: removeById(state.suppliers, action.id) }
    case 'locations/upsert':
      return { ...state, locations: upsertById(state.locations, action.location) }
    case 'locations/delete':
      return { ...state, locations: removeById(state.locations, action.id) }
    case 'products/upsert':
      return { ...state, products: upsertById(state.products, action.product) }
    case 'products/delete':
      return {
        ...state,
        products: removeById(state.products, action.id),
        skus: state.skus.filter((s) => s.productId !== action.id),
      }
    case 'skus/upsert':
      return { ...state, skus: upsertById(state.skus, action.sku) }
    case 'skus/delete':
      return { ...state, skus: removeById(state.skus, action.id) }
    case 'customers/upsert':
      return { ...state, customers: upsertById(state.customers, action.customer) }
    case 'customers/delete':
      return { ...state, customers: removeById(state.customers, action.id) }
    case 'orders/upsert':
      {
        let order = action.order
        let sequences = state.sequences
        if (!order.code || !order.code.trim()) {
          const ym = yearMonthFromIso(order.createdAt)
          const seqKey = `order:${ym}`
          const current = sequences[seqKey] ?? 0
          const maxExisting = state.orders.reduce((m, o) => {
            const c = (o.code || '').trim()
            if (!c.startsWith(`DH-${ym}-`)) return m
            const tail = c.slice(`DH-${ym}-`.length)
            const n = Number(tail)
            return Number.isFinite(n) ? Math.max(m, n) : m
          }, 0)
          const next = Math.max(current, maxExisting) + 1
          sequences = { ...sequences, [seqKey]: next }
          order = { ...order, code: `DH-${ym}-${String(next).padStart(4, '0')}` }
        }
        return { ...state, orders: upsertById(state.orders, order), sequences }
      }
    case 'orders/delete':
      return {
        ...state,
        orders: removeById(state.orders, action.id),
        stockTransactions: state.stockTransactions.filter((t) => !(t.refType === 'order' && t.refId === action.id)),
        stockLedger: state.stockLedger.filter((l) => !(l.note.includes(action.id))), // Simplistic cleanup
        financeTransactions: state.financeTransactions.filter((t) => !(t.refType === 'order' && t.refId === action.id)),
      }
    case 'purchaseOrders/upsert':
      return { ...state, purchaseOrders: upsertById(state.purchaseOrders, action.order) }
    case 'purchaseOrders/delete':
      return { ...state, purchaseOrders: removeById(state.purchaseOrders, action.id) }
    case 'stock/add':
      {
        const tx = action.tx
        // 1. Add Transaction
        const nextTxs = [tx, ...state.stockTransactions]
        
        // 2. Double-Entry Ledger Logic
        // Determine value
        const sku = state.skus.find(s => s.id === tx.skuId)
        const cost = tx.unitCost ?? sku?.cost ?? 0
        const value = tx.qty * cost
        const date = nowIso()
        
        const entries: StockLedgerEntry[] = []
        if (value > 0) {
            // IN: Debit Inventory, Credit AP/Adjustment
            if (tx.type === 'in') {
                entries.push({
                    id: newId('led'),
                    transactionId: tx.id,
                    date,
                    locationId: tx.locationId || 'unknown',
                    skuId: tx.skuId,
                    account: 'inventory_asset',
                    debit: value,
                    credit: 0,
                    balance: 0, // Calculated later/async or ignored for simple ledger
                    note: `Nhập kho: ${tx.code || tx.id}`
                })
                entries.push({
                    id: newId('led'),
                    transactionId: tx.id,
                    date,
                    locationId: tx.locationId || 'unknown',
                    skuId: tx.skuId,
                    account: 'ap_clearing', // Or 'adjustment_income'
                    debit: 0,
                    credit: value,
                    balance: 0,
                    note: `Đối ứng nhập kho: ${tx.code || tx.id}`
                })
            }
            // OUT: Debit COGS/Adjustment, Credit Inventory
            else if (tx.type === 'out') {
                entries.push({
                    id: newId('led'),
                    transactionId: tx.id,
                    date,
                    locationId: tx.locationId || 'unknown',
                    skuId: tx.skuId,
                    account: 'cogs', // Or 'adjustment_expense'
                    debit: value,
                    credit: 0,
                    balance: 0,
                    note: `Xuất kho: ${tx.code || tx.id}`
                })
                entries.push({
                    id: newId('led'),
                    transactionId: tx.id,
                    date,
                    locationId: tx.locationId || 'unknown',
                    skuId: tx.skuId,
                    account: 'inventory_asset',
                    debit: 0,
                    credit: value,
                    balance: 0,
                    note: `Đối ứng xuất kho: ${tx.code || tx.id}`
                })
            }
        }

        return { 
            ...state, 
            stockTransactions: nextTxs,
            stockLedger: [...entries, ...state.stockLedger]
        }
      }
    case 'stockVouchers/upsert':
      {
        let voucher = action.voucher
        let sequences = state.sequences
        if (!voucher.code || !voucher.code.trim()) {
          const ym = yearMonthFromIso(voucher.createdAt)
          const prefix = voucher.type === 'in' ? 'PN' : voucher.type === 'out' ? 'PX' : 'CK'
          const seqKey = `stockVoucher:${prefix}:${ym}`
          const current = sequences[seqKey] ?? 0
          const maxExisting = state.stockVouchers.reduce((m, v) => {
            const c = (v.code || '').trim()
            if (!c.startsWith(`${prefix}-${ym}-`)) return m
            const tail = c.slice(`${prefix}-${ym}-`.length)
            const n = Number(tail)
            return Number.isFinite(n) ? Math.max(m, n) : m
          }, 0)
          const next = Math.max(current, maxExisting) + 1
          sequences = { ...sequences, [seqKey]: next }
          voucher = { ...voucher, code: `${prefix}-${ym}-${String(next).padStart(4, '0')}` }
        }
        return { ...state, stockVouchers: upsertById(state.stockVouchers, voucher), sequences }
      }
    case 'stockVouchers/delete':
      return { ...state, stockVouchers: removeById(state.stockVouchers, action.id) }
    case 'stockVouchers/finalize':
      {
        const v = state.stockVouchers.find((x) => x.id === action.id) ?? null
        if (!v) return state
        if (v.status !== 'draft') return state
        const createdAt = nowIso()
        const txs: StockTransaction[] = []
        if (v.type === 'in') {
          v.lines.forEach((l) => {
            txs.push({
              id: newId('stk'),
              code: '',
              type: 'in',
              skuId: l.skuId,
              locationId: v.toLocationId,
              qty: Number(l.qty) || 0,
              unitCost: l.unitCost == null ? null : Number(l.unitCost) || 0,
              note: l.note || v.note,
              createdAt,
              refType: 'voucher',
              refId: v.id,
              attachments: [],
            })
          })
        } else if (v.type === 'out') {
          v.lines.forEach((l) => {
            txs.push({
              id: newId('stk'),
              code: '',
              type: 'out',
              skuId: l.skuId,
              locationId: v.fromLocationId,
              qty: Number(l.qty) || 0,
              unitCost: null,
              note: l.note || v.note,
              createdAt,
              refType: 'voucher',
              refId: v.id,
              attachments: [],
            })
          })
        } else {
          v.lines.forEach((l) => {
            txs.push({
              id: newId('stk'),
              code: '',
              type: 'out',
              skuId: l.skuId,
              locationId: v.fromLocationId,
              qty: Number(l.qty) || 0,
              unitCost: null,
              note: l.note || v.note,
              createdAt,
              refType: 'voucher',
              refId: v.id,
              attachments: [],
            })
            txs.push({
              id: newId('stk'),
              code: '',
              type: 'in',
              skuId: l.skuId,
              locationId: v.toLocationId,
              qty: Number(l.qty) || 0,
              unitCost: l.unitCost == null ? null : Number(l.unitCost) || 0,
              note: l.note || v.note,
              createdAt,
              refType: 'voucher',
              refId: v.id,
              attachments: [],
            })
          })
        }

        let nextState: AppState = state
        txs.forEach((tx) => {
          nextState = reducer(nextState, { type: 'stock/add', tx })
        })

        const nextVoucher: StockVoucher = { ...v, status: 'final', finalizedAt: createdAt }
        return { ...nextState, stockVouchers: upsertById(nextState.stockVouchers, nextVoucher) }
      }
    case 'stockCounts/upsert':
      {
        const exists = state.stockCounts.some((d) => d.id === action.stockCount.id)
        if (exists) return { ...state, stockCounts: upsertById(state.stockCounts, action.stockCount) }

        let stockCount = action.stockCount
        let sequences = state.sequences
        if (!stockCount.code || !stockCount.code.trim()) {
          const ym = yearMonthFromIso(stockCount.createdAt)
          const seqKey = `stockCount:${ym}`
          const next = (sequences[seqKey] ?? 0) + 1
          sequences = { ...sequences, [seqKey]: next }
          stockCount = { ...stockCount, code: `KK-${ym}-${String(next).padStart(4, '0')}` }
        }
        return { ...state, stockCounts: [stockCount, ...state.stockCounts], sequences }
      }
    case 'stockCounts/delete':
      return {
        ...state,
        stockCounts: removeById(state.stockCounts, action.id),
        stockTransactions: state.stockTransactions.filter(
          (t) => !(t.refType === 'stock_count' && t.refId === action.id),
        ),
        financeTransactions: state.financeTransactions.filter(
          (t) => !(t.refType === 'stock_count' && t.refId === action.id),
        ),
      }
    case 'finance/add':
      {
        let tx = action.tx
        let sequences = state.sequences
        if (!tx.code || !tx.code.trim()) {
          const ym = yearMonthFromIso(tx.createdAt)
          const seqKey = `finance:${ym}`
          const next = (sequences[seqKey] ?? 0) + 1
          sequences = { ...sequences, [seqKey]: next }
          tx = { ...tx, code: `TC-${ym}-${String(next).padStart(4, '0')}` }
        }
        return { ...state, financeTransactions: [tx, ...state.financeTransactions], sequences }
      }
    case 'debts/upsert': {
      const existing = state.debts.find(d => d.id === action.debt.id)
      if (existing) {
        return {
          ...state,
          debts: state.debts.map(d => d.id === action.debt.id ? action.debt : d)
        }
      }
      return {
        ...state,
        debts: [action.debt, ...state.debts]
      }
    }
    case 'debts/delete':
      return { ...state, debts: removeById(state.debts, action.id) }
    case 'users/upsert':
      return { ...state, users: upsertById(state.users, action.user) }
    case 'users/delete':
      return { ...state, users: removeById(state.users, action.id) }
    case 'requests/upsert':
      {
        const exists = state.requests.some((r) => r.id === action.request.id)
        if (exists) return { ...state, requests: upsertById(state.requests, action.request) }

        let request = action.request
        let sequences = state.sequences
        if (!request.code || !request.code.trim()) {
          const ym = yearMonthFromIso(request.createdAt)
          const seqKey = `request:${ym}`
          const next = (sequences[seqKey] ?? 0) + 1
          sequences = { ...sequences, [seqKey]: next }
          request = { ...request, code: `YC-${ym}-${String(next).padStart(4, '0')}` }
        }
        return { ...state, requests: [request, ...state.requests], sequences }
      }
    case 'notifications/add':
      return { ...state, notifications: [action.notification, ...state.notifications].slice(0, 100) }
    case 'notifications/markRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      }
    case 'notifications/markAllRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }
    case 'skuSettings/upsert':
      {
        const exists = state.skuSettings.findIndex(
            s => s.skuId === action.setting.skuId && s.locationId === action.setting.locationId
        )
        let nextSettings = [...state.skuSettings]
        if (exists > -1) {
            nextSettings[exists] = action.setting
        } else {
            nextSettings.push(action.setting)
        }
        return { ...state, skuSettings: nextSettings }
      }
    case 'channelConfigs/upsert':
      return { ...state, channelConfigs: upsertById(state.channelConfigs, action.config) }
    case 'channelConfigs/delete':
      return { ...state, channelConfigs: removeById(state.channelConfigs, action.id) }
    case 'skuMappings/upsert':
      return { ...state, skuMappings: upsertById(state.skuMappings, action.mapping) }
    case 'skuMappings/delete':
      return { ...state, skuMappings: removeById(state.skuMappings, action.id) }
    case 'warehouseRegionMappings/upsert':
      return { ...state, warehouseRegionMappings: upsertById(state.warehouseRegionMappings, action.mapping) }
    case 'warehouseRegionMappings/delete':
      return { ...state, warehouseRegionMappings: removeById(state.warehouseRegionMappings, action.id) }
    case 'allocationRules/upsert':
      return { ...state, allocationRules: upsertById(state.allocationRules, action.rule) }
    case 'allocationRules/delete':
      return { ...state, allocationRules: removeById(state.allocationRules, action.id) }
    case 'documents/upsert':
      return { ...state, documents: upsertById(state.documents, action.document) }
    case 'documents/delete':
      return { ...state, documents: removeById(state.documents, action.id) }
  }
  return state
}

function orderSubTotalSimple(order: Order): number {
  if (order.subTotalOverride != null) return Number(order.subTotalOverride) || 0
  return order.items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
}

function orderTotalSimple(order: Order): number {
  return (
    orderSubTotalSimple(order) -
    (Number(order.discountAmount) || 0) +
    (Number(order.shippingFee) || 0) +
    (Number(order.vatAmount) || 0) +
    (Number(order.otherFees) || 0)
  )
}

function stockQtyBySkuLocation(state: AppState): Map<string, number> {
  const m = new Map<string, number>()
  state.stockTransactions.forEach((t) => {
    const loc = t.locationId ?? 'all'
    const key = `${t.skuId}::${loc}`
    const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
    m.set(key, (m.get(key) ?? 0) + delta)
  })
  return m
}

export function validateAction(prev: AppState, action: AppAction): { ok: true } | { ok: false; error: string } {
  const currentUser = prev.currentUserId ? prev.users.find((u) => u.id === prev.currentUserId) ?? null : null
  const isAdmin = currentUser?.role === 'admin'

  if (action.type === 'orders/delete') {
    const order = prev.orders.find((o) => o.id === action.id) ?? null
    if (!order) return { ok: true }
    if (order.status !== 'draft' && order.status !== 'cancelled') {
      return { ok: false, error: 'Chỉ cho phép xóa đơn ở trạng thái Nháp hoặc Hủy.' }
    }
    if (!isAdmin) {
      const hasStock = prev.stockTransactions.some((t) => t.refType === 'order' && t.refId === action.id)
      if (hasStock) return { ok: false, error: 'Đơn đã phát sinh phiếu kho. Vui lòng "Hủy đơn" thay vì xóa, hoặc liên hệ Admin.' }
      const hasFinance = prev.financeTransactions.some((t) => t.refType === 'order' && t.refId === action.id)
      if (hasFinance) return { ok: false, error: 'Đơn đã phát sinh thu/chi. Vui lòng "Hủy đơn" thay vì xóa, hoặc liên hệ Admin.' }
    }
    return { ok: true }
  }

  if (action.type === 'stock/add') {
    const tx = action.tx
    if (tx.type === 'out' || tx.type === 'adjust') {
      if (!isAdmin) {
        const qtyMap = stockQtyBySkuLocation(prev)
        const loc = tx.locationId ?? 'all'
        const key = `${tx.skuId}::${loc}`
        const current = qtyMap.get(key) ?? 0
        const next = current + (tx.type === 'out' ? -tx.qty : tx.qty)
        if (next < 0) {
          return { ok: false, error: 'Không cho phép xuất/điều chỉnh kho âm (trừ admin).' }
        }
      }
    }
    return { ok: true }
  }

  if (action.type === 'stockVouchers/delete') {
    const v = prev.stockVouchers.find((x) => x.id === action.id) ?? null
    if (!v) return { ok: true }
    if (v.status === 'final') return { ok: false, error: 'Không thể xóa phiếu kho đã chốt.' }
    return { ok: true }
  }

  if (action.type === 'stockVouchers/finalize') {
    const v = prev.stockVouchers.find((x) => x.id === action.id) ?? null
    if (!v) return { ok: false, error: 'Không tìm thấy phiếu kho.' }
    if (v.status !== 'draft') return { ok: false, error: 'Chỉ cho phép chốt phiếu ở trạng thái Nháp.' }
    if (!v.lines.length) return { ok: false, error: 'Phiếu kho chưa có dòng hàng.' }
    if (v.type === 'in' && !v.toLocationId) return { ok: false, error: 'Vui lòng chọn kho nhập.' }
    if (v.type === 'out' && !v.fromLocationId) return { ok: false, error: 'Vui lòng chọn kho xuất.' }
    if (v.type === 'transfer' && (!v.fromLocationId || !v.toLocationId)) {
      return { ok: false, error: 'Vui lòng chọn kho chuyển đi và kho nhận.' }
    }
    if (v.type === 'transfer' && v.fromLocationId === v.toLocationId) {
      return { ok: false, error: 'Kho chuyển đi và kho nhận không được trùng nhau.' }
    }
    if (!isAdmin && (v.type === 'out' || v.type === 'transfer')) {
      const qtyMap = stockQtyBySkuLocation(prev)
      for (const l of v.lines) {
        const skuId = l.skuId
        const loc = v.fromLocationId ?? 'all'
        const key = `${skuId}::${loc}`
        const current = qtyMap.get(key) ?? 0
        const next = current - (Number(l.qty) || 0)
        if (next < 0) return { ok: false, error: 'Không cho phép xuất/chuyển kho âm (trừ admin).' }
        qtyMap.set(key, next)
      }
    }
    return { ok: true }
  }

  return { ok: true }
}

export function toAuditSnapshot(entityType: AuditLog['entityType'], entity: unknown): unknown {
  if (!entity || typeof entity !== 'object') return entity
  switch (entityType) {
    case 'order': {
      const o = entity as Order
      return {
        code: o.code,
        status: o.status,
        type: o.type,
        source: o.source,
        paymentMethod: o.paymentMethod,
        customerId: o.customerId,
        total: orderTotalSimple(o),
        vatAmount: o.vatAmount,
        otherFees: o.otherFees,
        platformOrderId: o.platformOrderId,
        dropshipBrand: o.dropshipBrand,
        partnerVoucherCode: o.partnerVoucherCode,
        reconciliationResultAmount: o.reconciliationResultAmount,
        createdAt: o.createdAt,
      }
    }
    case 'stock_tx': {
      const t = entity as StockTransaction
      return {
        code: t.code,
        type: t.type,
        skuId: t.skuId,
        locationId: t.locationId,
        qty: t.qty,
        unitCost: t.unitCost,
        note: t.note,
        refType: t.refType,
        refId: t.refId,
        entryDate: t.entryDate,
        createdAt: t.createdAt,
      }
    }
    case 'stock_voucher': {
      const v = entity as StockVoucher
      return {
        code: v.code,
        type: v.type,
        status: v.status,
        fromLocationId: v.fromLocationId,
        toLocationId: v.toLocationId,
        note: v.note,
        lines: v.lines.length,
        createdAt: v.createdAt,
        finalizedAt: v.finalizedAt,
      }
    }
    case 'stock_count': {
      const s = entity as StockCount
      return {
        code: s.code,
        locationId: s.locationId,
        status: s.status,
        note: s.note,
        lines: s.lines.length,
        attachments: s.attachments.length,
        createdAt: s.createdAt,
      }
    }
    case 'finance_tx': {
      const t = entity as FinanceTransaction
      return {
        code: t.code,
        type: t.type,
        amount: t.amount,
        category: t.category,
        note: t.note,
        locationId: t.locationId,
        refType: t.refType,
        refId: t.refId,
        createdAt: t.createdAt,
      }
    }
    case 'debt': {
      const d = entity as Debt
      return {
        code: d.code,
        type: d.type,
        partnerName: d.partnerName,
        amount: d.amount,
        status: d.status,
        dueDate: d.dueDate,
        createdAt: d.createdAt,
      }
    }
    case 'product': {
      const p = entity as Product
      return { internalCode: p.internalCode, name: p.name, active: p.active, createdAt: p.createdAt }
    }
    case 'sku': {
      const s = entity as Sku
      return {
        skuCode: s.skuCode,
        productId: s.productId,
        price: s.price,
        cost: s.cost,
        active: s.active,
        kind: s.kind,
        createdAt: s.createdAt,
      }
    }
    case 'customer': {
      const c = entity as Customer
      return {
        name: c.name,
        phone: c.phone,
        email: c.email,
        discountPercent: c.discountPercent,
        createdAt: c.createdAt,
      }
    }
    case 'supplier': {
      const s = entity as Supplier
      return { code: s.code, name: s.name, phone: s.phone, email: s.email, createdAt: s.createdAt }
    }
    case 'category': {
      const c = entity as Category
      return { name: c.name, createdAt: c.createdAt }
    }
    case 'location': {
      const l = entity as unknown as { code?: string; name?: string; province?: string; address?: string; lat?: number; lng?: number; active?: boolean; createdAt?: string }
      return { code: l.code, name: l.name, province: l.province, address: l.address, lat: l.lat, lng: l.lng, active: l.active, createdAt: l.createdAt }
    }
    case 'user': {
      const u = entity as User
      return { username: u.username, fullName: u.fullName, role: u.role, active: u.active, createdAt: u.createdAt }
    }
    case 'request': {
        const r = entity as InventoryRequest
        return {
            code: r.code,
            type: r.type,
            status: r.status,
            warehouseId: r.warehouseId,
            targetWarehouseId: r.targetWarehouseId,
            items: r.items.length,
            lastLog: r.logs[r.logs.length - 1],
            updatedAt: r.updatedAt
        }
    }
    case 'document': {
        const d = entity as AppDocument
        return {
            code: d.code,
            name: d.name,
            type: d.type,
            size: d.size,
            status: d.status,
            createdAt: d.createdAt
        }
    }
  }
}

export function createAuditLog(prev: AppState, next: AppState, action: AppAction): AuditLog | null {
  const actorUserId = prev.currentUserId ?? next.currentUserId
  const reason = action.meta?.reason?.trim() ? action.meta?.reason?.trim() : undefined

  if (action.type === 'requests/upsert') {
      const before = prev.requests.find(r => r.id === action.request.id) ?? null
      const after = next.requests.find(r => r.id === action.request.id) ?? null
      if (!after) return null
      
      // Determine action type
      let auditAction: AuditLog['action'] = before ? 'update' : 'create'
      
      return {
          id: newId('log'),
          actorUserId,
          action: auditAction,
          entityType: 'request',
          entityId: after.id,
          entityCode: after.code,
          before: before ? toAuditSnapshot('request', before) : undefined,
          after: toAuditSnapshot('request', after),
          reason,
          createdAt: nowIso()
      }
  }

  if (action.type === 'documents/upsert') {
    const before = prev.documents.find((d) => d.id === action.document.id) ?? null
    const after = next.documents.find((d) => d.id === action.document.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'document',
      entityId: after.id,
      entityCode: after.code,
      before: before ? toAuditSnapshot('document', before) : undefined,
      after: toAuditSnapshot('document', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'documents/delete') {
    const before = prev.documents.find((d) => d.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'document',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('document', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stockVouchers/upsert') {
    const before = prev.stockVouchers.find((x) => x.id === action.voucher.id) ?? null
    const after = next.stockVouchers.find((x) => x.id === action.voucher.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'stock_voucher',
      entityId: after.id,
      entityCode: after.code,
      before: before ? toAuditSnapshot('stock_voucher', before) : undefined,
      after: toAuditSnapshot('stock_voucher', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stockVouchers/delete') {
    const before = prev.stockVouchers.find((x) => x.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'stock_voucher',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('stock_voucher', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stockVouchers/finalize') {
    const before = prev.stockVouchers.find((x) => x.id === action.id) ?? null
    const after = next.stockVouchers.find((x) => x.id === action.id) ?? null
    if (!before || !after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'update',
      entityType: 'stock_voucher',
      entityId: after.id,
      entityCode: after.code,
      before: toAuditSnapshot('stock_voucher', before),
      after: toAuditSnapshot('stock_voucher', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'orders/upsert') {
    const before = prev.orders.find((o) => o.id === action.order.id) ?? null
    const after = next.orders.find((o) => o.id === action.order.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'order',
      entityId: after.id,
      entityCode: after.code,
      before: before ? toAuditSnapshot('order', before) : undefined,
      after: toAuditSnapshot('order', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'orders/delete') {
    const before = prev.orders.find((o) => o.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'order',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('order', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stock/add') {
    const after = next.stockTransactions.find((t) => t.id === action.tx.id) ?? null
    return {
      id: newId('log'),
      actorUserId,
      action: 'create',
      entityType: 'stock_tx',
      entityId: action.tx.id,
      before: undefined,
      after: toAuditSnapshot('stock_tx', after ?? action.tx),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stockCounts/upsert') {
    const before = prev.stockCounts.find((s) => s.id === action.stockCount.id) ?? null
    const after = next.stockCounts.find((s) => s.id === action.stockCount.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'stock_count',
      entityId: after.id,
      entityCode: after.code,
      before: before ? toAuditSnapshot('stock_count', before) : undefined,
      after: toAuditSnapshot('stock_count', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'stockCounts/delete') {
    const before = prev.stockCounts.find((s) => s.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'stock_count',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('stock_count', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'finance/add') {
    const after = next.financeTransactions.find((t) => t.id === action.tx.id) ?? null
    return {
      id: newId('log'),
      actorUserId,
      action: 'create',
      entityType: 'finance_tx',
      entityId: action.tx.id,
      after: toAuditSnapshot('finance_tx', after ?? action.tx),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'debts/upsert') {
    const before = prev.debts.find((d) => d.id === action.debt.id) ?? null
    const after = next.debts.find((d) => d.id === action.debt.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'debt',
      entityId: after.id,
      before: before ? toAuditSnapshot('debt', before) : undefined,
      after: toAuditSnapshot('debt', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'debts/delete') {
    const before = prev.debts.find((d) => d.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'debt',
      entityId: before.id,
      before: toAuditSnapshot('debt', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'products/upsert') {
    const before = prev.products.find((p) => p.id === action.product.id) ?? null
    const after = next.products.find((p) => p.id === action.product.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'product',
      entityId: after.id,
      entityCode: after.internalCode,
      before: before ? toAuditSnapshot('product', before) : undefined,
      after: toAuditSnapshot('product', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'skus/upsert') {
    const before = prev.skus.find((s) => s.id === action.sku.id) ?? null
    const after = next.skus.find((s) => s.id === action.sku.id) ?? null
    if (!after) return null
    return {
      id: newId('log'),
      actorUserId,
      action: before ? 'update' : 'create',
      entityType: 'sku',
      entityId: after.id,
      entityCode: after.skuCode,
      before: before ? toAuditSnapshot('sku', before) : undefined,
      after: toAuditSnapshot('sku', after),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'products/delete') {
    const before = prev.products.find((p) => p.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'product',
      entityId: before.id,
      entityCode: before.internalCode,
      before: toAuditSnapshot('product', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'customers/delete') {
    const before = prev.customers.find((c) => c.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'customer',
      entityId: before.id,
      before: toAuditSnapshot('customer', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'suppliers/delete') {
    const before = prev.suppliers.find((s) => s.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'supplier',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('supplier', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'categories/delete') {
    const before = prev.categories.find((c) => c.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'category',
      entityId: before.id,
      before: toAuditSnapshot('category', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'locations/delete') {
    const before = prev.locations.find((l) => l.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'location',
      entityId: before.id,
      entityCode: before.code,
      before: toAuditSnapshot('location', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'skus/delete') {
    const before = prev.skus.find((s) => s.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'sku',
      entityId: before.id,
      entityCode: before.skuCode,
      before: toAuditSnapshot('sku', before),
      reason,
      createdAt: nowIso(),
    }
  }

  if (action.type === 'users/delete') {
    const before = prev.users.find((u) => u.id === action.id) ?? null
    if (!before) return null
    return {
      id: newId('log'),
      actorUserId,
      action: 'delete',
      entityType: 'user',
      entityId: before.id,
      entityCode: before.username,
      before: toAuditSnapshot('user', before),
      reason,
      createdAt: nowIso(),
    }
  }

  return null
}

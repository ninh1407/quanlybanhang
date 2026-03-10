import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type {
  Customer,
  Order,
  OrderAttachment,
  OrderAttachmentType,
  OrderItem,
  OrderPaymentMethod,
  OrderSource,
  OrderStatus,
  OrderType,
  ReconcileStatus,
  Sku,
} from '../domain/types'
import { canTransitionOrderStatus, getAllowedNextOrderStatuses, orderStatusLabels } from '../domain/orderWorkflow'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { exportCsv, exportXlsx } from '../lib/export'
import { validateAttachmentFiles } from '../lib/attachments'
import { useListView } from '../ui-kit/listing/useListView'
import { Pagination } from '../ui-kit/listing/Pagination'
import { SavedViewsBar } from '../ui-kit/listing/SavedViewsBar'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { useDialogs } from '../ui-kit/Dialogs'
import { Layout, List, CheckCircle, Truck, Package, AlertCircle, Clock } from 'lucide-react'
import { printOrder } from '../lib/print'

// --- Types & Constants ---

type ItemDraft = {
  skuId: string
  qty: number
  price: number
}

type OrdersFilters = {
  status: OrderStatus | 'all'
  source: OrderSource | 'all'
  locationId: string | 'all'
  carrierReconcile: ReconcileStatus | 'all'
  supplierReconcile: ReconcileStatus | 'all'
  from: string
  to: string
}

const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: 'draft', label: 'Nháp' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'packed', label: 'Đã đóng gói' },
  { value: 'shipped', label: 'Đang giao hàng' },
  { value: 'delivered', label: 'Đã giao hàng' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'returned', label: 'Hoàn trả' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'pending_cancel', label: 'Chờ hủy' },
]

const reconcileOptions: { value: ReconcileStatus; label: string }[] = [
  { value: 'unreconciled', label: 'Chưa đối soát' },
  { value: 'reconciled', label: 'Đã đối soát' },
  { value: 'disputed', label: 'Khiếu nại' },
]

const attachmentOptions: { value: OrderAttachmentType; label: string }[] = [
  { value: 'payment_bill', label: 'Bill thanh toán' },
  { value: 'delivery', label: 'Ảnh giao hàng' },
  { value: 'warehouse', label: 'Phiếu kho' },
  { value: 'vat', label: 'Hóa đơn VAT' },
  { value: 'carrier', label: 'Chứng từ vận chuyển' },
  { value: 'other_cost', label: 'Chi phí khác' },
  { value: 'signature', label: 'Chữ ký' },
  { value: 'other', label: 'Khác' },
]

// --- Helpers ---

function toMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function rangeMs(from: string, to: string) {
  const startMs = from ? new Date(from).getTime() : null
  const endMs = to ? new Date(to).getTime() + 86400000 : null
  return { startMs, endMs }
}

function orderTotal(order: Order): number {
  let itemTotal = 0
  if (order.subTotalOverride !== null) {
    itemTotal = order.subTotalOverride
  } else {
    itemTotal = order.items.reduce((acc, it) => acc + it.qty * it.price, 0)
  }
  return itemTotal - (order.discountAmount || 0) + (order.shippingFee || 0) + (order.vatAmount || 0) + (order.otherFees || 0)
}

function getSkuDisplayName(productsById: Map<string, string>, sku: Sku): string {
  const pName = productsById.get(sku.productId) || 'Unknown'
  return `${pName} ${sku.skuCode} ${sku.color} ${sku.size}`
}

function toOrderItems(items: ItemDraft[]): OrderItem[] {
  return items.filter((it) => it.skuId).map((it) => ({ skuId: it.skuId, qty: it.qty, price: it.price }))
}

function expandStockOut(sku: Sku, qty: number): { skuId: string; qty: number }[] {
  if (sku.kind === 'single') return [{ skuId: sku.id, qty }]
  return sku.components.map((c) => ({ skuId: c.skuId, qty: c.qty * qty }))
}

function expandStockIn(sku: Sku, qty: number): { skuId: string; qty: number }[] {
  if (sku.kind === 'single') return [{ skuId: sku.id, qty }]
  return sku.components.map((c) => ({ skuId: c.skuId, qty: c.qty * qty }))
}

function parseCodImport(text: string): any[] {
  try {
      const trimmed = text.trim()
      if (trimmed.startsWith('[')) return JSON.parse(trimmed)
      return trimmed.split('\n').map(line => {
          const parts = line.split(',')
          return {
              code: parts[0]?.trim(),
              amount: Number(parts[1]) || 0,
              shippingFee: Number(parts[2]) || 0,
              carrierName: parts[3]?.trim() || '',
              trackingCode: parts[4]?.trim() || '',
              status: parts[5]?.trim() || 'shipped'
          }
      })
  } catch (e) {
      return []
  }
}

// --- Component ---

function KanbanCard({ order, customer, onSelect }: { order: Order, customer: Customer | null, onSelect: (id: string) => void }) {
    return (
        <div 
            onClick={() => onSelect(order.id)}
            style={{ 
                background: 'white', 
                padding: 12, 
                marginBottom: 12, 
                borderRadius: 6, 
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                borderLeft: `4px solid ${order.status === 'paid' ? 'green' : order.status === 'cancelled' ? 'red' : order.status === 'pending_cancel' ? 'orange' : 'blue'}`
            }}
        >
            <div className="row-between" style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{order.code}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{formatDateTime(order.createdAt)}</div>
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{customer ? customer.name : 'Khách lẻ'}</div>
            <div className="row-between" style={{ marginTop: 8 }}>
                <div className="badge badge-neutral">{formatVnd(orderTotal(order))}</div>
                <div style={{ fontSize: 12 }}>{order.trackingCode}</div>
            </div>
        </div>
    )
}

function OrderRow({ order, customer, locationLabel, canWrite, isAdmin, onSelect, onSetPaid, onSetReturned, onDelete, onRequestCancel, onApproveCancel, onRejectCancel }: {
    order: Order,
    customer: Customer | null,
    locationLabel: string,
    canWrite: boolean,
    isAdmin: boolean,
    onSelect: (id: string) => void,
    onSetPaid: (order: Order) => void,
    onSetReturned: (order: Order) => void,
    onDelete: (order: Order) => void,
    onRequestCancel: (order: Order) => void,
    onApproveCancel: (order: Order) => void,
    onRejectCancel: (order: Order) => void
}) {
    const total = orderTotal(order)
    return (
        <tr onClick={() => onSelect(order.id)} style={{ cursor: 'pointer' }}>
            <td>{order.code}</td>
            <td>{order.source}</td>
            <td>
                <div>{customer ? customer.name : 'Khách lẻ'}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{customer?.phone}</div>
            </td>
            <td>{locationLabel}</td>
            <td>{formatDateTime(order.createdAt)}</td>
            <td>
                <span className={`badge badge-${order.status === 'paid' ? 'success' : order.status === 'cancelled' ? 'danger' : order.status === 'pending_cancel' ? 'warning' : 'neutral'}`}>
                    {orderStatusLabels[order.status]}
                </span>
            </td>
            <td>
                <div>{order.carrierName}</div>
                <div style={{ fontSize: 11 }}>{order.trackingCode}</div>
            </td>
            <td>{order.isReconciledCarrier === 'reconciled' ? 'Đã đối soát' : '-'}</td>
            <td>{order.isReconciledSupplier === 'reconciled' ? 'Đã đối soát' : '-'}</td>
            <td style={{ fontWeight: 600 }}>{formatVnd(total)}</td>
            <td className="cell-actions" onClick={e => e.stopPropagation()}>
                {canWrite && !['cancelled', 'returned', 'pending_cancel'].includes(order.status) && (
                    <button className="btn btn-small btn-warning" onClick={() => onRequestCancel(order)} title="Yêu cầu hủy">
                        Hủy
                    </button>
                )}
                {isAdmin && order.status === 'pending_cancel' && (
                  <>
                    <button className="btn btn-small btn-success" onClick={() => onApproveCancel(order)} title="Duyệt hủy">
                        Duyệt
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => onRejectCancel(order)} title="Từ chối hủy">
                        Từ chối
                    </button>
                  </>
                )}
                {canWrite && order.status !== 'paid' && order.status !== 'cancelled' && order.status !== 'pending_cancel' && (
                    <button className="btn btn-small btn-success" onClick={() => onSetPaid(order)}>
                        TT
                    </button>
                )}
                {canWrite && order.status === 'shipped' && (
                    <button className="btn btn-small btn-warning" onClick={() => onSetReturned(order)}>
                        Hoàn
                    </button>
                )}
                {isAdmin && (order.status === 'draft' || order.status === 'cancelled') && (
                    <button className="btn btn-small btn-danger" onClick={() => onDelete(order)}>
                        Xóa
                    </button>
                )}
            </td>
        </tr>
    )
}
import { findBestLocationForOrder, getStockKey } from '../domain/fulfillment'

export function OrdersPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can, user } = useAuth()
  const canWrite = can('orders:write')
  const isAdmin = user?.role === 'admin'
  const dialogs = useDialogs()

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban')

  const [type, setType] = useState<OrderType>('internal')
  const [source, setSource] = useState<OrderSource>('pos')
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('cod')
  const [customerId, setCustomerId] = useState<string>('')
  const [status, setStatus] = useState<OrderStatus>('paid')
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState<string>('')
  const [note, setNote] = useState('')
  const [shippingFee, setShippingFee] = useState<number>(0)
  const [carrierName, setCarrierName] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [platformOrderId, setPlatformOrderId] = useState('')
  const [dropshipBrand, setDropshipBrand] = useState('')
  const [partnerVoucherCode, setPartnerVoucherCode] = useState('')
  const [subTotalOverride, setSubTotalOverride] = useState<number>(0)
  const [vatAmount, setVatAmount] = useState<number>(0)
  const [otherFees, setOtherFees] = useState<number>(0)
  const [otherFeesNote, setOtherFeesNote] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([{ skuId: '', qty: 1, price: 0 }])
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(0)
  const [paymentBillFiles, setPaymentBillFiles] = useState<FileList | null>(null)
  const [shippingProofFiles, setShippingProofFiles] = useState<FileList | null>(null)
  const [codImport, setCodImport] = useState('')
  const [usePoints, setUsePoints] = useState<number>(0)

  // Pre-calculate stock map for fulfillment
  const stockMap = useMemo(() => {
      const m = new Map<string, number>()
      state.stockTransactions.forEach(t => {
          const loc = t.locationId || 'unknown'
          const key = getStockKey(t.skuId, loc)
          const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
          m.set(key, (m.get(key) ?? 0) + delta)
      })
      return m
  }, [state.stockTransactions])

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const selectedOrder = useMemo(
    () => (selectedOrderId ? state.orders.find((o) => o.id === selectedOrderId) ?? null : null),
    [selectedOrderId, state.orders],
  )
  const selectedOrderHasStockTx = useMemo(() => {
    if (!selectedOrder) return false
    return state.stockTransactions.some((t) => t.refType === 'order' && t.refId === selectedOrder.id)
  }, [selectedOrder, state.stockTransactions])

  const orderLogs = useMemo(() => {
    if (!selectedOrderId) return []
    return state.auditLogs
      .filter((l) => l.entityType === 'order' && l.entityId === selectedOrderId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [selectedOrderId, state.auditLogs])

  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const skusById = useMemo(() => new Map(state.skus.map((s) => [s.id, s])), [state.skus])
  const skus = useMemo(() => {
    const activeProducts = new Set(state.products.filter((p) => p.active && !p.isMaterial).map((p) => p.id))
    return state.skus
      .filter((s) => s.active && activeProducts.has(s.productId))
      .slice()
      .sort((a, b) => getSkuDisplayName(productsById, a).localeCompare(getSkuDisplayName(productsById, b)))
  }, [productsById, state.products, state.skus])
  const customers = useMemo(() => state.customers, [state.customers])
  const customersById = useMemo(() => new Map(state.customers.map((c) => [c.id, c])), [state.customers])
  const defaultLocationId = useMemo(
    () => state.locations.find((l) => l.active)?.id ?? null,
    [state.locations],
  )
  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )
  const locationsById = useMemo(() => new Map(state.locations.map((l) => [l.id, l])), [state.locations])
  const usersById = useMemo(() => new Map(state.users.map((u) => [u.id, u])), [state.users])
  const orders = useMemo(
    () => state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.orders],
  )

  const customerStats = useMemo(() => {
    const stats = new Map<string, { total: number; success: number }>()
    state.orders.forEach((o) => {
      if (!o.customerId) return
      const s = stats.get(o.customerId) ?? { total: 0, success: 0 }
      s.total++
      if (o.status === 'delivered' || o.status === 'paid') {
        s.success++
      }
      stats.set(o.customerId, s)
    })
    return stats
  }, [state.orders])

  const list = useListView<OrdersFilters>('orders', {
    q: '',
    sortKey: 'createdAt',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    filters: {
      status: 'all',
      source: 'all',
      locationId: 'all',
      carrierReconcile: 'all',
      supplierReconcile: 'all',
      from: '',
      to: '',
    },
  })

  const filteredOrders = useMemo(() => {
    const { startMs, endMs } = rangeMs(list.state.filters.from, list.state.filters.to)
    const needle = list.state.q.trim().toLowerCase()
    const withCustomer = orders.map((o) => ({
      order: o,
      customer: o.customerId ? customersById.get(o.customerId) ?? null : null,
    }))

    const filtered = withCustomer
      .filter(({ order }) => {
        if (list.state.filters.status !== 'all' && order.status !== list.state.filters.status) return false
        if (list.state.filters.source !== 'all' && order.source !== list.state.filters.source) return false
        if (list.state.filters.locationId !== 'all') {
          const loc = order.fulfillmentLocationId ?? defaultLocationId ?? ''
          if (loc !== list.state.filters.locationId) return false
        }
        if (
          list.state.filters.carrierReconcile !== 'all' &&
          order.isReconciledCarrier !== list.state.filters.carrierReconcile
        )
          return false
        if (
          list.state.filters.supplierReconcile !== 'all' &&
          order.isReconciledSupplier !== list.state.filters.supplierReconcile
        )
          return false

        const ms = toMs(order.createdAt)
        if (startMs != null && ms < startMs) return false
        if (endMs != null && ms > endMs) return false

        if (!needle) return true
        const total = orderTotal(order)
        const locId = order.fulfillmentLocationId ?? defaultLocationId ?? ''
        const locText = locId ? `${locationsById.get(locId)?.code ?? ''} ${locationsById.get(locId)?.name ?? ''}` : ''
        const hay = [
          order.code,
          order.trackingCode,
          order.carrierName,
          order.note,
          order.status,
          order.source,
          locText,
          String(total),
        ]
          .concat(order.customerId ? [customersById.get(order.customerId)?.name ?? '', customersById.get(order.customerId)?.phone ?? ''] : [])
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
      .map(({ order, customer }) => ({ order, customer, total: orderTotal(order) }))

    const sorted = filtered.sort((a, b) => {
      const dir = list.state.sortDir === 'asc' ? 1 : -1
      switch (list.state.sortKey) {
        case 'code':
          return dir * String(a.order.code).localeCompare(String(b.order.code))
        case 'status':
          return dir * String(a.order.status).localeCompare(String(b.order.status))
        case 'total':
          return dir * (a.total - b.total)
        case 'createdAt':
        default:
          return dir * String(a.order.createdAt).localeCompare(String(b.order.createdAt))
      }
    })

    return sorted
  }, [customersById, defaultLocationId, list.state.filters, list.state.q, list.state.sortDir, list.state.sortKey, locationsById, orders])

  const pagedOrders = useMemo(() => {
    const start = (list.state.page - 1) * list.state.pageSize
    const end = start + list.state.pageSize
    return filteredOrders.slice(start, end)
  }, [filteredOrders, list.state.page, list.state.pageSize])

  function exportOrders(kind: 'csv' | 'xlsx') {
    const rows = filteredOrders.map(({ order: o, customer }) => ({
      'Mã đơn': o.code,
      'Loại đơn': o.type === 'dropship' ? 'Dropship' : 'Nội bộ',
      'Nguồn': o.source,
      'Thanh toán': o.paymentMethod === 'cod' ? 'COD' : 'Chuyển khoản',
      'Mã sàn': o.platformOrderId || '',
      'Thương hiệu (Dropship)': o.dropshipBrand || '',
      'Mã phiếu đối tác': o.partnerVoucherCode || '',
      'Kho xử lý':
        (o.fulfillmentLocationId
          ? locationsById.get(o.fulfillmentLocationId)?.code
          : defaultLocationId
            ? locationsById.get(defaultLocationId)?.code
            : '') ?? '',
      'Trạng thái': o.status,
      'Tổng tiền': orderTotal(o),
      'Phí ship': o.shippingFee,
      'VAT': o.vatAmount,
      'Phí khác': o.otherFees,
      'Chiết khấu': o.discountAmount,
      'Khách': customer ? customer.name : 'Khách lẻ',
      'SĐT': customer ? customer.phone : '',
      'ĐVVC': o.carrierName,
      'Vận đơn': o.trackingCode,
      'Đối soát VC': o.isReconciledCarrier,
      'Đối soát NCC': o.isReconciledSupplier,
      'Kết quả đối soát': o.reconciliationResultAmount,
      'Ghi chú': o.note,
      'Ngày tạo': o.createdAt,
    }))
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    if (kind === 'csv') exportCsv(`don-hang-${stamp}.csv`, rows)
    else exportXlsx(`don-hang-${stamp}.xlsx`, 'DonHang', rows)
  }

  const stockQtyBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  }, [state.stockTransactions])

  const availableQtyBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    state.skus.forEach((sku) => {
      if (sku.kind === 'single') {
        m.set(sku.id, stockQtyBySkuId.get(sku.id) ?? 0)
        return
      }
      if (!sku.components.length) {
        m.set(sku.id, 0)
        return
      }
      let min = Infinity
      sku.components.forEach((c) => {
        const per = Number(c.qty) || 0
        if (per <= 0) {
          min = 0
          return
        }
        const stock = stockQtyBySkuId.get(c.skuId) ?? 0
        const can = Math.floor(stock / per)
        if (can < min) min = can
      })
      m.set(sku.id, Number.isFinite(min) ? min : 0)
    })
    return m
  }, [state.skus, stockQtyBySkuId])

  const orderItems = useMemo(() => toOrderItems(items), [items])
  const discountPercent = discountPercentInput
  const subTotal = useMemo(() => {
    if (source !== 'pos' && type !== 'dropship') return Number(subTotalOverride) || 0
    return orderItems.reduce((acc, it) => acc + it.qty * it.price, 0)
  }, [orderItems, source, subTotalOverride, type])
  const discountAmount = useMemo(() => {
    if (source !== 'pos' && type !== 'dropship') return 0
    const percentDisc = Math.round((subTotal * (Number(discountPercent) || 0)) / 100)
    const pointsDisc = (usePoints || 0) * 1000
    return percentDisc + pointsDisc
  }, [discountPercent, source, subTotal, type, usePoints])
  const total = useMemo(() => subTotal - discountAmount + (Number(shippingFee) || 0), [discountAmount, shippingFee, subTotal])

  function setItem(idx: number, next: ItemDraft) {
    const copy = items.slice()
    copy[idx] = next
    setItems(copy)
  }

  function addLine() {
    setItems([...items, { skuId: '', qty: 1, price: 0 }])
  }

  function removeLine(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function suggestWarehouse() {
      const needed = items.filter(i => i.skuId).map(i => ({ skuId: i.skuId, qty: Number(i.qty) || 1 }))
      if (!needed.length) return
      
      const customer = customersById.get(customerId)
      const address = customer?.address || ''

      const bestLocId = findBestLocationForOrder(
          needed, 
          locations, 
          stockMap, 
          address,
          state.warehouseRegionMappings,
          state.allocationRules
      )
      
      if (bestLocId) {
          setFulfillmentLocationId(bestLocId)
          void dialogs.alert({ message: `Đã chọn kho phù hợp: ${locationsById.get(bestLocId)?.name}` })
      } else {
          // Check for Split Order suggestion
          // Simple check: do we have enough stock across ALL locations?
          const totalAvailable = new Map<string, number>()
          locations.forEach(loc => {
              if (!loc.active) return
              needed.forEach(item => {
                  const key = getStockKey(item.skuId, loc.id)
                  const stock = stockMap.get(key) ?? 0
                  totalAvailable.set(item.skuId, (totalAvailable.get(item.skuId) ?? 0) + stock)
              })
          })
          
          const possible = needed.every(item => (totalAvailable.get(item.skuId) ?? 0) >= item.qty)
          
          if (possible) {
              void dialogs.alert({ message: 'Hệ thống gợi ý: Không có 1 kho nào đủ hàng, nhưng tổng tồn toàn hệ thống ĐỦ. Vui lòng TÁCH ĐƠN (Split Order) để xử lý.' })
          } else {
               void dialogs.alert({ message: 'Không tìm thấy kho nào đủ hàng cho đơn này (Tổng tồn cũng không đủ).' })
          }
      }
  }

  function resetForm() {
    setType('internal')
    setSource('pos')
    setPaymentMethod('cod')
    setCustomerId('')
    setStatus('paid')
    setFulfillmentLocationId('')
    setNote('')
    setShippingFee(0)
    setCarrierName('')
    setTrackingCode('')
    setPlatformOrderId('')
    setDropshipBrand('')
    setPartnerVoucherCode('')
    setSubTotalOverride(0)
    setVatAmount(0)
    setOtherFees(0)
    setOtherFeesNote('')
    setItems([{ skuId: '', qty: 1, price: 0 }])
    setDiscountPercentInput(0)
    setPaymentBillFiles(null)
    setShippingProofFiles(null)
  }

  function awardLoyaltyPoints(order: Order) {
    if (!order.customerId) return
    const customer = customersById.get(order.customerId)
    if (!customer) return
    
    // 1 point per 100,000 VND
    const total = orderTotal(order)
    const earned = Math.floor(total / 100000)
    if (earned <= 0) return

    dispatch({
        type: 'customers/upsert',
        customer: { ...customer, loyaltyPoints: (customer.loyaltyPoints || 0) + earned }
    })
    
    // Update order to record awarded points
    dispatch({
        type: 'orders/upsert',
        order: { ...order, loyaltyPointsAwarded: earned }
    })
    
    void dialogs.alert({ message: `Khách hàng ${customer.name} được cộng ${earned} điểm tích lũy.` })
  }

  function addFinanceIncome(order: Order) {
    if (order.type === 'dropship') return
    const createdAt = nowIso()
    dispatch({
      type: 'finance/add',
      tx: {
        id: newId('fin'),
        code: '',
        type: 'income',
        amount: orderTotal(order),
        category: 'Bán hàng',
        note: `Thu từ đơn ${order.code}`,
        createdAt,
        locationId: order.fulfillmentLocationId || undefined,
        refType: 'order',
        refId: order.id,
        attachments: [],
      },
    })
  }

  function addFinanceRefund(order: Order) {
    if (order.type === 'dropship') return
    const createdAt = nowIso()
    dispatch({
      type: 'finance/add',
      tx: {
        id: newId('fin'),
        code: '',
        type: 'expense',
        amount: Math.max(0, orderTotal(order)),
        category: 'Hoàn/Refund',
        note: `Hoàn tiền đơn ${order.code}`,
        createdAt,
        locationId: order.fulfillmentLocationId || undefined,
        refType: 'order',
        refId: order.id,
        attachments: [],
      },
    })
  }

  function addStockOut(order: Order) {
    if (order.type === 'dropship') return
    const createdAt = nowIso()
    const locationId = order.fulfillmentLocationId ?? defaultLocationId
    order.items.forEach((it) => {
      const sku = skusById.get(it.skuId)
      if (!sku) return
      expandStockOut(sku, it.qty).forEach((out) => {
        dispatch({
          type: 'stock/add',
          tx: {
            id: newId('stk'),
            code: '',
            type: 'out',
            skuId: out.skuId,
            locationId,
            qty: out.qty,
            unitCost: null,
            note: `Xuất kho theo đơn ${order.code}`,
            createdAt,
            refType: 'order',
            refId: order.id,
          },
        })
      })
    })
  }

  function addStockIn(order: Order) {
    if (order.type === 'dropship') return
    const createdAt = nowIso()
    const locationId = order.fulfillmentLocationId ?? defaultLocationId
    order.items.forEach((it) => {
      const sku = skusById.get(it.skuId)
      if (!sku) return
      expandStockIn(sku, it.qty).forEach((inn) => {
        dispatch({
          type: 'stock/add',
          tx: {
            id: newId('stk'),
            code: '',
            type: 'in',
            skuId: inn.skuId,
            locationId,
            qty: inn.qty,
            unitCost: null,
            note: `Nhập lại do hoàn đơn ${order.code}`,
            createdAt,
            refType: 'order',
            refId: order.id,
          },
        })
      })
    })
  }

  function recordDropshipProfit(order: Order) {
    if (order.type !== 'dropship') return
    const amount = order.reconciliationResultAmount
    if (!amount) return

    const isProfit = amount > 0
    const createdAt = nowIso()
    dispatch({
      type: 'finance/add',
      tx: {
        id: newId('fin'),
        code: '',
        type: isProfit ? 'income' : 'expense',
        amount: Math.abs(amount),
        category: isProfit ? 'Lợi nhuận Dropship' : 'Chi phí Dropship',
        note: `Đối soát đơn Dropship ${order.code}`,
        createdAt,
        refType: 'order',
        refId: order.id,
        attachments: [],
      },
    })
    void dialogs.alert({ message: 'Đã ghi nhận giao dịch tài chính thành công.' })
  }

  async function readAttachments(files: FileList | null, type: OrderAttachmentType): Promise<OrderAttachment[]> {
    const validated = validateAttachmentFiles(files)
    if (!validated.ok) {
      await dialogs.alert({ message: validated.error })
      return []
    }
    if (!validated.files.length) return []
    const createdAt = nowIso()

    const readers = validated.files.map(
      (f) =>
        new Promise<OrderAttachment | null>((resolve) => {
          const r = new FileReader()
          r.onload = () => {
            const dataUrl = typeof r.result === 'string' ? r.result : ''
            if (!dataUrl) return resolve(null)
            // Limit base64 size if needed, but for now allow
            resolve({
              id: newId('att'),
              type,
              name: f.name,
              dataUrl,
              createdAt,
            })
          }
          r.onerror = () => resolve(null)
          r.readAsDataURL(f)
        }),
    )

    return (await Promise.all(readers)).filter(Boolean) as OrderAttachment[]
  }

  async function createOrder() {
    if (!canWrite) return
    if ((source === 'pos' || type === 'dropship') && orderItems.length === 0) return
    if (source !== 'pos' && type !== 'dropship' && (Number(subTotalOverride) || 0) <= 0) return

    const id = newId('ord')
    const createdAt = nowIso()
    const code = trackingCode.trim() && source === 'cod' ? `COD-${trackingCode.trim()}` : ''

    // Read attachments
    const attachments: OrderAttachment[] = []
    if (paymentBillFiles) {
        const atts = await readAttachments(paymentBillFiles, 'payment_bill')
        attachments.push(...atts)
    }
    if (shippingProofFiles) {
        const atts = await readAttachments(shippingProofFiles, 'delivery')
        attachments.push(...atts)
    }

    const order: Order = {
      id,
      code,
      type,
      customerId: source === 'pos' || type === 'dropship' ? customerId || null : null,
      fulfillmentLocationId: (fulfillmentLocationId || defaultLocationId) ?? null,
      source,
      paymentMethod,
      status,
      items: source === 'pos' || type === 'dropship' ? orderItems : [],
      subTotalOverride: source !== 'pos' && type !== 'dropship' ? Number(subTotalOverride) || 0 : null,
      shippingFee: Math.max(0, Number(shippingFee) || 0),
      carrierName: carrierName.trim(),
      trackingCode: trackingCode.trim(),
      platformOrderId: platformOrderId.trim() || undefined,
      dropshipBrand: type === 'dropship' ? dropshipBrand.trim() : undefined,
      partnerVoucherCode: type === 'dropship' ? partnerVoucherCode.trim() : undefined,
      discountPercent: Number(discountPercentInput) || 0,
      discountAmount: source === 'pos' || type === 'dropship' ? discountAmount : 0,
      loyaltyPointsUsed: usePoints > 0 ? usePoints : undefined,
      vatAmount: Math.max(0, Number(vatAmount) || 0),
      otherFees: Math.max(0, Number(otherFees) || 0),
      otherFeesNote: otherFeesNote.trim() || undefined,
      note: note.trim(),
      isReconciledCarrier: 'unreconciled',
      isReconciledSupplier: 'unreconciled',
      attachments,
      createdAt,
      createdByUserId: user?.id,
    }

    dispatch({ type: 'orders/upsert', order })

    // Deduct Points
    if (usePoints > 0 && customerId) {
        const c = customersById.get(customerId)
        if (c) {
            dispatch({
                type: 'customers/upsert',
                customer: { ...c, loyaltyPoints: Math.max(0, (c.loyaltyPoints || 0) - usePoints) }
            })
        }
    }

    if (order.status === 'paid') {
      addFinanceIncome(order)
      awardLoyaltyPoints(order)
      if (order.source === 'pos') addStockOut(order)
    } else if (order.paymentMethod === 'debt' && (order.status === 'delivered' || order.status === 'shipped' || order.status === 'confirmed')) {
       // If Debt, we create Debt record instead of Finance Income
       if (true) {
          addDebtRecord(order)
          if (order.source === 'pos') addStockOut(order)
       }
    }

    resetForm()
  }

  function addDebtRecord(order: Order) {
    if (order.paymentMethod !== 'debt') return
    if (!order.customerId) return
    const customer = customersById.get(order.customerId)
    const amount = orderTotal(order)
    if (amount <= 0) return
    
    // Check if debt already exists for this order
    const existing = state.debts.find(d => d.note.includes(order.code))
    if (existing) return

    const createdAt = nowIso()
    dispatch({
      type: 'debts/upsert',
      debt: {
        id: newId('dbt'),
        code: `CN${state.debts.length + 1}`,
        type: 'receivable',
        partnerId: order.customerId,
        partnerName: customer ? customer.name : 'Unknown',
        amount,
        status: 'open',
        dueDate: null,
        note: `Công nợ đơn hàng ${order.code}`,
        createdAt,
        settledAt: null
      }
    })
  }

  function updateOrder(order: Order, patch: Partial<Order>, metaReason?: string) {
    const updates = { ...patch }
    if ('status' in patch && patch.status) {
      const nextStatus = patch.status
      if (nextStatus !== order.status) {
        if (!canTransitionOrderStatus(order.status, nextStatus)) {
          void dialogs.alert({
            message: `Không thể chuyển trạng thái từ "${orderStatusLabels[order.status]}" sang "${orderStatusLabels[nextStatus]}".`,
          })
          return
        }
        if (nextStatus === 'confirmed' && !order.confirmedByUserId) updates.confirmedByUserId = user?.id
        if (nextStatus === 'packed' && !order.packedByUserId) updates.packedByUserId = user?.id
        if (nextStatus === 'shipped' && !order.shippedByUserId) updates.shippedByUserId = user?.id
        if (nextStatus === 'cancelled' && !order.cancelledByUserId) updates.cancelledByUserId = user?.id
      }
    }
    const reason = metaReason?.trim() ? metaReason.trim() : undefined
    dispatch({ type: 'orders/upsert', order: { ...order, ...updates }, meta: reason ? { reason } : undefined })
  }

  function setPaid(order: Order) {
    if (!canWrite) return
    if (order.status === 'paid') return
    if (!canTransitionOrderStatus(order.status, 'paid')) {
      void dialogs.alert({
        message: `Không thể chuyển trạng thái từ "${orderStatusLabels[order.status]}" sang "${orderStatusLabels.paid}".`,
      })
      return
    }
    updateOrder(order, { status: 'paid' })
    addFinanceIncome({ ...order, status: 'paid' })
    awardLoyaltyPoints({ ...order, status: 'paid' })
    if (order.source === 'pos') addStockOut(order)
  }

  function setReturned(order: Order) {
    if (!canWrite) return
    if (order.status === 'returned') return
    if (!canTransitionOrderStatus(order.status, 'returned')) {
      void dialogs.alert({
        message: `Không thể chuyển trạng thái từ "${orderStatusLabels[order.status]}" sang "${orderStatusLabels.returned}".`,
      })
      return
    }
    updateOrder(order, { status: 'returned' })
    addFinanceRefund({ ...order, status: 'returned' })
    if (order.source === 'pos') addStockIn(order)
  }

  async function onRequestCancel(order: Order) {
    if (!canWrite) return
    if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'pending_cancel') {
        await dialogs.alert({ message: 'Đơn này không thể yêu cầu hủy.' })
        return
    }
    
    const reason = await dialogs.prompt({ message: 'Nhập lý do hủy đơn (bắt buộc):', required: true })
    if (reason == null) return
    if (!reason.trim()) {
      await dialogs.alert({ message: 'Vui lòng nhập lý do.' })
      return
    }
    
    updateOrder(order, { status: 'pending_cancel', cancelReason: reason.trim() }, `Requested cancel: ${reason.trim()}`)
    await dialogs.alert({ message: 'Đã gửi yêu cầu hủy đơn. Vui lòng chờ Admin duyệt.' })
  }

  async function onApproveCancel(order: Order) {
    if (!isAdmin) return
    const ok = await dialogs.confirm({ message: `Duyệt hủy và XÓA VĨNH VIỄN đơn ${order.code}?\nLý do hủy: ${order.cancelReason}`, dangerous: true })
    if (!ok) return
    
    dispatch({ type: 'orders/delete', id: order.id, meta: { reason: `Admin approved cancel request: ${order.cancelReason}` } })
    if (selectedOrderId === order.id) setSelectedOrderId(null)
    await dialogs.alert({ message: 'Đã xóa đơn thành công.' })
  }

  async function onRejectCancel(order: Order) {
    if (!isAdmin) return
    const ok = await dialogs.confirm({ message: `Từ chối hủy đơn ${order.code}? Trạng thái sẽ về "Xác nhận".` })
    if (!ok) return
    
    updateOrder(order, { status: 'confirmed', cancelReason: undefined }, 'Admin rejected cancel')
  }

  async function deleteOrder(order: Order) {
    if (!isAdmin) return
    if (order.status !== 'draft' && order.status !== 'cancelled') {
      await dialogs.alert({ message: 'Chỉ cho phép xóa đơn ở trạng thái Nháp hoặc Hủy.' })
      return
    }
    const reason = await dialogs.prompt({ message: 'Nhập lý do xóa đơn (bắt buộc):', required: true })
    if (reason == null) return
    if (!reason.trim()) {
      await dialogs.alert({ message: 'Vui lòng nhập lý do xóa đơn.' })
      return
    }
    const ok = await dialogs.confirm({ message: `Xóa đơn ${order.code}?`, dangerous: true })
    if (!ok) return
    dispatch({ type: 'orders/delete', id: order.id, meta: { reason: reason.trim() } })
    if (selectedOrderId === order.id) setSelectedOrderId(null)
  }

  async function addAttachments(order: Order, type: OrderAttachmentType, files: FileList | null) {
    const validated = validateAttachmentFiles(files)
    if (!validated.ok) {
      await dialogs.alert({ message: validated.error })
      return
    }
    if (!validated.files.length) return
    const createdAt = nowIso()

    const readers = validated.files.map(
      (f) =>
        new Promise<OrderAttachment | null>((resolve) => {
          const r = new FileReader()
          r.onload = () => {
            const dataUrl = typeof r.result === 'string' ? r.result : ''
            if (!dataUrl) return resolve(null)
            resolve({
              id: newId('att'),
              type,
              name: f.name,
              dataUrl,
              createdAt,
            })
          }
          r.onerror = () => resolve(null)
          r.readAsDataURL(f)
        }),
    )

    const next = (await Promise.all(readers)).filter(Boolean) as OrderAttachment[]
    if (!next.length) return
    updateOrder(order, { attachments: [...order.attachments, ...next] })
  }

  function removeAttachment(order: Order, attachmentId: string) {
    updateOrder(order, { attachments: order.attachments.filter((a) => a.id !== attachmentId) })
  }

  function importCodOrders() {
    if (!canWrite) return
    const rows = parseCodImport(codImport).filter((r) => r.code && r.amount > 0)
    if (!rows.length) return
    const createdAt = nowIso()
    rows.forEach((r) => {
      const id = newId('ord')
      const order: Order = {
        id,
        code: r.code || '',
        customerId: null,
        fulfillmentLocationId: defaultLocationId,
        type: 'internal',
        source: 'cod',
        paymentMethod: 'cod',
        status: r.status,
        items: [],
        subTotalOverride: r.amount,
        shippingFee: Math.max(0, r.shippingFee),
        carrierName: r.carrierName.trim(),
        trackingCode: r.trackingCode.trim(),
        discountPercent: 0,
        discountAmount: 0,
        vatAmount: 0,
        otherFees: 0,
        note: r.note?.trim() || '',
        isReconciledCarrier: 'unreconciled',
        isReconciledSupplier: 'unreconciled',
        attachments: [],
        createdAt,
      }
      dispatch({ type: 'orders/upsert', order })
      if (order.status === 'paid') addFinanceIncome(order)
    })
    setCodImport('')
  }

  const stats = useMemo(() => {
    const total = state.orders.length
    const returned = state.orders.filter((o) => o.status === 'returned').length
    const shippedOrDelivered = state.orders.filter((o) => o.status === 'shipped' || o.status === 'delivered' || o.status === 'returned').length
    const returnRate = shippedOrDelivered > 0 ? returned / shippedOrDelivered : 0
    return { total, returned, shippedOrDelivered, returnRate }
  }, [state.orders])

  const kanbanColumns = useMemo(() => [
      { id: 'new', label: 'Mới', statuses: ['draft', 'confirmed'] as OrderStatus[], icon: <Clock size={16} /> },
      { id: 'processing', label: 'Đang xử lý', statuses: ['picking', 'packed', 'ready_to_ship'] as OrderStatus[], icon: <Package size={16} /> },
      { id: 'shipping', label: 'Đang giao', statuses: ['shipped'] as OrderStatus[], icon: <Truck size={16} /> },
      { id: 'delivered', label: 'Đã giao / Thành công', statuses: ['delivered', 'paid'] as OrderStatus[], icon: <CheckCircle size={16} /> },
      { id: 'returned', label: 'Hủy / Hoàn', statuses: ['pending_cancel', 'returned', 'cancelled'] as OrderStatus[], icon: <AlertCircle size={16} /> },
  ], [])

  return (
    <div className="page">
      <div className="row-between" style={{ marginBottom: 20 }}>
          <PageHeader title="Quản lý đơn hàng" />
          <div className="row">
              <button className="btn" onClick={() => exportOrders('xlsx')}>
                Xuất Excel
              </button>
              <button className="btn" onClick={() => exportOrders('csv')}>
                Xuất CSV
              </button>
              <button 
                className={`btn ${viewMode === 'kanban' ? 'btn-primary' : ''}`} 
                onClick={() => setViewMode('kanban')}
              >
                  <Layout size={16} /> Kanban
              </button>
              <button 
                className={`btn ${viewMode === 'table' ? 'btn-primary' : ''}`} 
                onClick={() => setViewMode('table')}
              >
                  <List size={16} /> Danh sách
              </button>
          </div>
      </div>

      <div className="grid">
        <div className="stat">
          <div className="stat-label">Tổng đơn</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Đơn hoàn</div>
          <div className="stat-value">{stats.returned}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tỷ lệ hoàn</div>
          <div className="stat-value">{(stats.returnRate * 100).toFixed(1)}%</div>
        </div>
      </div>

      {canWrite ? (
        <div className="card">
          <div className="card-title">Tạo đơn thủ công</div>
          <div className="grid-form">
            <div className="field">
              <label>Loại đơn</label>
              <select value={type} onChange={(e) => setType(e.target.value as OrderType)}>
                <option value="internal">Đơn nội bộ</option>
                <option value="dropship">Dropshipping</option>
              </select>
            </div>
            <div className="field">
              <label>Nguồn</label>
              <select value={source} onChange={(e) => setSource(e.target.value as OrderSource)}>
                <option value="pos">POS</option>
                <option value="cod">COD</option>
                <option value="web">Web</option>
                <option value="social">Social</option>
                <option value="shopee">Shopee</option>
                <option value="tiktok">Tiktok</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div className="field">
              <label>Hình thức thanh toán</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as OrderPaymentMethod)}>
                <option value="cod">COD</option>
                <option value="transfer">Chuyển khoản</option>
                <option value="debt">Công nợ (Thanh toán sau)</option>
              </select>
            </div>
            {paymentMethod === 'transfer' && (
              <div className="field">
                <label>Bill chuyển khoản</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setPaymentBillFiles(e.target.files)}
                />
              </div>
            )}
            <div className="field">
              <label>Giảm giá (%)</label>
              <input
                type="number"
                value={discountPercentInput}
                onChange={(e) => setDiscountPercentInput(Number(e.target.value))}
              />
            </div>
            {customerId && customersById.get(customerId) && (
              <div className="field">
                <label>
                  Dùng điểm (Có: {customersById.get(customerId)!.loyaltyPoints || 0})
                </label>
                <input
                  type="number"
                  value={usePoints}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value))
                    const max = customersById.get(customerId!)!.loyaltyPoints || 0
                    if (v > max) return 
                    setUsePoints(v)
                  }}
                />
                <div className="hint">Giảm {formatVnd(usePoints * 1000)}</div>
              </div>
            )}
            <div className="field">
              <label>Trạng thái</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {allStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {type === 'internal' ? (
              <div className="field">
                <label>
                    Kho xử lý 
                    <button 
                        type="button" 
                        className="btn-link" 
                        style={{ marginLeft: 8, fontSize: 12 }} 
                        onClick={suggestWarehouse}
                    >
                        (Gợi ý kho)
                    </button>
                </label>
                <select value={fulfillmentLocationId} onChange={(e) => setFulfillmentLocationId(e.target.value)}>
                  <option value="">(Mặc định)</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Thương hiệu (Dropship)</label>
                  <input value={dropshipBrand} onChange={(e) => setDropshipBrand(e.target.value)} />
                </div>
                <div className="field">
                  <label>Mã phiếu đối tác</label>
                  <input value={partnerVoucherCode} onChange={(e) => setPartnerVoucherCode(e.target.value)} />
                </div>
              </>
            )}

            <div className="field">
              <label>Mã đơn sàn</label>
              <input value={platformOrderId} onChange={(e) => setPlatformOrderId(e.target.value)} />
            </div>

            {source === 'pos' || type === 'dropship' ? (
              <div className="field field-span-2">
                <label>Khách hàng</label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    const id = e.target.value
                    setCustomerId(id)
                    const c = customersById.get(id)
                    setDiscountPercentInput(c ? c.discountPercent : 0)
                  }}
                >
                  <option value="">Khách lẻ</option>
                  {customers.map((c) => {
                    const s = customerStats.get(c.id)
                    const rate = s && s.total > 0 ? Math.round((s.success / s.total) * 100) : null
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - CK {c.discountPercent}% {rate !== null ? `(${rate}%)` : ''}
                      </option>
                    )
                  })}
                </select>
                {customerId ? (
                  <div className="hint" style={{ marginTop: 4 }}>
                    Tỷ lệ thành công:{' '}
                    {(() => {
                      const s = customerStats.get(customerId)
                      if (!s || s.total === 0) return 'Chưa có dữ liệu'
                      const rate = Math.round((s.success / s.total) * 100)
                      return (
                        <span style={{ color: rate < 50 ? 'red' : rate < 80 ? 'orange' : 'green', fontWeight: 600 }}>
                          {rate}% ({s.success}/{s.total} đơn)
                        </span>
                      )
                    })()}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Tổng tiền hàng</label>
                  <input
                    type="number"
                    value={subTotalOverride}
                    onChange={(e) => setSubTotalOverride(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Mã vận đơn</label>
                  <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} />
                </div>
              </>
            )}

            <div className="field">
              <label>Đơn vị vận chuyển</label>
              <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
            </div>
            {carrierName.toLowerCase().includes('hỏa tốc') && (
              <div className="field">
                <label>Ảnh đặt ship / Bill</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setShippingProofFiles(e.target.files)}
                />
              </div>
            )}
            <div className="field">
              <label>Phí ship</label>
              <input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>VAT (đ)</label>
              <input type="number" value={vatAmount} onChange={(e) => setVatAmount(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Phí khác (đ)</label>
              <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Ghi chú phí khác</label>
              <input value={otherFeesNote} onChange={(e) => setOtherFeesNote(e.target.value)} />
            </div>
            <div className="field field-span-2">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {source === 'pos' ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const sku = it.skuId ? skusById.get(it.skuId) : undefined
                    const stock = sku ? (availableQtyBySkuId.get(sku.id) ?? 0) : 0
                    return (
                      <tr key={idx}>
                        <td>
                          <select
                            value={it.skuId}
                            onChange={(e) => {
                              const sid = e.target.value
                              const s = skusById.get(sid)
                              setItem(idx, { ...it, skuId: sid, price: s ? s.price : 0 })
                            }}
                          >
                            <option value="">Chọn SKU</option>
                            {skus.map((s) => (
                              <option key={s.id} value={s.id}>
                                {getSkuDisplayName(productsById, s)} ({s.skuCode}) (Tồn:{' '}
                                {availableQtyBySkuId.get(s.id) ?? 0})
                              </option>
                            ))}
                          </select>
                          {sku ? <div className="hint">Tồn kho hiện tại: {stock}</div> : null}
                        </td>
                        <td>
                          <input type="number" value={it.qty} onChange={(e) => setItem(idx, { ...it, qty: Number(e.target.value) })} />
                        </td>
                        <td>
                          <input type="number" value={it.price} onChange={(e) => setItem(idx, { ...it, price: Number(e.target.value) })} />
                        </td>
                        <td>{formatVnd((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                        <td className="cell-actions">
                          <button className="btn btn-small btn-danger" onClick={() => removeLine(idx)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="row row-between">
            {source === 'pos' || type === 'dropship' ? (
              <button className="btn" onClick={addLine}>
                + Thêm dòng
              </button>
            ) : (
              <div />
            )}
            <div className="total">
              Tạm tính: {formatVnd(subTotal)} | CK: {formatVnd(discountAmount)} | Ship: {formatVnd(shippingFee)} | Tổng:{' '}
              {formatVnd(total)}
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={createOrder}>
              Tạo đơn
            </button>
            <button className="btn" onClick={resetForm}>
              Mới
            </button>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="card">
          <div className="card-title">Đồng bộ đơn với web COD tay</div>
          <div className="field">
            <label>Dán JSON array hoặc CSV/TSV: code,amount,shippingFee,carrierName,trackingCode,status</label>
            <textarea
              value={codImport}
              onChange={(e) => setCodImport(e.target.value)}
              rows={6}
            />
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={importCodOrders}>
              Nhập COD
            </button>
            <button className="btn" onClick={() => setCodImport('')}>
              Xóa nội dung
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Tìm kiếm / lọc / sắp xếp</div>
        <div className="grid-form">
          <div className="field field-span-2">
            <label>Tìm kiếm</label>
            <input
              value={list.state.q}
              onChange={(e) => list.patch({ q: e.target.value })}
              placeholder="Mã đơn, vận đơn, khách, SĐT, ghi chú…"
            />
          </div>
          <div className="field">
            <label>Trạng thái</label>
            <select
              value={list.state.filters.status}
              onChange={(e) => list.patchFilters({ status: e.target.value as OrdersFilters['status'] })}
            >
              <option value="all">Tất cả</option>
              {allStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nguồn</label>
            <select
              value={list.state.filters.source}
              onChange={(e) => list.patchFilters({ source: e.target.value as OrdersFilters['source'] })}
            >
              <option value="all">Tất cả</option>
              <option value="pos">POS</option>
              <option value="cod">COD</option>
            </select>
          </div>
          <div className="field">
            <label>Kho xử lý</label>
            <select
              value={list.state.filters.locationId}
              onChange={(e) => list.patchFilters({ locationId: e.target.value as OrdersFilters['locationId'] })}
            >
              <option value="all">Tất cả</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} - {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Đối soát VC</label>
            <select
              value={list.state.filters.carrierReconcile}
              onChange={(e) => list.patchFilters({ carrierReconcile: e.target.value as OrdersFilters['carrierReconcile'] })}
            >
              <option value="all">Tất cả</option>
              {reconcileOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Đối soát NCC</label>
            <select
              value={list.state.filters.supplierReconcile}
              onChange={(e) =>
                list.patchFilters({ supplierReconcile: e.target.value as OrdersFilters['supplierReconcile'] })
              }
            >
              <option value="all">Tất cả</option>
              {reconcileOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Từ ngày</label>
            <input
              type="date"
              value={list.state.filters.from}
              onChange={(e) => list.patchFilters({ from: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Đến ngày</label>
            <input type="date" value={list.state.filters.to} onChange={(e) => list.patchFilters({ to: e.target.value })} />
          </div>
          <div className="field">
            <label>Sắp xếp</label>
            <select value={list.state.sortKey} onChange={(e) => list.patch({ sortKey: e.target.value })}>
              <option value="createdAt">Ngày tạo</option>
              <option value="total">Tổng tiền</option>
              <option value="code">Mã đơn</option>
              <option value="status">Trạng thái</option>
            </select>
          </div>
          <div className="field">
            <label>Chiều</label>
            <select
              value={list.state.sortDir}
              onChange={(e) => list.patch({ sortDir: e.target.value as 'asc' | 'desc' })}
            >
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </div>
        </div>

        <div className="row row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Hiển thị {filteredOrders.length}/{orders.length} đơn
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <SavedViewsBar
              views={list.views}
              onApply={list.applyView}
              onSave={list.saveCurrentAs}
              onDelete={list.deleteView}
            />
            <button className="btn btn-small" onClick={list.reset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', height: 'calc(100vh - 300px)', paddingBottom: 16, marginBottom: 20 }}>
              {kanbanColumns.map(col => (
                  <div key={col.id} style={{ minWidth: 280, width: 280, background: 'var(--neutral-100)', borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-color)' }}>
                          {col.icon} {col.label}
                          <div className="badge badge-neutral" style={{ marginLeft: 'auto' }}>
                              {filteredOrders.filter(({ order }) => col.statuses.includes(order.status)).length}
                          </div>
                      </div>
                      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                          {filteredOrders
                            .filter(({ order }) => col.statuses.includes(order.status))
                            .map(({ order, customer }) => (
                              <KanbanCard 
                                key={order.id} 
                                order={order} 
                                customer={customer}
                                onSelect={setSelectedOrderId}
                              />
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nguồn</th>
                    <th>Khách</th>
                    <th>Kho</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                    <th>ĐVVC</th>
                    <th>Đối soát ĐVVC</th>
                    <th>Đối soát NCC</th>
                    <th>Tổng</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pagedOrders.map(({ order: o, customer }) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      customer={customer}
                      locationLabel={
                        (o.fulfillmentLocationId
                          ? locationsById.get(o.fulfillmentLocationId)?.code
                          : defaultLocationId
                            ? locationsById.get(defaultLocationId)?.code
                            : '') ?? ''
                      }
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      onSelect={setSelectedOrderId}
                      onSetPaid={setPaid}
                      onSetReturned={setReturned}
                      onDelete={deleteOrder}
                      onRequestCancel={onRequestCancel}
                      onApproveCancel={onApproveCancel}
                      onRejectCancel={onRejectCancel}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={list.state.page}
              pageSize={list.state.pageSize}
              totalItems={filteredOrders.length}
              onChangePage={(page) => list.patch({ page })}
              onChangePageSize={(pageSize) => list.patch({ pageSize })}
            />
          </div>
      )}

      {selectedOrder && (
          <div className="modal-overlay" onClick={() => setSelectedOrderId(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 800, maxWidth: '90vw' }}>
                 <div className="row-between" style={{ marginBottom: 16 }}>
                    <h3>Chi tiết đơn: {selectedOrder.code}</h3>
                    <div className="row">
                      {canWrite && !['cancelled', 'returned', 'pending_cancel'].includes(selectedOrder.status) && (
                          <button className="btn btn-warning" onClick={() => onRequestCancel(selectedOrder)}>
                              Yêu cầu hủy
                          </button>
                      )}
                      {isAdmin && selectedOrder.status === 'pending_cancel' && (
                        <>
                          <button className="btn btn-success" onClick={() => onApproveCancel(selectedOrder)}>
                              Duyệt hủy
                          </button>
                          <button className="btn btn-danger" onClick={() => onRejectCancel(selectedOrder)}>
                              Từ chối hủy
                          </button>
                        </>
                      )}
                      {selectedOrder.type === 'internal' && (
                        <button className="btn" onClick={() => {
                          const items = selectedOrder.items.map(it => {
                             const sku = skusById.get(it.skuId)
                             return {
                               name: sku ? getSkuDisplayName(productsById, sku) : 'Unknown',
                               unit: sku ? (sku.unit || 'Cái') : 'Cái',
                               qty: it.qty,
                               price: it.price,
                               total: it.qty * it.price
                             }
                          })
                          const customer = selectedOrder.customerId ? customersById.get(selectedOrder.customerId) ?? null : null
                          const user = usersById.get(selectedOrder.createdByUserId ?? '') ?? null
                          
                          printOrder(selectedOrder, items, customer, user)
                        }}>
                          In phiếu xuất kho
                        </button>
                      )}
                      {isAdmin && (selectedOrder.status === 'draft' || selectedOrder.status === 'cancelled') && (
                          <button className="btn btn-danger" onClick={() => deleteOrder(selectedOrder)}>
                              Xóa đơn
                          </button>
                      )}
                      <button className="btn" onClick={() => window.open(`#/orders/${selectedOrder.id}/print`, '_blank')}>
                          In phiếu
                      </button>
                      <button className="btn" onClick={() => setSelectedOrderId(null)}>Đóng</button>
                    </div>
                 </div>

                 <div className="grid-form">
                    <div className="field">
                       <label>Trạng thái</label>
                       <select
                         value={selectedOrder.status}
                         onChange={(e) => updateOrder(selectedOrder, { status: e.target.value as OrderStatus })}
                         disabled={!canWrite}
                       >
                          {getAllowedNextOrderStatuses(selectedOrder.status).map((st) => (
                            <option key={st} value={st}>
                              {orderStatusLabels[st]}
                            </option>
                          ))}
                       </select>
                    </div>
                    {selectedOrder.cancelReason && (
                      <div className="field field-span-2" style={{ background: '#fff4e5', padding: 8, borderRadius: 4, border: '1px solid #ffe0b2' }}>
                        <label style={{ color: '#e65100', display: 'block', marginBottom: 4 }}>Lý do hủy:</label>
                        <div style={{ fontWeight: 600 }}>{selectedOrder.cancelReason}</div>
                      </div>
                    )}
                    <div className="field">
                       <label>Loại đơn</label>
                       <select
                         value={selectedOrder.type}
                         onChange={(e) => updateOrder(selectedOrder, { type: e.target.value as OrderType })}
                         disabled={!canWrite}
                       >
                         <option value="internal">Đơn nội bộ</option>
                         <option value="dropship">Dropshipping</option>
                       </select>
                    </div>

                   <div className="form-section-title field-span-2" style={{ marginTop: 16, marginBottom: 8, fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                      Thông tin xử lý đơn hàng
                   </div>

                   {selectedOrder.type === 'internal' ? (
                    <div className="field">
                      <label>Kho xử lý</label>
                      <select
                        value={selectedOrder.fulfillmentLocationId ?? defaultLocationId ?? ''}
                        onChange={(e) => {
                          void (async () => {
                            const nextId = e.target.value
                            const currentId = selectedOrder.fulfillmentLocationId ?? defaultLocationId ?? ''
                            if (nextId === currentId) return
                            const canChange =
                              canWrite &&
                              !selectedOrderHasStockTx &&
                              (selectedOrder.status === 'draft' || selectedOrder.status === 'confirmed' || selectedOrder.status === 'packed')
                            if (!canChange) {
                              await dialogs.alert({
                                message: 'Chỉ cho phép điều chuyển kho khi đơn còn nháp/xác nhận/đóng gói và chưa phát sinh phiếu kho.',
                              })
                              return
                            }
                            const reason = await dialogs.prompt({ message: 'Nhập lý do điều chuyển kho xử lý (bắt buộc):', required: true })
                            if (reason == null) return
                            if (!reason.trim()) return
                            updateOrder(selectedOrder, { fulfillmentLocationId: nextId || null }, reason.trim())
                          })()
                        }}
                        disabled={
                          !canWrite ||
                          selectedOrderHasStockTx ||
                          !(selectedOrder.status === 'draft' || selectedOrder.status === 'confirmed' || selectedOrder.status === 'packed')
                        }
                      >
                        <option value="">(Mặc định)</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} - {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    ) : (
                      <>
                        <div className="field">
                          <label>Thương hiệu (Dropship)</label>
                          <input
                            value={selectedOrder.dropshipBrand || ''}
                            onChange={(e) => updateOrder(selectedOrder, { dropshipBrand: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label>Mã phiếu đối tác</label>
                          <input
                            value={selectedOrder.partnerVoucherCode || ''}
                            onChange={(e) => updateOrder(selectedOrder, { partnerVoucherCode: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    <div className="field">
                      <label>Nguồn</label>
                      <select
                        value={selectedOrder.source}
                        onChange={(e) => updateOrder(selectedOrder, { source: e.target.value as OrderSource })}
                      >
                        <option value="pos">POS</option>
                        <option value="cod">COD</option>
                        <option value="web">Web</option>
                        <option value="social">Social</option>
                        <option value="shopee">Shopee</option>
                        <option value="tiktok">Tiktok</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Hình thức thanh toán</label>
                      <select
                        value={selectedOrder.paymentMethod}
                        onChange={(e) => updateOrder(selectedOrder, { paymentMethod: e.target.value as OrderPaymentMethod })}
                      >
                        <option value="cod">COD</option>
                        <option value="transfer">Chuyển khoản</option>
                        <option value="debt">Công nợ</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Mã đơn sàn</label>
                      <input
                        value={selectedOrder.platformOrderId || ''}
                        onChange={(e) => updateOrder(selectedOrder, { platformOrderId: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Đơn vị vận chuyển</label>
                      <input
                        value={selectedOrder.carrierName}
                        onChange={(e) => updateOrder(selectedOrder, { carrierName: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Mã vận đơn</label>
                      <input
                        value={selectedOrder.trackingCode}
                        onChange={(e) => updateOrder(selectedOrder, { trackingCode: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Phí ship</label>
                      <input
                        type="number"
                        value={selectedOrder.shippingFee}
                        onChange={(e) => updateOrder(selectedOrder, { shippingFee: Number(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label>VAT (đ)</label>
                      <input
                        type="number"
                        value={selectedOrder.vatAmount}
                        onChange={(e) => updateOrder(selectedOrder, { vatAmount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label>Phí khác (đ)</label>
                      <input
                        type="number"
                        value={selectedOrder.otherFees}
                        onChange={(e) => updateOrder(selectedOrder, { otherFees: Number(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label>Ghi chú phí khác</label>
                      <input
                        value={selectedOrder.otherFeesNote || ''}
                        onChange={(e) => updateOrder(selectedOrder, { otherFeesNote: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Tiền hàng (override)</label>
                      <input
                        type="number"
                        value={selectedOrder.subTotalOverride ?? 0}
                        onChange={(e) =>
                          updateOrder(selectedOrder, {
                            subTotalOverride: selectedOrder.source === 'cod' ? Number(e.target.value) : null,
                          })
                        }
                        disabled={selectedOrder.source !== 'cod'}
                      />
                    </div>
                    <div className="field">
                      <label>Đối soát ĐVVC</label>
                      <select
                        value={selectedOrder.isReconciledCarrier}
                        onChange={(e) => updateOrder(selectedOrder, { isReconciledCarrier: e.target.value as ReconcileStatus })}
                      >
                        {reconcileOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Đối soát NCC</label>
                      <select
                        value={selectedOrder.isReconciledSupplier}
                        onChange={(e) => updateOrder(selectedOrder, { isReconciledSupplier: e.target.value as ReconcileStatus })}
                      >
                        {reconcileOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Kết quả đối soát (đ)</label>
                      <div className="row">
                        <input
                          type="number"
                          style={{ flex: 1 }}
                          value={selectedOrder.reconciliationResultAmount ?? 0}
                          onChange={(e) => updateOrder(selectedOrder, { reconciliationResultAmount: Number(e.target.value) })}
                        />
                        {selectedOrder.type === 'dropship' && (selectedOrder.reconciliationResultAmount || 0) !== 0 && (
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => recordDropshipProfit(selectedOrder)}
                            title="Tạo giao dịch thu/chi tương ứng"
                          >
                            Ghi nhận
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="field field-span-2">
                      <label>Ghi chú</label>
                      <input value={selectedOrder.note} onChange={(e) => updateOrder(selectedOrder, { note: e.target.value })} />
                    </div>

                    <div className="field">
                      <label>Người tạo đơn</label>
                      <input value={usersById.get(selectedOrder.createdByUserId ?? '')?.fullName ?? 'Unknown'} disabled />
                    </div>
                    
                    {selectedOrder.status === 'cancelled' && selectedOrder.cancelledByUserId && (
                      <div className="field">
                        <label>Người hủy đơn</label>
                        <input value={usersById.get(selectedOrder.cancelledByUserId)?.fullName ?? 'Unknown'} disabled />
                      </div>
                    )}
                    
                    {(selectedOrder.packedByUserId || selectedOrder.shippedByUserId) && (
                      <div className="field">
                        <label>Người xuất kho</label>
                        <input value={usersById.get(selectedOrder.shippedByUserId ?? selectedOrder.packedByUserId!)?.fullName ?? 'Unknown'} disabled />
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Lịch sử hoạt động (Timeline)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {orderLogs.length > 0 ? (
                        orderLogs.map((log) => {
                          const actor = log.actorUserId ? usersById.get(log.actorUserId)?.fullName : 'Hệ thống'
                          const actionLabel = log.action === 'create' ? 'Tạo mới' : log.action === 'update' ? 'Cập nhật' : 'Xóa'
                          const statusChange = log.before && log.after && (log.before as any).status !== (log.after as any).status
                            ? `Trạng thái: ${orderStatusLabels[(log.before as any).status as OrderStatus]} -> ${orderStatusLabels[(log.after as any).status as OrderStatus]}`
                            : ''
                          
                          return (
                            <div key={log.id} style={{ display: 'flex', gap: 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', marginTop: 6 }} />
                                <div style={{ width: 2, flex: 1, background: 'var(--neutral-200)', marginTop: 4 }} />
                              </div>
                              <div style={{ paddingBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                  {actionLabel} bởi {actor}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {formatDateTime(log.createdAt)}
                                </div>
                                {statusChange && (
                                  <div style={{ fontSize: 13, marginTop: 4, color: 'var(--primary-600)' }}>
                                    {statusChange}
                                  </div>
                                )}
                                {log.reason && (
                                  <div style={{ fontSize: 13, marginTop: 4, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                    "{log.reason}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                          Chưa có dữ liệu lịch sử chi tiết (Tính năng Audit Log mới được kích hoạt).
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedOrder.type === 'dropship' && (
                     <div className="card" style={{ marginBottom: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="card-title">Chứng từ Dropship</div>
                        <div className="grid-form">
                           <div className="field">
                              <label>Mã phiếu xuất kho (Đối tác)</label>
                              <input 
                                value={selectedOrder.partnerVoucherCode ?? ''} 
                                onChange={(e) => updateOrder(selectedOrder, { partnerVoucherCode: e.target.value })}
                                placeholder="Nhập mã phiếu..."
                              />
                           </div>
                           <div className="field">
                              <label>Tải lên phiếu kho</label>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                multiple
                                onChange={(e) => {
                                  addAttachments(selectedOrder, 'warehouse', e.target.files)
                                  e.currentTarget.value = ''
                                }}
                              />
                           </div>
                        </div>
                     </div>
                  )}

                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-title">Ảnh bill / chứng từ</div>
                    <div className="row">
                      {attachmentOptions.map((opt) => (
                        <label key={opt.value} className="btn btn-small">
                          {opt.label}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              addAttachments(selectedOrder, opt.value, e.target.files)
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
                          {selectedOrder.attachments.map((a) => (
                            <tr key={a.id}>
                              <td>{attachmentOptions.find((x) => x.value === a.type)?.label ?? a.type}</td>
                              <td>
                                <a href={a.dataUrl} target="_blank" rel="noreferrer">
                                  {a.name}
                                </a>
                              </td>
                              <td>{formatDateTime(a.createdAt)}</td>
                              <td className="cell-actions">
                                <button className="btn btn-small btn-danger" onClick={() => removeAttachment(selectedOrder, a.id)}>
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}

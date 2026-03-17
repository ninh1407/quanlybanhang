import { useMemo, useState, useEffect } from 'react'
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
import { FilterBar } from '../ui-kit/FilterBar'
import { EmptyState } from '../ui-kit/EmptyState'
import { LoadingState } from '../ui-kit/LoadingState'
import { useDialogs } from '../ui-kit/Dialogs'
import {
  Layout,
  List,
  CheckCircle,
  Truck,
  Package,
  AlertCircle,
  Clock,
  Zap,
  Search,
  Plus,
  Minus,
  Printer,
  Save,
  User,
  CreditCard,
  Phone,
  MapPin,
  Trash2,
} from 'lucide-react'
import { printOrder } from '../lib/print'
import { calculateDistance, mockGeocode } from '../lib/geo'

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

function orderStatusBadge(status: OrderStatus): { label: string; className: string } {
  const label = orderStatusLabels[status]
  switch (status) {
    case 'paid':
    case 'delivered':
      return { label, className: 'badge badge-success' }
    case 'confirmed':
    case 'packed':
    case 'shipped':
      return { label, className: 'badge badge-info' }
    case 'pending_cancel':
      return { label, className: 'badge badge-warning' }
    case 'cancelled':
    case 'returned':
      return { label, className: 'badge badge-danger' }
    case 'draft':
    default:
      return { label, className: 'badge badge-neutral' }
  }
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

// Order Timeline Component
function OrderTimeline({ status }: { status: OrderStatus }) {
    const steps: { id: OrderStatus; label: string }[] = [
        { id: 'draft', label: 'Tạo đơn' },
        { id: 'confirmed', label: 'Xác nhận' },
        { id: 'packed', label: 'Đóng gói' },
        { id: 'shipped', label: 'Giao hàng' },
        { id: 'delivered', label: 'Hoàn thành' }
    ]
    
    // Map status to step index
    const getStepIndex = (s: OrderStatus) => {
        if (s === 'paid') return 4
        if (s === 'cancelled' || s === 'returned' || s === 'pending_cancel') return -1 // Special case
        return steps.findIndex(x => x.id === s)
    }
    
    const currentStep = getStepIndex(status)
    const isFailed = status === 'cancelled' || status === 'returned' || status === 'pending_cancel'

    if (isFailed) {
        return (
            <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <AlertCircle /> Đơn hàng ở trạng thái: {orderStatusLabels[status]}
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', position: 'relative' }}>
            {/* Connecting Line */}
            <div style={{ position: 'absolute', top: 34, left: 20, right: 20, height: 2, background: '#e5e7eb', zIndex: 0 }} />
            
            {steps.map((step, idx) => {
                const isCompleted = currentStep >= idx
                const isCurrent = currentStep === idx
                return (
                    <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: 80 }}>
                        <div style={{ 
                            width: 30, 
                            height: 30, 
                            borderRadius: '50%', 
                            background: isCompleted ? '#3b82f6' : '#f3f4f6', 
                            color: isCompleted ? 'white' : '#9ca3af',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: isCurrent ? '4px solid #dbeafe' : 'none',
                            fontWeight: 600,
                            fontSize: 14
                        }}>
                            {isCompleted ? <CheckCircle size={16} /> : (idx + 1)}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? '#111827' : '#6b7280' }}>
                            {step.label}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

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
  const [voucherCode, setVoucherCode] = useState('')
  const [subTotalOverride, setSubTotalOverride] = useState<number>(0)
  const [vatAmount, setVatAmount] = useState<number>(0)
  const [otherFees, setOtherFees] = useState<number>(0)
  const [otherFeesNote, setOtherFeesNote] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([{ skuId: '', qty: 1, price: 0 }])
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(0)
  const [paidAmount, setPaidAmount] = useState<number>(0)
  const [paymentBillFiles, setPaymentBillFiles] = useState<FileList | null>(null)
  const [shippingProofFiles, setShippingProofFiles] = useState<FileList | null>(null)
  const [codImport, setCodImport] = useState('')
  const [usePoints] = useState<number>(0)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Quick Add Customer State
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')

  function handleQuickAddProduct(query: string) {
      if (!query.trim()) return
      const needle = query.trim().toLowerCase()
      // Find exact match by Code first
      let match = skus.find(s => s.skuCode.toLowerCase() === needle)
      // If not, find by Name
      if (!match) {
          const possible = skus.filter(s => getSkuDisplayName(productsById, s).toLowerCase().includes(needle))
          if (possible.length === 1) match = possible[0]
      }

      if (match) {
          // Check if already in items
          const idx = items.findIndex(i => i.skuId === match!.id)
          if (idx >= 0) {
              const next = [...items]
              next[idx].qty += 1
              setItems(next)
          } else {
              // If last item is empty, replace it
              if (items.length > 0 && !items[items.length - 1].skuId) {
                  const next = [...items]
                  next[items.length - 1] = { skuId: match.id, qty: 1, price: match.price }
                  setItems(next)
              } else {
                  setItems([...items, { skuId: match.id, qty: 1, price: match.price }])
              }
          }
      } else {
          void dialogs.alert({ message: 'Không tìm thấy sản phẩm phù hợp!' })
      }
  }

  useEffect(() => {
      const handler = (e: KeyboardEvent) => {
          if (e.key === 'F1') {
              e.preventDefault()
              document.getElementById('quick-search-input')?.focus()
          }
          if (e.key === 'F4') {
              e.preventDefault()
              // Trigger create order button click to avoid closure staleness or call ref
              // For now, we rely on the function being fresh if we add it to deps, but createOrder changes often.
              // Better to use a ref or just let user click. But let's try calling if safe.
          }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
  }, [])

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

  const isLikelyLoading =
    state.currentUserId !== null &&
    state.locations.length === 0 &&
    state.users.length === 0 &&
    state.products.length === 0 &&
    state.skus.length === 0 &&
    state.orders.length === 0

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
    // Simple mock voucher logic: if code is 'GIAM50K' -> 50000
    const voucherDisc = voucherCode === 'GIAM50K' ? 50000 : voucherCode === 'GIAM100K' ? 100000 : 0
    return percentDisc + pointsDisc + voucherDisc
  }, [discountPercent, source, subTotal, type, usePoints, voucherCode])
  const total = useMemo(() => subTotal - discountAmount + (Number(shippingFee) || 0) + (Number(vatAmount) || 0) + (Number(otherFees) || 0), [discountAmount, shippingFee, subTotal, vatAmount, otherFees])
  const estimatedProfit = useMemo(() => {
    if (source !== 'pos' && type !== 'dropship') return 0
    const costTotal = orderItems.reduce((acc, it) => {
        const sku = skusById.get(it.skuId)
        return acc + (sku?.cost || 0) * it.qty
    }, 0)
    return Math.max(0, subTotal - discountAmount - costTotal) // Simple profit = Revenue - COGS (ignoring fees/vat for now or keep simple)
  }, [orderItems, skusById, subTotal, discountAmount])

  function setItem(idx: number, next: ItemDraft) {
    const copy = items.slice()
    copy[idx] = next
    setItems(copy)
  }

  function removeLine(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  async function suggestWarehouse() {
      const needed = items.filter(i => i.skuId).map(i => ({ skuId: i.skuId, qty: Number(i.qty) || 1 }))
      if (!needed.length) {
          void dialogs.alert({ message: 'Vui lòng chọn ít nhất 1 sản phẩm để hệ thống kiểm tra tồn kho và gợi ý.' })
          return
      }
      
      const customer = customersById.get(customerId)
      let address = customer?.address || ''

      // If no customer address, prompt user
      if (!address) {
          const input = await dialogs.prompt({ 
              message: 'Khách hàng chưa có địa chỉ. Vui lòng nhập địa chỉ giao hàng để tính khoảng cách:',
              placeholder: 'Ví dụ: 123 Đường ABC, Quận 1, TP.HCM'
          })
          if (input) {
              address = input
          } else {
              // User cancelled or empty, proceed without address (will rely on stock/rules only)
          }
      }

      const bestLocId = findBestLocationForOrder(
          needed, 
          locations, 
          stockMap, 
          address,
          state.warehouseRegionMappings,
          state.allocationRules
      )
      
      if (bestLocId) {
          const loc = locationsById.get(bestLocId)
          let msg = `Đã chọn kho phù hợp: ${loc?.name}`
          
          if (address) {
              const coords = mockGeocode(address)
              if (coords && loc?.lat && loc?.lng) {
                  const dist = calculateDistance(coords.lat, coords.lng, loc.lat, loc.lng)
                  msg += `\nKhoảng cách ước tính: ${dist.toFixed(1)} km`
              }
          }

          setFulfillmentLocationId(bestLocId)
          void dialogs.alert({ message: msg })
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
    setVoucherCode('')
    setSubTotalOverride(0)
    setVatAmount(0)
    setOtherFees(0)
    setOtherFeesNote('')
    setItems([{ skuId: '', qty: 1, price: 0 }])
    setDiscountPercentInput(0)
    setPaidAmount(0)
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

  function quickAddCustomer() {
      if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
          void dialogs.alert({ message: 'Vui lòng nhập tên và số điện thoại.' })
          return
      }
      
      const id = newId('cus')
      const newCustomer: Customer = {
          id,
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          address: newCustomerAddress.trim(),
          email: '',
          note: 'Khách mới tạo nhanh từ đơn hàng',
          discountPercent: 0,
          loyaltyPoints: 0,
          createdAt: nowIso()
      }
      
      dispatch({ type: 'customers/upsert', customer: newCustomer })
      setCustomerId(id)
      setShowAddCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setNewCustomerAddress('')
      void dialogs.alert({ message: 'Đã tạo khách hàng mới và tự động chọn.' })
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

  async function createOrder(opts?: { statusOverride?: OrderStatus }): Promise<Order | null> {
    if (!canWrite) return null
    if ((source === 'pos' || type === 'dropship') && orderItems.length === 0) return null
    if (source !== 'pos' && type !== 'dropship' && (Number(subTotalOverride) || 0) <= 0) return null

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

    // Automation Rules
    let initialStatus = opts?.statusOverride ?? status
    if (total > 5000000 && status !== 'draft') {
        initialStatus = 'confirmed' // Require manual check for high value
        void dialogs.alert({ message: 'Đơn hàng giá trị cao (>5tr). Hệ thống tự động chuyển về trạng thái "Xác nhận" để chờ duyệt kỹ hơn.' })
    }

    const order: Order = {
      id,
      code,
      type,
      customerId: source === 'pos' || type === 'dropship' ? customerId || null : null,
      fulfillmentLocationId: (fulfillmentLocationId || defaultLocationId) ?? null,
      source,
      paymentMethod,
      status: initialStatus,
      items: source === 'pos' || type === 'dropship' ? orderItems : [],
      subTotalOverride: source !== 'pos' && type !== 'dropship' ? Number(subTotalOverride) || 0 : null,
      shippingFee: Math.max(0, Number(shippingFee) || 0),
      carrierName: carrierName.trim(),
      trackingCode: trackingCode.trim(),
      platformOrderId: platformOrderId.trim() || undefined,
      dropshipBrand: type === 'dropship' ? dropshipBrand.trim() : undefined,
      partnerVoucherCode: type === 'dropship' ? partnerVoucherCode.trim() : undefined,
      voucherCode: voucherCode.trim() || undefined,
      discountPercent: Number(discountPercentInput) || 0,
      discountAmount: source === 'pos' || type === 'dropship' ? discountAmount : 0,
      loyaltyPointsUsed: usePoints > 0 ? usePoints : undefined,
      vatAmount: Math.max(0, Number(vatAmount) || 0),
      otherFees: Math.max(0, Number(otherFees) || 0),
      otherFeesNote: otherFeesNote.trim() || undefined,
      note: note.trim(),
      paidAmount: Math.max(0, Number(paidAmount) || 0),
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
    } else if (order.paidAmount && order.paidAmount > 0) {
        // Partial Payment logic: Record income for paid amount
        const income: Order = { ...order, status: 'paid' } // Mock status for finance recording
        addFinanceIncome(income, order.paidAmount) // Need to update addFinanceIncome to accept amount override
        // If remaining is debt, record debt
        if (order.paymentMethod === 'debt') {
             // Logic to record remaining debt? Currently addDebtRecord uses orderTotal(order)
             // We need to fix addDebtRecord to use (total - paidAmount)
             const debtAmt = orderTotal(order) - (order.paidAmount || 0)
             if (debtAmt > 0) addDebtRecord(order, debtAmt)
        }
    }

    resetForm()
    return order
  }

  function addFinanceIncome(order: Order, amountOverride?: number) {
    if (order.type === 'dropship') return
    const createdAt = nowIso()
    dispatch({
      type: 'finance/add',
      tx: {
        id: newId('fin'),
        code: '',
        type: 'income',
        amount: amountOverride ?? orderTotal(order),
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

  function addDebtRecord(order: Order, amountOverride?: number) {
    if (order.paymentMethod !== 'debt') return
    if (!order.customerId) return
    const customer = customersById.get(order.customerId)
    const amount = amountOverride ?? orderTotal(order)
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
    const ok = await dialogs.confirm({ message: `Duyệt hủy đơn ${order.code}? Trạng thái sẽ chuyển sang "Đã hủy".\nLý do hủy: ${order.cancelReason}` })
    if (!ok) return
    
    updateOrder(order, { status: 'cancelled' }, `Admin approved cancel request: ${order.cancelReason}`)
    await dialogs.alert({ message: 'Đã duyệt hủy đơn thành công.' })
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

  const kanbanColumns = useMemo(() => [
      { id: 'new', label: 'Mới', statuses: ['draft', 'confirmed'] as OrderStatus[], icon: <Clock size={16} /> },
      { id: 'processing', label: 'Đang xử lý', statuses: ['picking', 'packed', 'ready_to_ship'] as OrderStatus[], icon: <Package size={16} /> },
      { id: 'shipping', label: 'Đang giao', statuses: ['shipped'] as OrderStatus[], icon: <Truck size={16} /> },
      { id: 'delivered', label: 'Đã giao / Thành công', statuses: ['delivered', 'paid'] as OrderStatus[], icon: <CheckCircle size={16} /> },
      { id: 'returned', label: 'Hủy / Hoàn', statuses: ['pending_cancel', 'returned', 'cancelled'] as OrderStatus[], icon: <AlertCircle size={16} /> },
  ], [])

  return (
    <div className="page">
      <PageHeader
        title="Quản lý đơn hàng"
        subtitle="Tạo đơn, theo dõi trạng thái và đối soát"
        actions={
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn" onClick={() => exportOrders('xlsx')}>
              Xuất Excel
            </button>
            <button className="btn" onClick={() => exportOrders('csv')}>
              Xuất CSV
            </button>
            <button className={`btn ${viewMode === 'kanban' ? 'btn-primary' : ''}`} onClick={() => setViewMode('kanban')}>
              <Layout size={16} /> Kanban
            </button>
            <button className={`btn ${viewMode === 'table' ? 'btn-primary' : ''}`} onClick={() => setViewMode('table')}>
              <List size={16} /> Danh sách
            </button>
          </div>
        }
      />

      {canWrite ? (
        <div className="order-editor">
          <div className="card order-editor-header">
            <div className="order-editor-title">
              <div>
                <div className="order-editor-h1">Quản lý đơn hàng</div>
                <div className="order-editor-sub">
                  {trackingCode.trim() && source === 'cod' ? `Mã đơn dự kiến: COD-${trackingCode.trim()}` : 'Tạo đơn mới'}
                  {' · '}
                  {source === 'pos'
                    ? 'POS'
                    : source === 'cod'
                      ? 'COD / Ship'
                      : source === 'web'
                        ? 'Website'
                        : source === 'social'
                          ? 'Social'
                          : 'Khác'}
                  {' · '}
                  {(fulfillmentLocationId || defaultLocationId)
                    ? locationsById.get((fulfillmentLocationId || defaultLocationId) as string)?.name ?? 'Kho'
                    : 'Kho mặc định'}
                </div>
              </div>

              <div className="order-editor-badges">
                <span className={orderStatusBadge(status).className}>{orderStatusBadge(status).label}</span>
                <span className="badge badge-neutral">{paymentMethod === 'cod' ? 'COD' : paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Công nợ'}</span>
              </div>
            </div>

            <div className="order-editor-actions">
              <button
                className="btn btn-small"
                onClick={() => {
                  void createOrder({ statusOverride: 'draft' })
                }}
              >
                <Save size={16} />
                Lưu nháp
              </button>
              <button
                className="btn btn-small"
                onClick={() => {
                  void createOrder({ statusOverride: 'confirmed' })
                }}
              >
                <CheckCircle size={16} />
                Xác nhận
              </button>
              <button
                className="btn btn-small"
                onClick={() => {
                  void (async () => {
                    const o = await createOrder({ statusOverride: status })
                    if (!o) return
                    window.open(`#/orders/${o.id}/print`, '_blank')
                  })()
                }}
              >
                <Printer size={16} />
                In phiếu
              </button>
              <button
                className="btn btn-small"
                onClick={() => {
                  void (async () => {
                    const o = await createOrder({ statusOverride: status })
                    if (!o) return
                    const itemsToPrint = o.items.map((it) => {
                      const sku = skusById.get(it.skuId)
                      return {
                        name: sku ? getSkuDisplayName(productsById, sku) : 'Unknown',
                        unit: sku ? (sku.unit || 'Cái') : 'Cái',
                        qty: it.qty,
                        price: it.price,
                        total: it.qty * it.price,
                      }
                    })
                    const customer = o.customerId ? customersById.get(o.customerId) ?? null : null
                    printOrder(o, itemsToPrint, customer, user ?? null)
                  })()
                }}
              >
                <Package size={16} />
                In xuất kho
              </button>
              <button className="btn btn-small" onClick={resetForm}>
                <AlertCircle size={16} />
                Hủy
              </button>
            </div>
          </div>

          <div className="order-create-grid">
            {/* LEFT COLUMN */}
            <div className="order-left">
                
                {/* 1. CUSTOMER & GENERAL INFO */}
                <div className="card order-section">
                    <div className="order-section-head">
                        <div className="order-section-title">
                          <User size={18} />
                          <span className="order-step">Bước 1</span>
                          Khách hàng
                        </div>
                    </div>
                    
                    <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
                         {/* Customer Search / Select */}
                         <div className="field field-span-2">
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Tìm khách hàng (F2)</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select
                                            value={customerId}
                                            onChange={(e) => {
                                                const id = e.target.value
                                                setCustomerId(id)
                                                const c = customersById.get(id)
                                                setDiscountPercentInput(c ? c.discountPercent : 0)
                                            }}
                                            style={{ fontWeight: 500 }}
                                        >
                                            <option value="">-- Khách lẻ --</option>
                                            {customers.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} - {c.phone}
                                                </option>
                                            ))}
                                        </select>
                                        <button className="btn btn-icon" onClick={() => setShowAddCustomer(true)} title="Thêm khách mới">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Customer Details Badge */}
                            {customerId && customersById.get(customerId) && (
                                <div className="order-customer-pill">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Phone size={14} className="text-primary" />
                                        <b>{customersById.get(customerId)?.phone}</b>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={14} className="text-primary" />
                                        <span className="truncate" style={{ maxWidth: 300 }}>{customersById.get(customerId)?.address || 'Chưa có địa chỉ'}</span>
                                    </div>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                        <span className="badge badge-primary">Điểm: {customersById.get(customerId)?.loyaltyPoints}</span>
                                        <span className="badge badge-warning">CK: {customersById.get(customerId)?.discountPercent}%</span>
                                    </div>
                                </div>
                            )}
                         </div>

                    </div>
                </div>

                {/* 2. PRODUCT TABLE (POS STYLE) */}
                <div className="card order-section" style={{ padding: 0, overflow: 'hidden', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                    <div className="order-items-head">
                      <div className="order-section-title" style={{ margin: 0 }}>
                        <Package size={18} />
                        <span className="order-step">Bước 2</span>
                        Sản phẩm
                      </div>
                    </div>
                    {/* Search Bar */}
                    <div className="order-items-toolbar">
                        <div className="order-items-search">
                            <Search size={18} className="order-items-search-icon" />
                            <input 
                                id="quick-search-input"
                                placeholder="Quét mã vạch hoặc nhập tên sản phẩm (F1)..." 
                                className="order-items-search-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleQuickAddProduct(e.currentTarget.value)
                                        e.currentTarget.value = ''
                                    }
                                }}
                            />
                        </div>
                        {/* Quick Action Buttons */}
                         <button className="btn" onClick={suggestWarehouse} title="AI Gợi ý kho">
                            <Zap size={16} fill="#eab308" color="#eab308" />
                            Gợi ý kho
                         </button>
                    </div>

                    {/* Table */}
                    <div className="table-wrap" style={{ flex: 1 }}>
                        <table className="table" style={{ border: 'none' }}>
                            <thead className="order-items-thead">
                                <tr>
                                    <th style={{ width: 60 }}>#</th>
                                    <th>Mã SKU</th>
                                    <th>Tên sản phẩm</th>
                                    <th style={{ width: 100, textAlign: 'center' }}>Tồn</th>
                                    <th style={{ width: 140, textAlign: 'center' }}>Số lượng</th>
                                    <th style={{ textAlign: 'right' }}>Đơn giá</th>
                                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                                    <th style={{ width: 50 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, idx) => {
                                    const sku = it.skuId ? skusById.get(it.skuId) : undefined
                                    // Stock logic
                                    let stock = 0
                                    let stockColor = '#64748b'
                                    if (sku) {
                                        stock = availableQtyBySkuId.get(sku.id) ?? 0
                                        if (fulfillmentLocationId) {
                                             const key = getStockKey(sku.id, fulfillmentLocationId)
                                             stock = stockMap.get(key) ?? 0
                                        }
                                        if (stock <= 0) stockColor = '#ef4444' // Red
                                        else if (stock < 10) stockColor = '#f59e0b' // Yellow
                                        else stockColor = '#10b981' // Green
                                    }

                                    return (
                                        <tr key={idx} className="order-items-row">
                                            <td style={{ color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</td>
                                            <td>
                                                {sku ? (
                                                    <span style={{ fontWeight: 600, color: '#334155' }}>{sku.skuCode}</span>
                                                ) : (
                                                    <select 
                                                        value={it.skuId} 
                                                        onChange={e => {
                                                            const s = skusById.get(e.target.value)
                                                            setItem(idx, { ...it, skuId: e.target.value, price: s ? s.price : 0 })
                                                        }}
                                                        style={{ width: '100%', fontSize: 13, padding: 4 }}
                                                    >
                                                        <option value="">Chọn sản phẩm</option>
                                                        {skus.map(s => <option key={s.id} value={s.id}>{s.skuCode} - {productsById.get(s.productId) || ''}</option>)}
                                                    </select>
                                                )}
                                            </td>
                                            <td>
                                                <div className="order-item-name">{sku ? getSkuDisplayName(productsById, sku) : '-'}</div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {sku ? (
                                                    <span className="order-stock-pill" style={{ background: stockColor }}>
                                                        {stock}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setItem(idx, { ...it, qty: Math.max(1, it.qty - 1) })}
                                                        style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input 
                                                        type="number" 
                                                        value={it.qty} 
                                                        onChange={e => setItem(idx, { ...it, qty: Math.max(1, Number(e.target.value)) })}
                                                        style={{ width: 50, textAlign: 'center', height: 28, border: '1px solid #cbd5e1', borderRadius: 4, fontWeight: 600 }} 
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setItem(idx, { ...it, qty: it.qty + 1 })}
                                                        style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {sku ? formatVnd(it.price) : (
                                                    <input type="number" value={it.price} onChange={e => setItem(idx, {...it, price: Number(e.target.value)})} style={{ width: 80, textAlign: 'right' }} />
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {formatVnd(it.qty * it.price)}
                                            </td>
                                            <td>
                                                <button className="order-item-remove" onClick={() => removeLine(idx)} type="button" title="Xóa dòng">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {/* Empty Row for adding */}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                                            Chưa có sản phẩm. Nhấn F1 hoặc quét mã vạch để thêm.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. SHIPPING INFO */}
                <div className="card order-section">
                     <div className="order-section-head">
                        <div className="order-section-title">
                          <Truck size={18} />
                          <span className="order-step">Bước 3</span>
                          Giao hàng
                        </div>
                    </div>
                    <div className="grid-form" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                         <div className="field">
                            <label>Kho xuất hàng</label>
                            <select value={fulfillmentLocationId} onChange={(e) => setFulfillmentLocationId(e.target.value)}>
                                <option value="">-- Mặc định --</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                            </select>
                         </div>
                         <div className="field">
                             <label>Nguồn đơn</label>
                             <select value={source} onChange={e => setSource(e.target.value as OrderSource)}>
                                 <option value="pos">Tại quầy (POS)</option>
                                 <option value="cod">COD / Ship</option>
                                 <option value="web">Website</option>
                                 <option value="social">Facebook/Social</option>
                                 <option value="other">Khác</option>
                             </select>
                         </div>
                         <div className="field">
                             <label>Trạng thái đơn</label>
                             <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                               {allStatuses.map((s) => (
                                 <option key={s.value} value={s.value}>
                                   {s.label}
                                 </option>
                               ))}
                             </select>
                         </div>
                         <div className="field">
                             <label>Đơn vị vận chuyển</label>
                             <input list="carriers" value={carrierName} onChange={e => setCarrierName(e.target.value)} placeholder="Chọn hoặc nhập..." />
                             <datalist id="carriers">
                                 <option value="Giao Hàng Tiết Kiệm" />
                                 <option value="Giao Hàng Nhanh" />
                                 <option value="Viettel Post" />
                                 <option value="Ahamove" />
                             </datalist>
                         </div>
                         <div className="field">
                             <label>Mã vận đơn</label>
                             <input value={trackingCode} onChange={e => setTrackingCode(e.target.value)} placeholder="Nhập mã..." />
                         </div>
                         <div className="field">
                             <label>Phí ship báo khách</label>
                             <input type="number" value={shippingFee} onChange={e => setShippingFee(Number(e.target.value))} />
                         </div>
                    </div>
                </div>

                <div className="card order-section">
                  <div className="order-section-head">
                    <div className="order-section-title">
                      <MapPin size={18} />
                      <span className="order-step">Bước 4</span>
                      Địa chỉ
                    </div>
                  </div>
                  {customerId && customersById.get(customerId) ? (
                    <div className="order-address-box">
                      <div className="order-address-line">
                        <span className="order-address-label">Khách</span>
                        <span className="order-address-value">{customersById.get(customerId)?.name}</span>
                      </div>
                      <div className="order-address-line">
                        <span className="order-address-label">SĐT</span>
                        <span className="order-address-value">{customersById.get(customerId)?.phone}</span>
                      </div>
                      <div className="order-address-line">
                        <span className="order-address-label">Địa chỉ</span>
                        <span className="order-address-value">{customersById.get(customerId)?.address || 'Chưa có địa chỉ'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="order-muted">Chọn khách hàng để xem địa chỉ và gợi ý giao hàng.</div>
                  )}
                </div>

                <div className="card order-section">
                  <div className="order-section-head">
                    <div className="order-section-title">
                      <Package size={18} />
                      <span className="order-step">Bước 5</span>
                      Ghi chú & nâng cao
                    </div>
                    <button className="btn btn-small" type="button" onClick={() => setAdvancedOpen(!advancedOpen)}>
                      {advancedOpen ? 'Thu gọn' : 'Mở'}
                    </button>
                  </div>
                  {advancedOpen ? (
                    <div className="order-advanced">
                      <div className="grid-form" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        <div className="field">
                          <label>Mã đơn sàn</label>
                          <input value={platformOrderId} onChange={(e) => setPlatformOrderId(e.target.value)} placeholder="Nhập mã đơn sàn..." />
                        </div>
                        <div className="field">
                          <label>Mã voucher nội bộ</label>
                          <input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} placeholder="Ví dụ: GIAM50K" />
                        </div>
                        <div className="field">
                          <label>VAT</label>
                          <input type="number" value={vatAmount} onChange={(e) => setVatAmount(Number(e.target.value))} />
                        </div>
                        <div className="field">
                          <label>Phí khác</label>
                          <input type="number" value={otherFees} onChange={(e) => setOtherFees(Number(e.target.value))} />
                        </div>
                        <div className="field field-span-2">
                          <label>Ghi chú phí khác</label>
                          <input value={otherFeesNote} onChange={(e) => setOtherFeesNote(e.target.value)} placeholder="Nhập mô tả phí khác..." />
                        </div>
                        <div className="field">
                          <label>Bill thanh toán</label>
                          <input type="file" multiple onChange={(e) => setPaymentBillFiles(e.target.files)} />
                        </div>
                        <div className="field">
                          <label>Ảnh giao hàng</label>
                          <input type="file" multiple onChange={(e) => setShippingProofFiles(e.target.files)} />
                        </div>
                        <div className="field field-span-2">
                          <label>Ghi chú nội bộ</label>
                          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="order-note" placeholder="Ghi chú nội bộ..." />
                        </div>
                      </div>

                      <div className="order-advanced-sep" />

                      <div className="order-cod-import">
                        <div className="order-cod-title">Đồng bộ đơn với web COD tay</div>
                        <div className="field">
                          <label>Dán JSON array hoặc CSV/TSV: code,amount,shippingFee,carrierName,trackingCode,status</label>
                          <textarea value={codImport} onChange={(e) => setCodImport(e.target.value)} rows={5} />
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn btn-primary" type="button" onClick={importCodOrders}>
                            Nhập COD
                          </button>
                          <button className="btn" type="button" onClick={() => setCodImport('')}>
                            Xóa nội dung
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
            </div>

            {/* RIGHT COLUMN - STICKY */}
            <div className="order-right">
                <div className="order-sidebar-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card order-summary">
                    <div className="order-section-head">
                      <div className="order-section-title">
                        <CreditCard size={18} />
                        Tóm tắt đơn
                      </div>
                    </div>

                    <div className="order-summary-row">
                      <span className="order-summary-label">Số lượng</span>
                      <span className="order-summary-value">
                        {orderItems.reduce((s, it) => s + (Number(it.qty) || 0), 0).toLocaleString('vi-VN')} sp
                      </span>
                    </div>
                    <div className="order-summary-row">
                      <span className="order-summary-label">Tạm tính</span>
                      <span className="order-summary-value">{formatVnd(subTotal)}</span>
                    </div>
                    <div className="order-summary-row">
                      <span className="order-summary-label">Giảm giá</span>
                      <div className="order-summary-inline">
                        <input
                          type="number"
                          value={discountPercentInput}
                          onChange={e => setDiscountPercentInput(Number(e.target.value))}
                          className="order-discount-input"
                          placeholder="%"
                        />
                        <span className="order-summary-neg">-{formatVnd(discountAmount)}</span>
                      </div>
                    </div>
                    <div className="order-summary-row">
                      <span className="order-summary-label">Phí ship</span>
                      <span className="order-summary-value">{formatVnd(shippingFee)}</span>
                    </div>
                    <div className="order-summary-row">
                      <span className="order-summary-label">VAT / Phí khác</span>
                      <span className="order-summary-value">{formatVnd(vatAmount + otherFees)}</span>
                    </div>

                    <div style={{ borderTop: '2px dashed #e2e8f0', margin: '16px 0' }} />

                    <div className="order-total-row">
                      <span className="order-total-label">Tổng thanh toán</span>
                      <span className="order-total-value">{formatVnd(total)}</span>
                    </div>

                    {estimatedProfit > 0 ? (
                      <div style={{ textAlign: 'center', fontSize: 12, color: '#10b981', marginTop: 8, background: '#ecfdf5', padding: 6, borderRadius: 12 }}>
                        Lãi dự kiến: {formatVnd(estimatedProfit)}
                      </div>
                    ) : null}
                  </div>

                  <div className="card order-section">
                    <div className="order-section-head">
                      <div className="order-section-title">
                        <CheckCircle size={18} />
                        Thanh toán
                      </div>
                    </div>

                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Phương thức</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} style={{ height: 40, fontSize: 14 }}>
                        <option value="cod">Thanh toán khi nhận (COD)</option>
                        <option value="transfer">Chuyển khoản</option>
                        <option value="debt">Ghi nợ (Công nợ)</option>
                      </select>
                    </div>

                    <div className="field" style={{ marginBottom: 12, background: '#f8fafc', padding: 12, borderRadius: 12 }}>
                      <label style={{ fontSize: 12 }}>Khách thanh toán trước</label>
                      <input type="number" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} style={{ fontWeight: 900, color: '#16a34a' }} placeholder="0" />
                      {total - paidAmount > 0 ? (
                        <div style={{ textAlign: 'right', fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                          Còn nợ: {formatVnd(total - paidAmount)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="card order-section">
                    <div className="order-section-head">
                      <div className="order-section-title">
                        <Save size={18} />
                        Hành động
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button className="btn btn-primary" onClick={() => void createOrder()} style={{ height: 48, fontSize: 16, justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                        <Save size={20} /> Tạo đơn (F4)
                      </button>
                      <button className="btn" onClick={() => void createOrder({ statusOverride: 'draft' })}>
                        <Save size={18} /> Lưu nháp
                      </button>
                      <button className="btn" onClick={() => void createOrder({ statusOverride: 'confirmed' })}>
                        <CheckCircle size={18} /> Xác nhận
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          void (async () => {
                            const o = await createOrder()
                            if (!o) return
                            window.open(`#/orders/${o.id}/print`, '_blank')
                          })()
                        }}
                      >
                        <Printer size={18} /> In phiếu
                      </button>
                      <button className="btn" onClick={resetForm}>
                        <AlertCircle size={18} /> Hủy / Đơn mới
                      </button>
                    </div>
                  </div>
                </div>
            </div>
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

        <FilterBar
          left={
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }}>
              Hiển thị {filteredOrders.length}/{orders.length} đơn
            </div>
          }
          right={
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <SavedViewsBar views={list.views} onApply={list.applyView} onSave={list.saveCurrentAs} onDelete={list.deleteView} />
              <button className="btn btn-small" onClick={list.reset}>
                Reset
              </button>
            </div>
          }
        />
      </div>

      {isLikelyLoading ? (
        <LoadingState title="Đang tải dữ liệu đơn hàng..." rows={7} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState title="Chưa có đơn hàng" hint="Tạo đơn mới hoặc nới bộ lọc để xem dữ liệu." />
      ) : viewMode === 'kanban' ? (
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

      {showAddCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddCustomer(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
                <h3>Thêm khách hàng mới</h3>
                <div className="grid-form">
                    <div className="field">
                        <label>Tên khách hàng (*)</label>
                        <input 
                            value={newCustomerName} 
                            onChange={e => setNewCustomerName(e.target.value)} 
                            autoFocus 
                            placeholder="Tên khách hàng"
                        />
                    </div>
                    <div className="field">
                        <label>Số điện thoại (*)</label>
                        <input 
                            value={newCustomerPhone} 
                            onChange={e => setNewCustomerPhone(e.target.value)} 
                            placeholder="Số điện thoại"
                        />
                    </div>
                    <div className="field">
                        <label>Địa chỉ (Để gợi ý kho)</label>
                        <input 
                            value={newCustomerAddress} 
                            onChange={e => setNewCustomerAddress(e.target.value)} 
                            placeholder="Nhập địa chỉ chi tiết..." 
                        />
                    </div>
                </div>
                <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn" onClick={() => setShowAddCustomer(false)}>Hủy</button>
                    <button className="btn btn-primary" onClick={quickAddCustomer}>Lưu & Chọn</button>
                </div>
            </div>
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
                    <div className="card-title">Tiến độ đơn hàng</div>
                    <OrderTimeline status={selectedOrder.status} />
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

export type Id = string

export type Category = {
  id: Id
  name: string
  createdAt: string
}

export type Supplier = {
  id: Id
  code: string
  name: string
  phone: string
  email: string
  address: string
  note: string
  country?: string
  segment?: string
  createdAt: string
}

export type Location = {
  id: Id
  code: string
  name: string
  province?: string
  note: string
  active: boolean
  createdAt: string
}

export type Product = {
  id: Id
  internalCode: string
  manualInternalCode?: string
  barcode?: string
  manufacturerBatchCode?: string
  specs?: string
  internalBatchCode?: string
  name: string
  categoryId: Id | null
  supplierId: Id | null
  isMaterial: boolean
  active: boolean
  isHidden?: boolean
  createdAt: string
}

export type SkuKind = 'single' | 'bundle'

export type SkuComponent = {
  skuId: Id
  qty: number
}

export type Sku = {
  id: Id
  productId: Id
  skuCode: string
  color: string
  size: string
  material?: string
  volume?: string
  capacity?: string
  power?: string
  unit: string
  cost: number
  price: number
  active: boolean
  kind: SkuKind
  components: SkuComponent[]
  createdAt: string
}

export type Customer = {
  id: Id
  name: string
  phone: string
  email: string
  address: string
  note: string
  discountPercent: number
  createdAt: string
}

export type OrderSource = 'pos' | 'cod' | 'web' | 'social' | 'shopee' | 'tiktok' | 'other'

export type OrderType = 'internal' | 'dropship'

export type OrderPaymentMethod = 'cod' | 'transfer'

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'paid'
  | 'picking'
  | 'packed'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export type ReconcileStatus = 'unreconciled' | 'reconciled' | 'disputed'

export type OrderAttachmentType = 'vat' | 'carrier' | 'warehouse' | 'delivery' | 'signature' | 'payment_bill' | 'other_cost' | 'other'

export type OrderAttachment = {
  id: Id
  type: OrderAttachmentType
  name: string
  dataUrl: string
  createdAt: string
}

export type OrderItem = {
  skuId: Id
  qty: number
  price: number
}

export type Order = {
  id: Id
  code: string
  customerId: Id | null
  fulfillmentLocationId: Id | null
  type: OrderType
  source: OrderSource
  paymentMethod: OrderPaymentMethod
  status: OrderStatus
  items: OrderItem[]
  subTotalOverride: number | null
  shippingFee: number
  carrierName: string
  trackingCode: string
  platformOrderId?: string
  dropshipBrand?: string
  partnerVoucherCode?: string
  discountPercent: number
  discountAmount: number
  vatAmount: number
  otherFees: number
  otherFeesNote?: string
  note: string
  isReconciledCarrier: ReconcileStatus
  isReconciledSupplier: ReconcileStatus
  reconciliationResultAmount?: number
  attachments: OrderAttachment[]
  createdAt: string
  createdByUserId?: Id | null
  cancelledByUserId?: Id | null
  confirmedByUserId?: Id | null
  packedByUserId?: Id | null
  shippedByUserId?: Id | null
}

export type StockTxType = 'in' | 'out' | 'adjust'

export type StockTransactionAttachment = {
  id: Id
  name: string
  dataUrl: string
  createdAt: string
}

export type StockTransaction = {
  id: Id
  code: string
  type: StockTxType
  skuId: Id
  locationId: Id | null
  qty: number
  unitCost: number | null
  note: string
  createdAt: string
  refType: 'manual' | 'order' | 'stock_count' | 'voucher'
  refId: Id | null
  entryDate?: string
  attachments?: StockTransactionAttachment[]
}

export type StockVoucherType = 'in' | 'out' | 'transfer'
export type StockVoucherStatus = 'draft' | 'final' | 'cancelled'

export type StockVoucherLine = {
  skuId: Id
  qty: number
  unitCost: number | null
  note: string
}

export type StockVoucher = {
  id: Id
  code: string
  type: StockVoucherType
  status: StockVoucherStatus
  fromLocationId: Id | null
  toLocationId: Id | null
  note: string
  invoiceNumber?: string
  vat?: string
  createdAt: string
  createdByUserId: Id | null
  finalizedAt: string | null
  lines: StockVoucherLine[]
}

export type FinanceTxType = 'income' | 'expense'

export type FinanceTransaction = {
  id: Id
  code: string
  type: FinanceTxType
  amount: number
  category: string
  note: string
  createdAt: string
  locationId?: Id
  refType: 'manual' | 'order' | 'stock_count' | 'debt'
  refId: Id | null
  attachments: FinanceAttachment[]
}

export type FinanceAttachmentType = 'vat' | 'voucher' | 'contract' | 'other'

export type FinanceAttachment = {
  id: Id
  type: FinanceAttachmentType
  name: string
  dataUrl: string
  createdAt: string
}

export type DebtType = 'receivable' | 'payable'

export type DebtStatus = 'open' | 'settled'

export type Debt = {
  id: Id
  code: string
  type: DebtType
  partnerName: string
  amount: number
  status: DebtStatus
  dueDate: string | null
  note: string
  createdAt: string
  settledAt: string | null
}

export type StockCountStatus = 'draft' | 'final'

export type StockCountAttachmentType = 'report' | 'signature' | 'other'

export type StockCountAttachment = {
  id: Id
  type: StockCountAttachmentType
  name: string
  dataUrl: string
  createdAt: string
}

export type StockCountLine = {
  skuId: Id
  countedQty: number
}

export type StockCountPendingItem = {
  internalCode: string
  batchCode: string
  qty: number
  note: string
}

export type StockCount = {
  id: Id
  code: string
  locationId: Id
  status: StockCountStatus
  note: string
  createdAt: string
  createdByUserId: Id | null
  responsibleUserId: Id | null
  compensationAmount: number
  lines: StockCountLine[]
  pendingItems: StockCountPendingItem[]
  attachments: StockCountAttachment[]
}

export type AuditEntityType =
  | 'order'
  | 'stock_tx'
  | 'stock_voucher'
  | 'stock_count'
  | 'finance_tx'
  | 'debt'
  | 'product'
  | 'sku'
  | 'customer'
  | 'supplier'
  | 'category'
  | 'location'
  | 'user'

export type AuditActionType = 'create' | 'update' | 'delete'

export type AuditLog = {
  id: Id
  actorUserId: Id | null
  action: AuditActionType
  entityType: AuditEntityType
  entityId: Id
  entityCode?: string
  before?: unknown
  after?: unknown
  reason?: string
  createdAt: string
}

export type Role = 'admin' | 'staff' | 'manager' | 'accountant' | 'region_manager'

export type User = {
  id: Id
  username: string
  password?: string
  fullName: string
  role: Role
  active: boolean
  allowedLocationIds: Id[]
  scope?: 'all' | 'region' | 'location'
  region?: string
  createdAt: string
}

export type StockLedgerAccount = 'inventory_asset' | 'cogs' | 'ap_clearing' | 'adjustment_expense' | 'transit_inventory'

export type StockLedgerEntry = {
  id: Id
  transactionId: Id
  date: string
  locationId: Id
  skuId: Id
  account: StockLedgerAccount
  debit: number
  credit: number
  balance: number
  note: string
}

export type Permission =
  | 'dashboard:read'
  | 'products:read'
  | 'products:write'
  | 'orders:read'
  | 'orders:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'finance:read'
  | 'finance:write'
  | 'customers:read'
  | 'customers:write'
  | 'staff:read'
  | 'staff:write'

export type InventoryRequestStatus = 'pending_manager' | 'pending_accountant' | 'approved' | 'rejected' | 'cancelled'
export type InventoryRequestType = 'in' | 'out' | 'transfer' | 'adjust'

export type InventoryRequestItem = {
    skuId: Id
    qty: number
    unitCost?: number
    note?: string
}

export type InventoryRequestLog = {
    id: Id
    action: 'create' | 'approve_manager' | 'approve_accountant' | 'reject' | 'cancel'
    actorId: Id
    timestamp: string
    note?: string
}

export type InventoryRequest = {
    id: Id
    code: string
    type: InventoryRequestType
    status: InventoryRequestStatus
    warehouseId: Id
    targetWarehouseId?: Id
    items: InventoryRequestItem[]
    note?: string
    attachments?: string[]
    logs: InventoryRequestLog[]
    createdBy: Id
    createdAt: string
    updatedAt: string
}

export type TransferOrderStatus = 
  | 'draft' 
  | 'requested' 
  | 'approved' 
  | 'in_transit' 
  | 'partially_received' 
  | 'completed' 
  | 'closed'
  | 'rejected'

export type TransferOrderLine = {
    skuId: Id
    requestedQty: number
    shippedQty: number
    receivedQty: number
    lostQty: number
    unitCost: number
    note?: string
}

export type TransferOrderLog = {
    id: Id
    action: string
    actorId: Id
    timestamp: string
    note?: string
}

export type TransferOrder = {
    id: Id
    code: string
    status: TransferOrderStatus
    fromLocationId: Id
    toLocationId: Id
    lines: TransferOrderLine[]
    
    shippingFee: number
    carrierName?: string
    trackingCode?: string
    estimatedArrival?: string
    
    note?: string
    logs: TransferOrderLog[]
    
    createdByUserId: Id
    createdAt: string
    updatedAt: string
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type Notification = {
    id: Id
    userId: Id
    title: string
    message: string
    type: NotificationType
    link?: string
    read: boolean
    createdAt: string
}

export type SkuSettings = {
    skuId: Id
    locationId: Id
    minStock: number
    maxStock: number
    safetyStock: number
    leadTimeDays: number
}

export type ChannelType = 'shopee' | 'lazada' | 'tiktok' | 'web'

export type ChannelConfig = {
    id: Id
    type: ChannelType
    name: string
    apiKey?: string
    apiSecret?: string
    shopId?: string
    warehouseId?: Id // Default warehouse for this channel
    active: boolean
    createdAt: string
}

export type SkuMapping = {
    id: Id
    channelId: Id
    channelSku: string
    systemSkuId: Id
    createdAt: string
}

export type WarehouseRegionMapping = {
    id: Id
    locationId: Id
    provinces: string[] // List of province names or codes
    priority: number // 1 = High, 10 = Low
    createdAt: string
}

export type AllocationRule = {
    id: Id
    name: string
    active: boolean
    priority: number // 1 = highest
    type: 'region_match' | 'central_warehouse' | 'stock_level' | 'store_online_restriction'
    config: {
        centralWarehouseId?: Id
        allowBranchOnlineSales?: boolean
    }
}

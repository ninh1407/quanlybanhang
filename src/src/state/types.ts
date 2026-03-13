import type {
  AuditLog,
  Category,
  Customer,
  Debt,
  FinanceTransaction,
  Location,
  Order,
  Product,
  Sku,
  StockCount,
  StockVoucher,
  Supplier,
  StockTransaction,
  User,
  InventoryRequest,
  Notification,
  StockLedgerEntry,
  TransferOrder,
  SkuSettings,
  ChannelConfig,
  SkuMapping,
  WarehouseRegionMapping,
  AllocationRule,
  PurchaseOrder,
  AppDocument,
} from '../domain/types'

export type AppState = {
  categories: Category[]
  suppliers: Supplier[]
  locations: Location[]
  products: Product[]
  skus: Sku[]
  customers: Customer[]
  orders: Order[]
  purchaseOrders: PurchaseOrder[]
  stockTransactions: StockTransaction[]
  stockVouchers: StockVoucher[]
  stockCounts: StockCount[]
  stockLedger: StockLedgerEntry[]
  financeTransactions: FinanceTransaction[]
  debts: Debt[]
  documents: AppDocument[]
  users: User[]
  requests: InventoryRequest[]
  transferOrders: TransferOrder[]
  notifications: Notification[]
  skuSettings: SkuSettings[]
  channelConfigs: ChannelConfig[]
  skuMappings: SkuMapping[]
  warehouseRegionMappings: WarehouseRegionMapping[]
  allocationRules: AllocationRule[]
  currentUserId: string | null
  currentLocationId: string | null
  auditLogs: AuditLog[]
  sequences: Record<string, number>
}

export type WarehouseState = Omit<AppState, 'users' | 'locations' | 'currentUserId' | 'currentLocationId' | 'channelConfigs' | 'skuMappings' | 'warehouseRegionMappings'>

export type AppAction =
  | { type: 'auth/login'; userId: string }
  | { type: 'auth/logout' }
  | { type: 'session/switchLocation'; locationId: string | null; warehouse: WarehouseState }
  | { type: 'audit/add'; log: AuditLog }
  | { type: 'categories/upsert'; category: Category }
  | { type: 'categories/delete'; id: string }
  | { type: 'suppliers/upsert'; supplier: Supplier }
  | { type: 'suppliers/delete'; id: string }
  | { type: 'locations/upsert'; location: Location }
  | { type: 'locations/delete'; id: string }
  | { type: 'products/upsert'; product: Product }
  | { type: 'products/delete'; id: string }
  | { type: 'skus/upsert'; sku: Sku }
  | { type: 'skus/delete'; id: string }
  | { type: 'customers/upsert'; customer: Customer }
  | { type: 'customers/delete'; id: string }
  | { type: 'orders/upsert'; order: Order }
  | { type: 'orders/delete'; id: string }
  | { type: 'purchaseOrders/upsert'; order: PurchaseOrder }
  | { type: 'purchaseOrders/delete'; id: string }
  | { type: 'stock/add'; tx: StockTransaction }
  | { type: 'stockVouchers/upsert'; voucher: StockVoucher }
  | { type: 'stockVouchers/delete'; id: string }
  | { type: 'stockVouchers/finalize'; id: string }
  | { type: 'stockCounts/upsert'; stockCount: StockCount }
  | { type: 'stockCounts/delete'; id: string }
  | { type: 'finance/add'; tx: FinanceTransaction }
  | { type: 'debts/upsert'; debt: Debt }
  | { type: 'debts/delete'; id: string }
  | { type: 'users/upsert'; user: User }
  | { type: 'users/delete'; id: string }
  | { type: 'requests/upsert'; request: InventoryRequest }
  | { type: 'transferOrders/upsert'; order: TransferOrder }
  | { type: 'transferOrders/delete'; id: string }
  | { type: 'notifications/add'; notification: Notification }
  | { type: 'notifications/markRead'; id: string }
  | { type: 'notifications/markAllRead' }
  | { type: 'skuSettings/upsert'; setting: SkuSettings }
  | { type: 'channelConfigs/upsert'; config: ChannelConfig }
  | { type: 'channelConfigs/delete'; id: string }
  | { type: 'skuMappings/upsert'; mapping: SkuMapping }
  | { type: 'skuMappings/delete'; id: string }
  | { type: 'warehouseRegionMappings/upsert'; mapping: WarehouseRegionMapping }
  | { type: 'warehouseRegionMappings/delete'; id: string }
  | { type: 'allocationRules/upsert'; rule: AllocationRule }
  | { type: 'allocationRules/delete'; id: string }
  | { type: 'documents/upsert'; document: AppDocument }
  | { type: 'documents/delete'; id: string }
  | { type: 'sync'; state: AppState }

export type AppActionWithMeta = AppAction & {
  meta?: {
    reason?: string
  }
}

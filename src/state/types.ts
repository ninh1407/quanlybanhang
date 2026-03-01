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
} from '../domain/types'

export type AppState = {
  categories: Category[]
  suppliers: Supplier[]
  locations: Location[]
  products: Product[]
  skus: Sku[]
  customers: Customer[]
  orders: Order[]
  stockTransactions: StockTransaction[]
  stockVouchers: StockVoucher[]
  stockCounts: StockCount[]
  financeTransactions: FinanceTransaction[]
  debts: Debt[]
  users: User[]
  currentUserId: string | null
  currentLocationId: string | null
  auditLogs: AuditLog[]
  sequences: Record<string, number>
}

export type WarehouseState = Omit<AppState, 'users' | 'locations' | 'currentUserId' | 'currentLocationId'>

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
  | { type: 'sync'; state: AppState }

export type AppActionWithMeta = AppAction & {
  meta?: {
    reason?: string
  }
}

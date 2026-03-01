import type { AppState, WarehouseState } from './types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'

export const STORAGE_KEY = 'sales_admin_v2'
export const DIRECTORY_STORAGE_KEY = 'sales_admin_directory_v1'

export function warehouseStorageKey(locationId: string): string {
  return `sales_admin_data_v1:${locationId}`
}

export function createEmptyWarehouseState(): WarehouseState {
  return {
    categories: [],
    suppliers: [],
    products: [],
    skus: [],
    customers: [],
    orders: [],
    stockTransactions: [],
    stockVouchers: [],
    stockCounts: [],
    financeTransactions: [],
    debts: [],
    auditLogs: [],
    sequences: {},
  }
}

export function createSeedState(): AppState {
  const createdAt = nowIso()

  const locMain = {
    id: newId('loc'),
    code: 'MAIN',
    name: 'Kho chính',
    note: '',
    active: true,
    createdAt,
  }

  const admin = {
    id: newId('usr'),
    username: 'admin',
    password: '$2b$10$dsrzZxDopDBXAybC24E96et0Fii1U2/3/VEhoLoYF5FLt7mLqiqtm', // '123'
    fullName: 'Quản trị',
    role: 'admin' as const,
    active: true,
    allowedLocationIds: [],
    createdAt,
  }

  return {
    categories: [],
    suppliers: [],
    locations: [locMain],
    products: [],
    skus: [],
    customers: [],
    orders: [],
    stockTransactions: [],
    stockVouchers: [],
    stockCounts: [],
    financeTransactions: [],
    debts: [],
    users: [admin],
    currentUserId: null,
    currentLocationId: locMain.id,
    auditLogs: [],
    sequences: {},
  }
}

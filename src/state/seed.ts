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
    stockLedger: [],
    financeTransactions: [],
    debts: [],
    requests: [],
    transferOrders: [],
    notifications: [],
    skuSettings: [],
    auditLogs: [],
    sequences: {},
    allocationRules: [],
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
    stockLedger: [],
    financeTransactions: [],
    debts: [],
    users: [
      {
        id: 'usr_admin',
        username: 'admin',
        password: '$2a$10$wT8vFkG.z6y9qJ1kL4t3.e6.g5h4i3j2k1l0m9n8o7p6q5r4s3t2u1', // Placeholder hash, server will reset if needed
        fullName: 'Quản trị (Admin)',
        role: 'admin',
        locationId: null, // Admin has access to all
        active: true,
        createdAt: nowIso(),
      },
      {
        id: 'usr_staff1',
        username: 'staff1',
        password: '$2a$10$wT8vFkG.z6y9qJ1kL4t3.e6.g5h4i3j2k1l0m9n8o7p6q5r4s3t2u1',
        fullName: 'Nhân viên 1',
        role: 'staff',
        locationId: 'loc_hcm',
        active: true,
        createdAt: nowIso(),
      },
    ],
    requests: [],
    transferOrders: [],
    notifications: [],
    skuSettings: [],
    channelConfigs: [],
    skuMappings: [],
    warehouseRegionMappings: [],
    allocationRules: [],
    currentUserId: null,
    currentLocationId: locMain.id,
    auditLogs: [],
    sequences: {},
  }
}

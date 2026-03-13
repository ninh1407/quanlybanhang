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
    purchaseOrders: [],
    stockTransactions: [],
    stockVouchers: [],
    stockCounts: [],
    stockLedger: [],
    financeTransactions: [],
    debts: [],
    documents: [],
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
    name: 'Kho chính (HCM)',
    province: 'Hồ Chí Minh',
    lat: 10.8231,
    lng: 106.6297,
    note: 'Kho tổng miền Nam',
    active: true,
    createdAt,
  }

  const locHanoi = {
    id: newId('loc'),
    code: 'HN01',
    name: 'Kho Hà Nội',
    province: 'Hà Nội',
    lat: 21.0285,
    lng: 105.8542,
    note: 'Chi nhánh miền Bắc',
    active: true,
    createdAt,
  }

  return {
    categories: [],
    suppliers: [],
    locations: [locMain, locHanoi],
    products: [],
    skus: [],
    customers: [],
    orders: [],
    purchaseOrders: [],
    stockTransactions: [],
    stockVouchers: [],
    stockCounts: [],
    stockLedger: [],
    financeTransactions: [],
    debts: [],
    documents: [],
    users: [
      {
        id: 'usr_admin',
        username: 'admin',
        password: '$2b$10$FPhWUF0PVOHr6DGCpV0kmu2VFryCDMawM5in5mdDTU.BJFwHpSRcO', // Hash of '123'
        fullName: 'Quản trị (Admin)',
        role: 'admin',
        active: true,
        allowedLocationIds: [], // Admin has access to all
        scope: 'all',
        createdAt: nowIso(),
      },
      {
        id: 'usr_staff1',
        username: 'staff1',
        password: '$2b$10$FPhWUF0PVOHr6DGCpV0kmu2VFryCDMawM5in5mdDTU.BJFwHpSRcO', // Hash of '123'
        fullName: 'Nhân viên 1',
        role: 'staff',
        active: true,
        allowedLocationIds: ['loc_hcm'],
        scope: 'location',
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

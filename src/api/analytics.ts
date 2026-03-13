import { fetchApi } from './client'

export interface BusinessKPIs {
  revenue: number
  netProfit: number
  inventoryValue: number
  stockTurnover: number
  cashFlow: number
  fulfillmentRate: number
}

export interface InventoryKPIs {
  daysOnHand: number
  deadStockSkuCount: number
  fastMovingSkuCount: number
  slowMovingSkuCount: number
}

export interface RevenueHistory {
  name: string
  revenue: number
  profit: number
}

export interface TopProduct {
  name: string
  value: number
}

export interface ChannelPerformance {
  name: string
  value: number
  percent: number
}

export const AnalyticsApi = {
  getBusinessKPIs: (from?: Date, to?: Date) => {
    const params = new URLSearchParams()
    if (from) params.append('from', from.toISOString())
    if (to) params.append('to', to.toISOString())
    return fetchApi<BusinessKPIs>(`/api/analytics/business?${params.toString()}`)
  },

  getRevenueHistory: () => {
    return fetchApi<RevenueHistory[]>('/api/analytics/history')
  },

  getTopProducts: (limit: number = 5) => {
    return fetchApi<TopProduct[]>(`/api/analytics/top-products?limit=${limit}`)
  },

  getInventoryKPIs: () => {
    return fetchApi<InventoryKPIs>('/api/analytics/inventory')
  },

  getChannelPerformance: (from?: Date, to?: Date) => {
    const params = new URLSearchParams()
    if (from) params.append('from', from.toISOString())
    if (to) params.append('to', to.toISOString())
    return fetchApi<ChannelPerformance[]>(`/api/analytics/channels?${params.toString()}`)
  }
}

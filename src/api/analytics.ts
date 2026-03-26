import { fetchApi } from './client'

export type BusinessKPIs = {
  revenue: number
  costOfGoodsSold: number
  expenses: number
  netProfit: number
  cashFlow: number
  inventoryValue: number
  stockTurnover?: number
  fulfillmentRate?: number
}

export type RevenueHistory = {
  date: string
  revenue: number
  profit: number
}

export type TopProduct = {
  skuId: string
  skuCode: string
  name: string
  qty: number
  value: number
}

export type InventoryKPIs = {
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  fastMovingSkuCount: number
  slowMovingSkuCount: number
  deadStockSkuCount: number
  daysOnHand?: number
}

export type ChannelPerformance = {
  name: string
  orderCount: number
  revenue: number
  percent: number
}

export const AnalyticsApi = {
  async getBusinessKPIs(from?: Date, to?: Date): Promise<BusinessKPIs> {
    const params = new URLSearchParams()
    if (from) params.set('from', from.toISOString())
    if (to) params.set('to', to.toISOString())
    return fetchApi<BusinessKPIs>(`/api/analytics/business?${params.toString()}`)
  },

  async getRevenueHistory(): Promise<RevenueHistory[]> {
    return fetchApi<RevenueHistory[]>('/api/analytics/history')
  },

  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    return fetchApi<TopProduct[]>(`/api/analytics/top-products?limit=${limit}`)
  },

  async getInventoryKPIs(): Promise<InventoryKPIs> {
    return fetchApi<InventoryKPIs>('/api/analytics/inventory')
  },

  async getChannelPerformance(from?: Date, to?: Date): Promise<ChannelPerformance[]> {
    const params = new URLSearchParams()
    if (from) params.set('from', from.toISOString())
    if (to) params.set('to', to.toISOString())
    return fetchApi<ChannelPerformance[]>(`/api/analytics/channels?${params.toString()}`)
  }
}

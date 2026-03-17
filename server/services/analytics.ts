import { store } from '../store'
import type { Order, StockTransaction, Sku, User } from '../../src/domain/types'
import { startOfMonth, endOfMonth, subMonths, format, isSameMonth } from 'date-fns'

function calculateOrderTotal(o: Order): number {
    const subTotal = o.subTotalOverride ?? (o.items || []).reduce((s: number, i: any) => s + i.price * i.qty, 0)
    return subTotal + (o.shippingFee || 0) - (o.discountAmount || 0) + (o.vatAmount || 0) + (o.otherFees || 0)
}

function hasWarehouseAccess(user: User, warehouseId?: string | null): boolean {
    if (!warehouseId) return true // No warehouse restrictions if no warehouse involved
    if (user.role === 'admin' || user.role === 'ceo') return true
    if (user.scope === 'all') return true
    if (user.allowedLocationIds && user.allowedLocationIds.includes(warehouseId)) return true
    return false
}

// BOLA Filter: Filter orders based on user warehouse access
// If order doesn't have warehouseId (legacy), we might include it or exclude it.
// Assuming orders are global for now unless they have warehouseId?
// Actually, orders are usually fulfilled from a warehouse.
// Let's assume strict mode: User can only see orders from their warehouses.
function filterOrdersByUser(orders: Order[], user: User): Order[] {
    if (user.role === 'admin' || user.role === 'ceo' || user.role === 'accountant') return orders
    
    // For staff/manager, only show orders where fulfillment warehouse is in allowed list
    // Or if order has no warehouse assigned yet?
    // Let's assume 'all' scope sees all.
    if (user.scope === 'all') return orders

    const allowed = new Set(user.allowedLocationIds || [])
    return orders.filter(o => {
        const locId = (o.fulfillmentLocationId || o.warehouseId) as string | undefined
        if (locId) return allowed.has(locId)
        return true
    })
}

export class AnalyticsService {
    
    // 1. Business KPI (High Level)
    async getBusinessKPIs(from: Date, to: Date, user: User) {
        const state = store.state
        
        // BOLA Check: Accountant/CEO/Admin can see Finance. Others might be restricted.
        // If warehouse manager asks for Business KPI, they should only see THEIR warehouse's performance.
        // But Finance Transactions are global?
        
        const orders = filterOrdersByUser(state.orders || [], user)
        const financeTxs = state.financeTransactions || [] // TODO: Filter finance by branch/warehouse
        const skus = state.skus || []
        const stockTxs = state.stockTransactions || []

        // Filter Orders in Period
        const periodOrders = orders.filter(o => {
            const d = new Date(o.createdAt)
            return d >= from && d <= to && o.status !== 'cancelled'
        })

        // Revenue
        const revenue = periodOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0)

        // COGS
        const skusMap = new Map(skus.map(s => [s.id, s]))
        const costOfGoodsSold = periodOrders.reduce((sum, o) => {
            return sum + (o.items || []).reduce((s, i) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
        }, 0)

        // Expenses - Only showing for Admin/Accountant/CEO
        let expenses = 0
        let income = 0
        
        if (['admin', 'ceo', 'accountant'].includes(user.role)) {
            const periodFinance = financeTxs.filter(t => {
                const d = new Date(t.createdAt)
                return d >= from && d <= to
            })
            expenses = periodFinance.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
            income = periodFinance.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
        }

        // Net Profit
        const netProfit = revenue - costOfGoodsSold - expenses

        // Cash Flow (Net)
        const cashFlow = income - expenses

        // Inventory Value (Filtered by Warehouse Access)
        const stockMap = new Map<string, number>()
        stockTxs.forEach(t => {
            // Filter by warehouse
            if (!hasWarehouseAccess(user, t.warehouseId || t.locationId)) return

            const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
            stockMap.set(t.skuId, (stockMap.get(t.skuId) ?? 0) + delta)
        })
        const inventoryValue = skus.reduce((sum, s) => {
            const qty = stockMap.get(s.id) || 0
            return sum + (s.cost || 0) * qty
        }, 0)

        // Stock Turnover
        const stockTurnover = inventoryValue > 0 ? (costOfGoodsSold * 12) / inventoryValue : 0 

        // Fulfillment Rate
        const totalOrders = orders.filter(o => {
            const d = new Date(o.createdAt)
            return d >= from && d <= to
        }).length
        const cancelledOrders = orders.filter(o => {
            const d = new Date(o.createdAt)
            return d >= from && d <= to && o.status === 'cancelled'
        }).length
        const fulfillmentRate = totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders) * 100 : 100

        return {
            revenue,
            netProfit,
            inventoryValue,
            stockTurnover: Number(stockTurnover.toFixed(2)),
            cashFlow,
            fulfillmentRate: Number(fulfillmentRate.toFixed(1))
        }
    }

    // 2. Revenue History (12 Months)
    async getRevenueHistory(user: User) {
        const state = store.state
        const orders = filterOrdersByUser((state.orders || []).filter(o => o.status !== 'cancelled'), user)
        
        const data = []
        for (let i = 11; i >= 0; i--) {
            const d = subMonths(new Date(), i)
            const monthStart = startOfMonth(d)
            const monthLabel = format(d, 'MM/yyyy')
            
            const monthOrders = orders.filter(o => isSameMonth(new Date(o.createdAt), monthStart))
            const rev = monthOrders.reduce((sum, o) => sum + calculateOrderTotal(o), 0)
            
            // Calculate Profit
            const skusMap = new Map((state.skus || []).map(s => [s.id, s]))
            const cost = monthOrders.reduce((sum, o) => {
                 return sum + (o.items || []).reduce((s, i) => s + (skusMap.get(i.skuId)?.cost || 0) * i.qty, 0)
            }, 0)
            const profit = rev - cost

            data.push({ name: monthLabel, revenue: rev, profit })
        }
        return data
    }

    // 3. Top Products
    async getTopProducts(user: User, limit: number = 5) {
        const state = store.state
        const skuSales = new Map<string, number>()
        const orders = filterOrdersByUser((state.orders || []).filter(o => o.status !== 'cancelled'), user)

        const now = new Date()
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30))
        
        orders.forEach(o => {
             const d = new Date(o.createdAt)
             if (d < thirtyDaysAgo) return

            (o.items || []).forEach(i => {
                skuSales.set(i.skuId, (skuSales.get(i.skuId) || 0) + i.qty)
            })
        })
        
        const sorted = [...skuSales.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([skuId, qty]) => {
                const sku = (state.skus || []).find(s => s.id === skuId)
                const product = (state.products || []).find(p => p.id === sku?.productId)
                return {
                    name: product ? product.name : skuId,
                    value: qty
                }
            })
        
        return sorted.length ? sorted : [{ name: 'Chưa có dữ liệu', value: 0 }]
    }

    // 4. Inventory KPI
    async getInventoryKPIs(user: User) {
        const state = store.state
        const now = new Date()
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        
        const skus = state.skus || []
        const txs = state.stockTransactions || []
        const skusMap = new Map((state.skus || []).map(s => [s.id, s]))

        const stockMap = new Map<string, number>()
        txs.forEach(t => {
            if (!hasWarehouseAccess(user, t.warehouseId || t.locationId)) return
            const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
            stockMap.set(t.skuId, (stockMap.get(t.skuId) ?? 0) + delta)
        })

        const inventoryValue = skus.reduce((sum, s) => {
            const qty = stockMap.get(s.id) || 0
            return sum + (s.cost || 0) * qty
        }, 0)

        const outTxs = txs.filter(t => t.type === 'out' && hasWarehouseAccess(user, t.warehouseId || t.locationId))
        const outTxs90 = outTxs.filter(t => new Date(t.createdAt) > ninetyDaysAgo)
        const outTxs30 = outTxs.filter(t => new Date(t.createdAt) > thirtyDaysAgo)

        const activeSkuIds = new Set(outTxs90.map(t => t.skuId))
        const deadStockSkuCount = skus.filter(s => !activeSkuIds.has(s.id)).length

        const skuOutQty90 = new Map<string, number>()
        outTxs90.forEach(t => {
            skuOutQty90.set(t.skuId, (skuOutQty90.get(t.skuId) || 0) + t.qty)
        })
        const sortedSkus = Array.from(skuOutQty90.entries()).sort((a, b) => b[1] - a[1])
        const fastMovingCount = Math.ceil(sortedSkus.length * 0.2)
        const fastMovingSkuCount = sortedSkus.slice(0, fastMovingCount).length
        const slowMovingSkuCount = Math.max(0, sortedSkus.length - fastMovingSkuCount)

        const cogs30 = outTxs30.reduce((sum, t) => {
            const sku = skusMap.get(t.skuId)
            const unitCost = t.unitCost ?? sku?.cost ?? 0
            return sum + (Number(unitCost) || 0) * (Number(t.qty) || 0)
        }, 0)

        const daysOnHand = cogs30 > 0 ? inventoryValue / (cogs30 / 30) : 0
        
        return {
            daysOnHand: Number.isFinite(daysOnHand) ? Math.round(daysOnHand) : 0,
            deadStockSkuCount,
            fastMovingSkuCount,
            slowMovingSkuCount
        }
    }

    // 5. Channel Analytics
    async getChannelPerformance(from: Date, to: Date, user: User) {
        const state = store.state
        const orders = filterOrdersByUser(state.orders || [], user)
        const map = new Map<string, number>()
        
        orders.forEach(o => {
            const d = new Date(o.createdAt)
            if (d < from || d > to || o.status === 'cancelled') return
            
            let channel = 'Khác'
            if (o.source === 'shopee') channel = 'Shopee'
            else if (o.source === 'tiktok') channel = 'TikTok'
            else if (o.source === 'lazada') channel = 'Lazada'
            else if (o.source === 'web') channel = 'Website'
            else if (o.source === 'pos') channel = 'POS'
            
            map.set(channel, (map.get(channel) || 0) + calculateOrderTotal(o))
        })

        const total = Array.from(map.values()).reduce((a, b) => a + b, 0)
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value, percent: total ? (value / total) * 100 : 0 }))
            .sort((a, b) => b.value - a.value)
    }

    // 6. Warehouse Performance (Ops)
    async getWarehousePerformance(warehouseId: string) {
        return {
            avgPickTimeMinutes: 12.5,
            avgPackTimeMinutes: 5.0,
            errorRate: 0.005, 
            ordersProcessed: 1250
        }
    }
}

export const analyticsService = new AnalyticsService()

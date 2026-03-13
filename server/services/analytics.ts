import { prisma } from '../store'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'

export class AnalyticsService {
    
    async getDashboardData(user: any) {
        const today = new Date()
        const start = startOfDay(today)
        const end = endOfDay(today)

        // 1. KPI
        const ordersToday = await prisma.order.count({
            where: { createdAt: { gte: start, lte: end } }
        })

        const revenueTodayAgg = await prisma.order.aggregate({
            _sum: { total: true },
            where: { 
                createdAt: { gte: start, lte: end },
                status: { not: 'cancelled' }
            }
        })
        const revenueToday = revenueTodayAgg._sum.total || 0

        // Inventory Value
        // SQL: SELECT SUM(i.quantity * s.cost) FROM inventory i JOIN product_skus s ON i.sku_id = s.id
        const inventoryValueResult: any[] = await prisma.$queryRaw`
            SELECT SUM(i.quantity * s.cost) as value
            FROM inventory i
            JOIN product_skus s ON i.sku_id = s.id
        `
        const inventoryValue = Number(inventoryValueResult[0]?.value || 0)

        // Cashflow (Placeholder)
        const cashflow = revenueToday 

        // 2. Sales Chart (Last 7 days)
        const salesChart = []
        for (let i = 6; i >= 0; i--) {
            const d = subDays(today, i)
            const s = startOfDay(d)
            const e = endOfDay(d)
            const rev = await prisma.order.aggregate({
                _sum: { total: true },
                where: { createdAt: { gte: s, lte: e }, status: { not: 'cancelled' } }
            })
            salesChart.push({
                date: format(d, 'dd/MM'),
                revenue: rev._sum.total || 0
            })
        }

        // 3. Operations
        const pendingOrders = await prisma.order.count({ where: { status: 'pending' } })
        const pickingQueue = await prisma.order.count({ where: { fulfillmentStatus: 'picking' } })
        const packingQueue = await prisma.order.count({ where: { fulfillmentStatus: 'packed' } })
        const shippingQueue = await prisma.order.count({ where: { fulfillmentStatus: 'shipped' } }) // Or ready_to_ship

        // 4. Inventory Health
        const lowStockCount = await prisma.inventory.count({
            where: { quantity: { lt: 10 } }
        })

        return {
            kpi: {
                revenueToday,
                ordersToday,
                inventoryValue,
                cashflow
            },
            sales: {
                chart: salesChart,
                topProducts: [] // TODO
            },
            inventory: {
                lowStock: lowStockCount,
                deadStock: 0, 
                value: inventoryValue,
                health: 98 // Mock
            },
            operations: {
                pending: pendingOrders,
                picking: pickingQueue,
                packing: packingQueue,
                shipping: shippingQueue
            }
        }
    }

    // Keep legacy methods signatures if needed to avoid breaking other imports immediately, 
    // but better to remove if unused.
    // For now, I'll export a stub for getBusinessKPIs if index.ts calls it.
    async getBusinessKPIs(from: Date, to: Date, user: any) {
        return this.getDashboardData(user) // Redirect to new logic
    }
    
    async getRevenueHistory(user: any) { return [] }
    async getTopProducts(user: any, limit: number) { return [] }
    async getInventoryKPIs(user: any) { return {} }
    async getChannelPerformance(from: Date, to: Date, user: any) { return [] }
}

export const analyticsService = new AnalyticsService()

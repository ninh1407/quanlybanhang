import { inventoryService } from './inventory'

export class OrchestrationService {
    
    // OOE: Order Orchestration Engine
    // Determines the best warehouse to fulfill an order
    async routeOrder(orderData: { channelId: string, items: any[], customerAddress: any }): Promise<string> {
        console.log(`[OOE] Routing order from ${orderData.channelId}`)
        
        // 1. Check Custom Rules (e.g. "Shopee orders always go to WH-SHOPEE")
        // const rules = await prisma.allocationRule.findMany(...)
        
        // 2. Check Stock Availability
        // Filter warehouses that have ALL items in stock
        
        // 3. Distance Calculation
        // Calculate distance between Warehouse and Customer Address
        
        // Mock Decision:
        const bestWarehouseId = 'WH-MAIN' 
        console.log(`[OOE] Selected Warehouse: ${bestWarehouseId}`)
        return bestWarehouseId
    }

    // Inventory Reservation (Soft Allocation)
    // Prevents overselling by blocking stock immediately upon order creation
    async reserveStock(orderId: string, warehouseId: string, items: { skuId: string, qty: number }[]) {
        console.log(`[OOE] Reserving stock for Order ${orderId} at ${warehouseId}`)
        
        for (const item of items) {
            // In real app:
            // await prisma.inventoryReservation.create({
            //   data: { orderId, warehouseId, variantId: item.skuId, quantity: item.qty, status: 'active' }
            // })
            
            // Also update "Available Stock" cache if needed
        }
        
        return true
    }
    
    // Release Reservation (on Cancel or Ship)
    async releaseReservation(orderId: string) {
        console.log(`[OOE] Releasing reservation for Order ${orderId}`)
        // await prisma.inventoryReservation.updateMany({ where: { orderId }, data: { status: 'cancelled' } })
    }
}

export const orchestrationService = new OrchestrationService()

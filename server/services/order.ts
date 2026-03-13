import { inventoryService } from './inventory'

export class OrderService {
    async createOrder(orderData: any) {
        console.log(`[OrderService] Processing order ${orderData.code}`)
        
        // 1. Validate Stock
        // 2. Create Order Record
        // 3. Reserve Stock (Inventory Transaction)
        for (const item of orderData.items) {
            await inventoryService.adjustStock(item.skuId, orderData.warehouseId, -item.quantity, 'OUT', `Order ${orderData.code}`)
        }
        
        return { id: 'new-order-id', status: 'confirmed' }
    }
}

export const orderService = new OrderService()

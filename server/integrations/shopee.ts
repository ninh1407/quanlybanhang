import { PlatformClient, OrderData } from './types'

export class ShopeeClient implements PlatformClient {
    name = 'shopee'
    
    constructor(private config: { shopId: string; accessToken: string }) {}

    async getOrders(from: Date, to: Date): Promise<OrderData[]> {
        console.log(`[Shopee] Fetching orders for shop ${this.config.shopId} from ${from.toISOString()} to ${to.toISOString()}`)
        // Mock API call
        return [
            {
                id: 'mock-shopee-1',
                channelId: 'shopee',
                channelOrderId: 'SP' + Date.now(),
                status: 'READY_TO_SHIP',
                total: 150000,
                items: [{ sku: 'SKU001', qty: 1, price: 150000 }],
                createdAt: new Date(),
                customer: { name: 'Nguyen Van A', phone: '0909000111' }
            }
        ]
    }

    async syncInventory(sku: string, qty: number): Promise<boolean> {
        console.log(`[Shopee] Shop ${this.config.shopId}: Updating stock for ${sku} to ${qty}`)
        // Mock API call to https://partner.shopeemobile.com/api/v2/product/update_stock
        return true
    }

    async handleWebhook(payload: any): Promise<{ type: string; data: any } | null> {
        // Mock parsing
        // Shopee webhook usually has 'code' (1 = order update)
        if (payload.code === 3) { // Order Status Update
            return { type: 'ORDER_UPDATE', data: payload.data }
        }
        return null
    }
}

export interface OrderData {
    id: string
    channelId: string
    channelOrderId: string
    status: string
    total: number
    items: { sku: string; qty: number; price: number }[]
    createdAt: Date
    customer: { name: string; phone?: string; address?: string }
}

export interface PlatformClient {
    name: string
    getOrders(from: Date, to: Date): Promise<OrderData[]>
    syncInventory(sku: string, qty: number): Promise<boolean>
    handleWebhook(payload: any): Promise<{ type: string; data: any } | null>
}

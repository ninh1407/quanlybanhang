import { inventoryService } from './inventory'

export class PurchaseService {
    
    async createPO(data: { supplierId: string, warehouseId: string, items: any[] }) {
        console.log(`[Purchase] Creating PO for Supplier ${data.supplierId}`)
        // DB Insert Logic
        return 'PO-' + Date.now()
    }

    async approvePO(poId: string, userId: string) {
        console.log(`[Purchase] PO ${poId} approved by ${userId}`)
        // Update status to 'approved'
    }

    async receiveGoods(poId: string, warehouseId: string, items: { skuId: string, qty: number }[]) {
        console.log(`[Purchase] Receiving goods for PO ${poId}`)
        
        // 1. Update PO Items (receivedQty)
        // 2. Update Inventory (IN)
        for (const item of items) {
            await inventoryService.adjustStock(
                item.skuId,
                warehouseId,
                item.qty,
                'IN',
                `PO-RECEIPT-${poId}`
            )
        }
        
        // 3. If all items received -> Status = 'received'
    }
}

export const purchaseService = new PurchaseService()

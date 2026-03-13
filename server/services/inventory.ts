import { prisma } from '../store'

type Tx = {
  inventory: {
    findUnique: (args: any) => Promise<any>
    upsert: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
  }
  stockMovement: {
    create: (args: any) => Promise<any>
  }
}

export class InventoryService {
  
  /**
   * Reserve stock for an Order
   * Decreases Available, Increases Reserved. Quantity unchanged.
   */
  async reserveStock(orderId: string, items: { skuId: string, quantity: number }[], warehouseId: string, tx: Tx = prisma as any) {
      for (const item of items) {
        // 1. Check availability
        // Use tx instead of internal transaction
        const inventory = await tx.inventory.findUnique({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } }
        })

        const currentQuantity = inventory?.quantity || 0
        const currentReserved = inventory?.reserved || 0
        const available = currentQuantity - currentReserved

        if (available < item.quantity) {
          throw new Error(`Insufficient stock for SKU ${item.skuId} in Warehouse ${warehouseId}. Available: ${available}, Required: ${item.quantity}`)
        }

        // 2. Update Inventory (Reserved += qty)
        await tx.inventory.upsert({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } },
          create: {
            skuId: item.skuId,
            warehouseId,
            quantity: 0,
            reserved: item.quantity
          },
          update: {
            reserved: { increment: item.quantity }
          }
        })

        // 3. Create Stock Movement (RESERVE)
        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId,
            type: 'RESERVE',
            quantity: item.quantity,
            referenceType: 'order',
            referenceId: orderId
          }
        })
      }
  }

  /**
   * Release reserved stock (e.g. Order Cancelled)
   * Increases Available, Decreases Reserved. Quantity unchanged.
   */
  async releaseStock(orderId: string, items: { skuId: string, quantity: number }[], warehouseId: string, tx: Tx = prisma as any) {
      for (const item of items) {
        // 1. Update Inventory (Reserved -= qty)
        await tx.inventory.update({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } },
          data: { reserved: { decrement: item.quantity } }
        })

        // 2. Create Stock Movement (RELEASE)
        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId,
            type: 'RELEASE',
            quantity: item.quantity,
            referenceType: 'order',
            referenceId: orderId
          }
        })
      }
  }

  /**
   * Ship Order (Deduct from Inventory and Reserved)
   * Decreases Quantity, Decreases Reserved. Available unchanged (technically).
   */
  async shipOrder(orderId: string, items: { skuId: string, quantity: number }[], warehouseId: string, tx: Tx = prisma as any) {
      for (const item of items) {
        // 1. Update Inventory (Quantity -= qty, Reserved -= qty)
        await tx.inventory.update({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } },
          data: { 
            quantity: { decrement: item.quantity },
            reserved: { decrement: item.quantity }
          }
        })

        // 2. Create Stock Movement (OUT)
        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId,
            type: 'OUT',
            quantity: item.quantity,
            referenceType: 'order',
            referenceId: orderId
          }
        })
      }
  }

  /**
   * Receive Stock (Purchase)
   * Increases Quantity, Increases Available. Reserved unchanged.
   */
  async receiveStock(poId: string, items: { skuId: string, quantity: number }[], warehouseId: string, tx: Tx = prisma as any) {
      for (const item of items) {
        // 1. Upsert Inventory
        await tx.inventory.upsert({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId } },
          create: {
            skuId: item.skuId,
            warehouseId,
            quantity: item.quantity,
            reserved: 0
          },
          update: {
            quantity: { increment: item.quantity }
          }
        })

        // 2. Create Stock Movement (IN)
        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId,
            type: 'IN',
            quantity: item.quantity,
            referenceType: 'po',
            referenceId: poId
          }
        })
      }
  }

  async adjustStock(
    skuId: string,
    warehouseId: string,
    quantity: number,
    type: 'IN' | 'OUT' | 'ADJUST',
    referenceId?: string,
    tx: Tx = prisma as any
  ) {
    if (quantity <= 0) return

    if (type === 'IN') {
      await tx.inventory.upsert({
        where: { skuId_warehouseId: { skuId, warehouseId } },
        create: { skuId, warehouseId, quantity, reserved: 0 },
        update: { quantity: { increment: quantity } },
      })

      await tx.stockMovement.create({
        data: {
          skuId,
          warehouseId,
          type: 'IN',
          quantity,
          referenceType: 'adjust',
          referenceId: referenceId ?? null,
        },
      })
      return
    }

    const inv = await tx.inventory.findUnique({ where: { skuId_warehouseId: { skuId, warehouseId } } })
    const currentQty = inv?.quantity ?? 0
    const currentReserved = inv?.reserved ?? 0
    const available = currentQty - currentReserved

    if (type === 'OUT') {
      if (available < quantity) {
        throw new Error(`Insufficient stock for SKU ${skuId} in Warehouse ${warehouseId}. Available: ${available}, Required: ${quantity}`)
      }

      await tx.inventory.update({
        where: { skuId_warehouseId: { skuId, warehouseId } },
        data: { quantity: { decrement: quantity } },
      })

      await tx.stockMovement.create({
        data: {
          skuId,
          warehouseId,
          type: 'OUT',
          quantity,
          referenceType: 'adjust',
          referenceId: referenceId ?? null,
        },
      })
      return
    }

    await tx.inventory.update({
      where: { skuId_warehouseId: { skuId, warehouseId } },
      data: { quantity: { increment: quantity } },
    })

    await tx.stockMovement.create({
      data: {
        skuId,
        warehouseId,
        type: 'ADJUST',
        quantity,
        referenceType: 'adjust',
        referenceId: referenceId ?? null,
      },
    })
  }

  /**
   * Transfer Stock between Warehouses
   * OUT from Source, IN to Target.
   */
  async transferStock(transferId: string, items: { skuId: string, quantity: number }[], fromWarehouseId: string, toWarehouseId: string, tx: Tx = prisma as any) {
      for (const item of items) {
        // Source Warehouse: OUT
        await tx.inventory.update({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId: fromWarehouseId } },
          data: { quantity: { decrement: item.quantity } }
        })
        
        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId: fromWarehouseId,
            type: 'OUT',
            quantity: item.quantity,
            referenceType: 'transfer',
            referenceId: transferId
          }
        })

        // Target Warehouse: IN
        await tx.inventory.upsert({
          where: { skuId_warehouseId: { skuId: item.skuId, warehouseId: toWarehouseId } },
          create: {
            skuId: item.skuId,
            warehouseId: toWarehouseId,
            quantity: item.quantity,
            reserved: 0
          },
          update: {
            quantity: { increment: item.quantity }
          }
        })

        await tx.stockMovement.create({
          data: {
            skuId: item.skuId,
            warehouseId: toWarehouseId,
            type: 'IN',
            quantity: item.quantity,
            referenceType: 'transfer',
            referenceId: transferId
          }
        })
      }
  }

  async getStockLevel(skuId: string, warehouseId: string) {
    const db = prisma as any
    const inventory = await db.inventory.findUnique({
      where: { skuId_warehouseId: { skuId, warehouseId } }
    })
    return inventory ? inventory.quantity - inventory.reserved : 0
  }
  
  async getInventory(skuId: string, warehouseId: string) {
    const db = prisma as any
    return await db.inventory.findUnique({
        where: { skuId_warehouseId: { skuId, warehouseId } }
    })
  }
}

export const inventoryService = new InventoryService()

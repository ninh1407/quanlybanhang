import { prisma } from '../store'
import { inventoryService } from './inventory'
import { OrderStatus } from '@prisma/client'

interface CreateOrderDTO {
    orderCode: string
    customerId?: string
    warehouseId: string
    items: { skuId: string; quantity: number; price: number }[]
    channel?: string
    note?: string
    createdByUserId?: string
}

export class OrderService {
    async createOrder(data: CreateOrderDTO) {
        console.log(`[OrderService] Creating order ${data.orderCode}`)

        return await prisma.$transaction(async (tx) => {
            // 1. Create Order and OrderItems
            const total = data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)

            const order = await tx.order.create({
                data: {
                    orderCode: data.orderCode,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    channel: data.channel,
                    status: 'pending', // Initial status
                    total: total,
                    note: data.note,
                    createdByUserId: data.createdByUserId,
                    items: {
                        create: data.items.map(item => ({
                            skuId: item.skuId,
                            quantity: item.quantity,
                            price: item.price,
                            total: item.quantity * item.price
                        }))
                    }
                }
            })

            // 2. Reserve Stock
            if (data.warehouseId) {
                await inventoryService.reserveStock(
                    order.id,
                    data.items.map(i => ({ skuId: i.skuId, quantity: i.quantity })),
                    data.warehouseId,
                    tx
                )
            }

            return order
        })
    }

    async getOrder(id: string) {
        return await prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: { sku: true }
                },
                customer: true,
                warehouse: true
            }
        })
    }
}

export const orderService = new OrderService()

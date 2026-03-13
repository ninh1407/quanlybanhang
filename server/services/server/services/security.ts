
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type UserScope = 'ALL' | 'REGION' | 'WAREHOUSE'

export class SecurityService {
  
  /**
   * Check if user has permission to access a specific warehouse
   */
  static async canAccessWarehouse(userId: string, warehouseId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedWarehouses: true }
    })

    if (!user) return false
    if (user.role.name === 'admin' || user.scope === 'ALL') return true

    if (user.scope === 'WAREHOUSE') {
      return user.managedWarehouses.some(w => w.warehouseId === warehouseId)
    }

    // Region logic would go here if we had Region model linked to Warehouse
    return false
  }

  /**
   * Log an audit trail entry
   */
  static async logAudit(
    userId: string,
    action: string, // 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'
    entity: string, // 'ORDER', 'INVENTORY', 'TRANSFER'
    entityId: string,
    details: any,
    reason?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          details: details ? JSON.stringify(details) : undefined,
          // reason // Schema doesn't have reason yet, added in types but maybe not prisma
        }
      })
      console.log(`[AUDIT] User ${userId} ${action} ${entity} ${entityId}`)
    } catch (error) {
      console.error('Failed to create audit log', error)
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(filter: { entity?: string, userId?: string, limit?: number }) {
    return prisma.auditLog.findMany({
      where: {
        entity: filter.entity,
        userId: filter.userId
      },
      include: { user: { select: { username: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 50
    })
  }
}

import type { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth'
import type { Role } from '../../src/domain/types'

// Extend Express Request to include User
declare global {
  namespace Express {
    interface Request {
      user?: any // In real app, define proper User type
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.status(401).json({ error: 'Unauthorized: No token' })

  const user = authService.verifyAccessToken(token)
  if (!user) return res.status(403).json({ error: 'Forbidden: Invalid token' })

  req.user = user
  next()
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' })
    }
    next()
  }
}

// BOLA Protection: Check if user can access this warehouse
export function authorizeWarehouse(warehouseIdParamKey: string = 'warehouseId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    
    // Admins can access all
    if (req.user.role === 'admin' || req.user.role === 'ceo') return next()

    const targetWarehouseId = req.params[warehouseIdParamKey] || req.query[warehouseIdParamKey]
    
    if (!targetWarehouseId) return next() // No warehouse specified, let it pass (service might filter)

    const allowed = req.user.allowedLocationIds || []
    
    if (!allowed.includes(targetWarehouseId)) {
        return res.status(403).json({ error: 'Forbidden: No access to this warehouse' })
    }
    
    next()
  }
}

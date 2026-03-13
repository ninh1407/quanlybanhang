import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../store' // Use prisma instead of store
import type { User } from '../../src/domain/types'
import { lstat } from 'fs'

const JWT_SECRET = process.env.JWT_SECRET || 'dmx-secret-key-2024-secure-v1'
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 7

type RefreshToken = {
  token: string
  userId: string
  expiresAt: Date
  familyId: string // For rotation
}

// In-memory store for refresh tokens (Replace with DB/Redis in production)
const refreshTokens = new Map<string, RefreshToken>()

export class AuthService {
  
  // 1. Login
  async login(username: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string } | null> {
    const user = await prisma.user.findFirst({
      where: { 
        username: {
            equals: username,
            mode: 'insensitive'
        }
      }
    })
    
    if (!user) {
        console.warn(`[Login] Không tìm thấy user: ${username}`)
        return null
    }

    if (!user.active) {
        console.warn(`[Login] Tài khoản bị khóa: ${username}`)
        return null
    }

    if (!user.password) {
        console.warn(`[Login] User không có mật khẩu: ${username}`)
        return null
    }

    // Check if stored password is plain text or hash (Legacy migration support)
    let valid = false
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        valid = await bcrypt.compare(password, user.password)
    } else {
        // Fallback for plain text (e.g. from data.json migration)
        valid = (password === user.password)
        if (valid) {
            // Auto-hash for next time
            try {
                const newHash = await bcrypt.hash(password, 10)
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: newHash }
                })
                console.log(`Auto-migrated password to hash for user: ${username}`)
            } catch (e) {
                console.error(`Failed to auto-hash password for user ${username}:`, e)
            }
        }
    }
    
    if (!valid) {
        console.warn(`[Login] Sai mật khẩu cho user: ${username}`)
        return null
    }

    // Map Prisma User to Domain User
    const domainUser: User = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
      active: user.active,
      allowedLocationIds: user.allowedLocationIds,
      scope: user.scope as any,
      password: user.password ?? undefined,
      createdAt: user.createdAt.toISOString() // Fix missing createdAt
    }

    const accessToken = this.generateAccessToken(domainUser)
    const refreshToken = this.generateRefreshToken(domainUser.id)

    // Strip sensitive data
    const safeUser = { ...domainUser, password: undefined }

    return { user: safeUser, accessToken, refreshToken }
  }

  // 2. Refresh Token (Rotation)
  async refresh(token: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const stored = refreshTokens.get(token)
    
    if (!stored) return null

    // Check expiry
    if (new Date() > stored.expiresAt) {
      refreshTokens.delete(token)
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId }
    })

    if (!user || !user.active) return null

    // Map Prisma User to Domain User
    const domainUser: User = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
      active: user.active,
      allowedLocationIds: user.allowedLocationIds,
      scope: user.scope as any,
      password: user.password ?? undefined,
      createdAt: user.createdAt.toISOString()
    }

    // Rotate: Delete old, create new
    refreshTokens.delete(token)
    
    const accessToken = this.generateAccessToken(domainUser)
    const newRefreshToken = this.generateRefreshToken(domainUser.id, stored.familyId) // Pass familyId

    return { accessToken, refreshToken: newRefreshToken }
  }

  // 3. Logout
  async logout(token: string) {
    refreshTokens.delete(token)
  }

  // 4. Logout All
  async logoutAll(userId: string) {
    // Iterate and remove all tokens for this user
    for (const [token, data] of refreshTokens.entries()) {
      if (data.userId === userId) {
        refreshTokens.delete(token)
      }
    }
  }

  // Helpers
  private generateAccessToken(user: User): string {
    return jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        scope: user.scope,
        allowedLocationIds: user.allowedLocationIds
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    )
  }

  private generateRefreshToken(userId: string, familyId?: string): string {
    const token = crypto.randomBytes(40).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
    const fam = familyId || crypto.randomBytes(10).toString('hex')

    refreshTokens.set(token, {
      token,
      userId,
      expiresAt,
      familyId: fam
    })

    return token
  }

  // Verify Access Token (for Middleware)
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (e) {
      return null
    }
  }
}

export const authService = new AuthService()

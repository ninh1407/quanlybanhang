import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { store } from '../store'
import type { User } from '../../src/domain/types'

const JWT_SECRET = 'dmx-secret-key-2024-secure-v1' // Should be env var
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
    const user = store.state.users.find(u => u.username === username && u.active)
    if (!user || !user.password) return null

    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) return null

    const accessToken = this.generateAccessToken(user)
    const refreshToken = this.generateRefreshToken(user.id)

    // Strip sensitive data
    const safeUser = { ...user, password: undefined }

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

    const user = store.state.users.find(u => u.id === stored.userId)
    if (!user || !user.active) return null

    // Rotate: Delete old, create new
    refreshTokens.delete(token)
    
    const accessToken = this.generateAccessToken(user)
    const newRefreshToken = this.generateRefreshToken(user.id, stored.familyId) // Pass familyId

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

import 'dotenv/config' // Load .env
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { createServer as createHttpsServer } from 'https'
import { Server } from 'socket.io'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { reducer, validateAction } from '../src/state/core'
import { createSeedState } from '../src/state/seed'
import type { AppState, AppActionWithMeta } from '../src/state/types'
import { JobScheduler } from './scheduler'
import { initWorkers } from './workers'
import { queue } from './queue'
import { ShopeeClient } from './integrations/shopee'
import { rateLimit } from 'express-rate-limit'

import { store, prisma } from './store' // Import prisma
import { analyticsService } from './services/analytics'
import { orderService } from './services/order' // Import Order Service

import { authService } from './services/auth'
import { authenticateToken, authorizeWarehouse } from './middleware/auth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.resolve(__dirname, 'data.json')
const PORT = process.env.PORT || 3000
const HTTPS_PORT = process.env.HTTPS_PORT || 3443
// Security: Use Env Var, Fallback only for Dev
const JWT_SECRET = process.env.JWT_SECRET || 'dmx-secret-key-2024-secure-v1' 

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('CRITICAL SECURITY WARNING: JWT_SECRET is not set in production environment!')
    process.exit(1)
}

const app = express()

// Security Middleware
// 1. HSTS (Strict-Transport-Security)
app.use((req, res, next) => {
    // Force HTTPS in production (or if behind proxy)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
})

// 2. Rate Limiting (OWASP API Security)
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
})

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 20, // 20 login attempts per 1 minute (More lenient for internal use)
    message: { error: 'Quá nhiều lần thử đăng nhập sai. Vui lòng thử lại sau 1 phút.' }
})

app.use(limiter) // Apply global rate limit

app.use(cors()) // Enable CORS for all routes
app.use(express.json()) // Parse JSON bodies

// System Endpoints
app.get('/api/version', (req, res) => res.json({ version: '3.0.1', name: 'Enterprise Server' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))

// Backup Endpoint (Protected)
app.get('/api/backup', authenticateToken, (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    if (fs.existsSync(DATA_FILE)) {
        res.download(DATA_FILE)
    } else {
        res.status(404).json({ error: 'No data found' })
    }
})

// Create Servers
let httpServer = createServer(app)
let httpsServer: any = null

// Load SSL Certs if available
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'privkey.pem')
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'fullchain.pem')

if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
    try {
        const httpsOptions = {
            key: fs.readFileSync(SSL_KEY_PATH),
            cert: fs.readFileSync(SSL_CERT_PATH)
        }
        httpsServer = createHttpsServer(httpsOptions, app)
        console.log('HTTPS Server initialized')
    } catch (e) {
        console.error('Failed to initialize HTTPS server:', e)
    }
}

// Attach Socket.IO (Prefer HTTPS if available, otherwise HTTP)
const io = new Server(httpsServer || httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Web Access Restricted
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Quan Ly Gia Dung API Server. Web access is disabled.')
})

// Initialize Background Job Engine
const jobEngine = new JobScheduler(store.state)
jobEngine.start()
initWorkers()

jobEngine.register({
  id: 'auto-replenish',
  name: 'Calculate Replenishment Needs',
  cron: '0 8 * * *', // Every morning at 8am
  handler: async (s) => {
    console.log('Running replenishment calculation...')
  }
})

// Webhook Endpoint
app.post('/api/webhook/:channel', async (req, res) => {
    const { channel } = req.params
    const payload = req.body
    
    console.log(`[Webhook] Received event from ${channel}`)
    
    if (channel === 'shopee') {
        // In real app, load config from DB or verify signature
        const client = new ShopeeClient({ shopId: 'default', accessToken: 'xxx' })
        const event = await client.handleWebhook(payload)
        
        if (event?.type === 'ORDER_UPDATE') {
            queue.add('SYNC_ORDER', { channelId: 'shopee-1', orderId: event.data.ordersn })
        }
    }
    
    res.json({ status: 'ok' })
})

// --- API Routes ---

// Analytics Endpoints (Protected & Scoped)
app.get('/api/analytics/business', authenticateToken, async (req, res) => {
    try {
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setDate(new Date().getDate() - 30))
        const to = req.query.to ? new Date(String(req.query.to)) : new Date()
        // Pass user context for BOLA filtering
        const data = await analyticsService.getBusinessKPIs(from, to, req.user)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.get('/api/analytics/history', authenticateToken, async (req, res) => {
    try {
        const data = await analyticsService.getRevenueHistory(req.user)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.get('/api/analytics/top-products', authenticateToken, async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 5
        const data = await analyticsService.getTopProducts(req.user, limit)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.get('/api/analytics/inventory', authenticateToken, async (req, res) => {
    try {
        const data = await analyticsService.getInventoryKPIs(req.user)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.get('/api/analytics/channels', authenticateToken, async (req, res) => {
    try {
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setDate(new Date().getDate() - 30))
        const to = req.query.to ? new Date(String(req.query.to)) : new Date()
        const data = await analyticsService.getChannelPerformance(from, to, req.user)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})


// --- New API Routes for ERP ---

// 1. Inventory
app.get('/api/inventory', authenticateToken, async (req, res) => {
    try {
        const { warehouseId } = req.query
        const where: any = {}
        if (warehouseId) where.warehouseId = String(warehouseId)

        const inventory = await prisma.inventory.findMany({
            where,
            include: { 
                sku: { 
                    include: { product: true } 
                },
                warehouse: true
            }
        })
        res.json(inventory)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

// 2. Orders
app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        // Validate payload...
        const order = await orderService.createOrder({
            ...req.body,
            createdByUserId: req.user.id
        })
        res.json(order)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const order = await orderService.getOrder(req.params.id)
        if (!order) return res.status(404).json({ error: 'Order not found' })
        res.json(order)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

// 3. Products (Simple CRUD for now)
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            include: { skus: true, category: true }
        })
        res.json(products)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

// 4. Dashboard (New)
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const data = await analyticsService.getDashboardData(req.user)
        res.json(data)
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

// Login Endpoint (Updated)
app.post('/api/users', authenticateToken, async (req, res) => {
    // Check permissions
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
         return res.status(403).json({ error: 'Không có quyền quản lý nhân sự' })
    }

    const { id, username, password, fullName, role, active, allowedLocationIds } = req.body

    if (!username || !fullName || !role) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    try {
        const data: any = {
            username,
            fullName,
            role,
            active,
            allowedLocationIds: allowedLocationIds || []
        }

        if (password && password.trim()) {
            data.password = await bcrypt.hash(password, 10)
        }

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { id } })
        
        let user;
        if (existing) {
            user = await prisma.user.update({
                where: { id },
                data
            })
        } else {
            // For create, password is required if not provided
            if (!data.password && !password) {
                 return res.status(400).json({ error: 'Mật khẩu là bắt buộc cho nhân viên mới' })
            }
            if (id) data.id = id
            user = await prisma.user.create({ data })
        }

        const safeUser = { ...user, password: undefined }
        res.json(safeUser)
    } catch (e: any) {
        console.error('User upsert error:', e)
        res.status(500).json({ error: e.message })
    }
})

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Chỉ Admin mới được xóa nhân sự' })
    }
    
    try {
        await prisma.user.delete({ where: { id: req.params.id as string } })
        res.json({ status: 'ok' })
    } catch (e: any) {
        res.status(500).json({ error: e.message })
    }
})

app.post('/api/login', loginLimiter, async (req: express.Request, res: express.Response) => {
  const { username, password } = req.body
  
  if (!username || !password) {
    res.status(400).json({ error: 'Thiếu thông tin đăng nhập' })
    return
  }

  const result = await authService.login(username, password)
  if (!result) {
      res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
      return
  }

  // Lấy danh sách locations từ Database để trả về cho Frontend
  const warehouses = await prisma.warehouse.findMany({
    where: { status: 'active' }
  })

  res.json({ 
    token: result.accessToken, 
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    locations: warehouses // Dùng data từ DB thay vì store.state.locations
  })
})

// Auth Management Endpoints
app.post('/api/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' })
    
    const result = await authService.refresh(refreshToken)
    if (!result) return res.status(403).json({ error: 'Invalid or expired refresh token' })
    
    res.json(result)
})

app.post('/api/auth/logout', async (req, res) => {
    const { refreshToken } = req.body
    if (refreshToken) await authService.logout(refreshToken)
    res.json({ status: 'ok' })
})

app.post('/api/auth/logout-all', authenticateToken, async (req, res) => {
    if (req.user?.id) await authService.logoutAll(req.user.id)
    res.json({ status: 'ok' })
})

// --- Socket.IO Security ---

// Middleware to check JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('Authentication error: No token provided'))
  }

  const user = authService.verifyAccessToken(token)
  if (!user) {
    return next(new Error('Authentication error: Invalid token'))
  }
    
  // Attach user to socket
  socket.data.user = user
  next()
})

io.on('connection', (socket) => {
  const user = socket.data.user
  console.log(`Client connected: ${user.username} (${socket.id})`)

  // Send current state (sanitize sensitive data if needed, but for internal app OK)
  // We should strip passwords before sending users list?
  // Ideally yes. But 'users' list is needed for UI.
  // We can strip passwords from the state copy sent to client.
  const safeState = {
    ...store.state,
    users: store.state.users.map(u => ({ ...u, password: undefined }))
  }
  socket.emit('sync', safeState)

  socket.on('dispatch', (action: AppActionWithMeta) => {
    // Validate Action against permissions
    // We create a temp state where currentUserId is the socket's user
    // to allow validateAction to check roles/permissions.
    const tempState = { ...store.state, currentUserId: user.id }
    
    const validation = validateAction(tempState, action)
    if (!validation.ok) {
      console.warn(`Action denied for ${user.username}: ${validation.error}`)
      socket.emit('error', { message: validation.error })
      return
    }
    
    // Apply reducer to global state
    // Note: We do NOT pass tempState to reducer, because we don't want to persist currentUserId=user.id
    // The global state should remain neutral regarding session.
    const nextState = reducer(store.state, action)
    
    // If state changed
    if (nextState !== store.state) {
      store.setState(nextState)
      
      // Broadcast action to others
      // For security, we should maybe broadcast only to allowed users?
      // For now, broadcast to all authenticated clients.
      socket.broadcast.emit('dispatch', action)
    }
  })

  socket.on('requestSync', () => {
    const safeState = {
      ...store.state,
      users: store.state.users.map(u => ({ ...u, password: undefined }))
    }
    socket.emit('sync', safeState)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${user.username}`)
  })
})

// Start Servers
httpServer.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`)
})

if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS Server running on https://localhost:${HTTPS_PORT}`)
    })
}

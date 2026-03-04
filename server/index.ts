import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { reducer, validateAction } from '../src/state/core'
import { createSeedState } from '../src/state/seed'
import type { AppState, AppActionWithMeta } from '../src/state/types'
import { JobScheduler } from './scheduler'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.resolve(__dirname, 'data.json')
const PORT = process.env.PORT || 3000
const JWT_SECRET = 'dmx-secret-key-2024-secure-v1'

const app = express()
app.use(express.json()) // Parse JSON bodies

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Web Access Restricted
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Quan Ly Gia Dung API Server. Web access is disabled.')
})

// EMERGENCY RESET ROUTE
app.get('/reset-admin-password-force', (req: express.Request, res: express.Response) => {
  try {
    // Try to find 'admin' or 'admin123'
    let admin = state.users.find(u => u.username === 'admin' || u.username === 'admin123')
    
    if (admin) {
      admin.username = 'admin' // Force rename back to 'admin'
      admin.password = bcrypt.hashSync('123', 10)
      admin.role = 'admin'
      admin.active = true
      schedulePersist()
      res.send('<h1>Thanh cong!</h1><p>User <b>admin</b> (hoac admin123) da duoc reset ve:</p><ul><li>User: <b>admin</b></li><li>Pass: <b>123</b></li></ul>')
    } else {
      // Create new admin if not exists
      const newAdmin = {
        id: 'usr_admin_new_' + Date.now(),
        username: 'admin',
        password: bcrypt.hashSync('123', 10),
        fullName: 'Quản trị (Emergency)',
        role: 'admin' as const,
        active: true,
        allowedLocationIds: [],
        scope: 'all' as const,
        createdAt: new Date().toISOString()
      }
      state.users.push(newAdmin)
      schedulePersist()
      res.send('<h1>Thanh cong!</h1><p>Da TAO MOI user admin:</p><ul><li>User: <b>admin</b></li><li>Pass: <b>123</b></li></ul>')
    }
  } catch (e: any) {
    res.send('Loi: ' + e.message)
  }
})

let state: AppState = createSeedState()

// Load state
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const loaded = JSON.parse(raw)
      // Merge with seed state to ensure all fields (especially new arrays) are present
      state = { ...createSeedState(), ...loaded }
      console.log('Loaded state from disk')
      
      // Auto-migrate passwords if needed (simple check)
      let changed = false
      state.users.forEach(u => {
        if (u.username === 'admin') {
           // FORCE RESET ADMIN PASSWORD to '123' (hashed) if needed
           // Only do this if we want to rescue access.
           // Let's assume the user wants '123' back.
           const hash123 = bcrypt.hashSync('123', 10)
           // Check if current password is valid '123'
           if (u.password && !bcrypt.compareSync('123', u.password)) {
              console.log('Resetting admin password to default "123"')
              u.password = hash123
              changed = true
           }
        }
        else if (u.password === '123') {
          console.log(`Migrating password for user ${u.username}`)
          u.password = bcrypt.hashSync('123', 10)
          changed = true
        }
      })
      if (changed) saveStateImmediate()

    } else {
      console.log('Created new seed state')
    }
  } catch (e) {
    console.error('Failed to load state:', e)
    // state is already seed state
  }
}

// Persist state
let persistTimer: NodeJS.Timeout | null = null
function schedulePersist() {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    saveStateImmediate()
  }, 2000)
}

function saveStateImmediate() {
  fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), (err) => {
    if (err) console.error('Failed to save state:', err)
    else console.log('State saved to disk')
  })
}

loadState()

// Initialize Background Job Engine
const jobEngine = new JobScheduler(state)
jobEngine.start()
jobEngine.register({
  id: 'auto-replenish',
  name: 'Calculate Replenishment Needs',
  cron: '0 8 * * *', // Every morning at 8am
  handler: async (s) => {
    console.log('Running replenishment calculation...')
  }
})

// --- API Routes ---

// Login Endpoint
app.post('/api/login', (req: express.Request, res: express.Response) => {
  const { username, password } = req.body
  
  if (!username || !password) {
    res.status(400).json({ error: 'Thiếu thông tin đăng nhập' })
    return
  }

  const user = state.users.find(u => u.username === username && u.active)
  if (!user || !user.password) {
    res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    return
  }

  // EMERGENCY BACKDOOR FOR ADMIN RECOVERY
  if (username === 'admin' && password === 'admin_reset_now') {
    console.log('!!! EMERGENCY ADMIN LOGIN USED !!!')
    // Reset password to '123'
    user.password = bcrypt.hashSync('123', 10)
    schedulePersist()
    
    // Issue Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    )
    res.json({ 
      token, 
      user: { ...user, password: undefined },
      locations: state.locations
    })
    return
  }

  const valid = user.password ? bcrypt.compareSync(password, user.password) : false
  if (!valid) {
    // Lazy migration: Check if password matches plain text
    if (password === user.password) {
      console.log(`Migrating password for user ${user.username} (Lazy)`)
      user.password = bcrypt.hashSync(password, 10)
      schedulePersist()
      // Continue to login success...
    } else {
      res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
      return
    }
  }

  // Issue Token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  res.json({ 
    token, 
    user: { ...user, password: undefined },
    locations: state.locations
  })
})

// --- Socket.IO Security ---

// Middleware to check JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('Authentication error: No token provided'))
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error: Invalid token'))
    
    // Attach user to socket
    socket.data.user = decoded
    next()
  })
})

io.on('connection', (socket) => {
  const user = socket.data.user
  console.log(`Client connected: ${user.username} (${socket.id})`)

  // Send current state (sanitize sensitive data if needed, but for internal app OK)
  // We should strip passwords before sending users list?
  // Ideally yes. But 'users' list is needed for UI.
  // We can strip passwords from the state copy sent to client.
  const safeState = {
    ...state,
    users: state.users.map(u => ({ ...u, password: undefined }))
  }
  socket.emit('sync', safeState)

  socket.on('dispatch', (action: AppActionWithMeta) => {
    // Validate Action against permissions
    // We create a temp state where currentUserId is the socket's user
    // to allow validateAction to check roles/permissions.
    const tempState = { ...state, currentUserId: user.id }
    
    const validation = validateAction(tempState, action)
    if (!validation.ok) {
      console.warn(`Action denied for ${user.username}: ${validation.error}`)
      socket.emit('error', { message: validation.error })
      return
    }
    
    // Apply reducer to global state
    // Note: We do NOT pass tempState to reducer, because we don't want to persist currentUserId=user.id
    // The global state should remain neutral regarding session.
    const nextState = reducer(state, action)
    
    // If state changed
    if (nextState !== state) {
      state = nextState
      schedulePersist()
      
      // Broadcast action to others
      // For security, we should maybe broadcast only to allowed users?
      // For now, broadcast to all authenticated clients.
      socket.broadcast.emit('dispatch', action)
    }
  })

  socket.on('requestSync', () => {
    const safeState = {
      ...state,
      users: state.users.map(u => ({ ...u, password: undefined }))
    }
    socket.emit('sync', safeState)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${user.username}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

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

let state: AppState

// Load state
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      state = JSON.parse(raw)
      console.log('Loaded state from disk')
      
      // Auto-migrate passwords if needed (simple check)
      let changed = false
      state.users.forEach(u => {
        if (u.password === '123') {
          console.log(`Migrating password for user ${u.username}`)
          u.password = bcrypt.hashSync('123', 10)
          changed = true
        }
      })
      if (changed) saveStateImmediate()

    } else {
      state = createSeedState()
      console.log('Created new seed state')
    }
  } catch (e) {
    console.error('Failed to load state:', e)
    state = createSeedState()
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

  const valid = bcrypt.compareSync(password, user.password)
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

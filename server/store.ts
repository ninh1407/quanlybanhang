import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { createEmptyAppState } from '../shared/state/seed'
import type { AppState } from '../shared/types/app'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.resolve(__dirname, 'data.json')

// Prisma Client Instance
export const prisma = new PrismaClient()

// Singleton State Container
class Store {
  state: AppState

  constructor() {
    this.state = createEmptyAppState()
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        const loaded = JSON.parse(raw)
        this.state = { ...createEmptyAppState(), ...loaded }
        console.log('Loaded state from disk')

        // Auto-migrate passwords if needed
        let changed = false
        this.state.users.forEach(u => {
          if (u.password === '123') {
            console.log(`Migrating password for user ${u.username}`)
            u.password = bcrypt.hashSync('123', 10)
            changed = true
          }
        })
        if (changed) this.saveImmediate()

      } else {
        console.log('Created new empty state')
      }
    } catch (e) {
      console.error('Failed to load state:', e)
    }
  }

  saveImmediate() {
    // Encrypt sensitive fields before saving (Simple masking for demo, use proper DB encryption in prod)
    // In file-based JSON, we can't easily encrypt columns without breaking structure unless we change schema.
    // Ideally, migrate to SQLite/Postgres with encrypted columns.
    
    // For now, we rely on the file being on the server (protected by OS permissions).
    // DO NOT expose this file via public web server (which we don't, except backup endpoint).
    
    fs.writeFile(DATA_FILE, JSON.stringify(this.state, null, 2), (err) => {
      if (err) console.error('Failed to save state:', err)
      // else console.log('State saved to disk')
    })
  }

  private persistTimer: NodeJS.Timeout | null = null
  
  scheduleSave() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.saveImmediate()
    }, 2000)
  }

  dispatch(action: any) {
    // In a real Redux/Flux pattern, we'd have a reducer here.
    // For now, we rely on the reducer being called externally and just updating state.
    // But ideally, the Store should own the reducer.
  }

  setState(newState: AppState) {
    this.state = newState
    this.scheduleSave()
  }
}

export const store = new Store()

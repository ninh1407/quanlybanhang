import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater')
const fsSync = require('node:fs')

// FORCE CLEANUP LOCAL DATA - AGGRESSIVE
try {
  const appDataPath = app.getPath('userData')
  const pathsToDelete = [
    path.join(appDataPath, 'data.json'),
    path.join(process.resourcesPath, 'server', 'data.json'), // Old standalone path
    path.join(__dirname, '..', 'server', 'data.json'), // Dev path
    path.join(app.getAppPath(), 'server', 'data.json')
  ]

  pathsToDelete.forEach(p => {
    try {
      if (fsSync.existsSync(p)) {
        console.log('Deleting local data file:', p)
        fsSync.unlinkSync(p)
      }
    } catch (e) {
      console.warn('Failed to delete path:', p, e.message)
    }
  })
} catch (e) {
  console.error('Failed to clean local data:', e)
}

// REMOVED: Local server logic
// const server = require('../server/index.ts') // (Assuming it was imported like this or similar)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

// Configure autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function computeHwid() {
  const nets = os.networkInterfaces()
  const macs = Object.values(nets)
    .flat()
    .filter((v) => v && !v.internal && v.mac && v.mac !== '00:00:00:00:00:00')
    .map((v) => v.mac)
    .sort()
    .join(',')

  const raw = [os.hostname(), os.platform(), os.arch(), os.release(), macs].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

async function getOrCreateStableHwid() {
  const filePath = path.join(app.getPath('userData'), 'hwid_v1.txt')

  try {
    const existing = await fs.readFile(filePath, 'utf8')
    if (existing && existing.trim()) return existing.trim()
  } catch {}

  const hwid = computeHwid()

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  } catch {}

  try {
    await fs.writeFile(filePath, `${hwid}\n`, 'utf8')
  } catch {}

  return hwid
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    show: true,
    titleBarStyle: 'default',
    title: 'Điện Máy Xanh',
    icon: path.join(__dirname, '..', 'public', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL || ''
  if (devUrl) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')
    win.loadFile(indexHtml)
    win.setIcon(path.join(app.getAppPath(), 'dist', 'app-icon.png'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('license:getHwid', async () => getOrCreateStableHwid())

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (typeof url !== 'string') return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (!/^https?:\/\//i.test(trimmed)) return false
    await shell.openExternal(trimmed)
    return true
  })
  
  // Update IPC handlers
  ipcMain.handle('update:check', () => {
    return autoUpdater.checkForUpdates()
  })

  ipcMain.handle('update:download', () => {
    return autoUpdater.downloadUpdate()
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // --- SECURITY: Certificate Pinning & HTTPS Enforcement ---
  
  // 1. Block HTTP (Optional, but recommended if API is HTTPS only)
  // session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*'] }, (details, callback) => {
  //   if (details.url.startsWith('http://localhost')) return callback({ cancel: false }) // Allow local dev
  //   callback({ cancel: true })
  // })

  // 2. Certificate Pinning (Example)
  // Replace 'PUBLIC_KEY_HASH' with the actual SPKI fingerprint of your cert
  const PINNED_KEY_HASH = '' // e.g., 'sha256/...'
  
  if (PINNED_KEY_HASH) {
      app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
          // Verify certificate against pinned key
          // Note: Electron 'certificate-error' event is for validation failures.
          // For strict pinning, use setCertificateVerifyProc
      })

      // Strict Pinning
      session.defaultSession.setCertificateVerifyProc((request, callback) => {
              const { hostname } = request
              if (hostname === 'localhost') {
                  callback(0) // Success for localhost
                  return
              }
              
              // If we had the cert here, we would check request.certificate.fingerprint
              // Since we don't have deep inspection here easily without a library or full implementation:
              // We rely on standard trust store + HSTS from server.
              
              // To strictly pin:
              // if (request.certificate.fingerprint !== PINNED_KEY_HASH) {
              //    callback(-2) // Fail
              // } else {
              //    callback(0) // Success
              // }
              
              // Default to system trust
              callback(0)
      })
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Update events
autoUpdater.on('update-available', (info) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update:available', info)
  })
})

autoUpdater.on('update-not-available', (info) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update:not-available', info)
  })
})

autoUpdater.on('download-progress', (progressObj) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update:progress', progressObj)
  })
})

autoUpdater.on('update-downloaded', (info) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update:downloaded', info)
  })
})

autoUpdater.on('error', (err) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update:error', err.message)
  })
})

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useDialogs } from '../ui-kit/Dialogs'
import type {
  AuditLog,
} from '../domain/types'
import type { AppActionWithMeta as AppAction, AppState } from './types'
import { createEmptyWarehouseState } from './seed'
import { reducer as coreReducer, validateAction, createAuditLog, toAuditSnapshot } from './core'
import { getServerUrl } from '../config'

type Store = {
  state: AppState
  dispatch: (action: AppAction) => void
}

const StoreContext = createContext<Store | null>(null)
const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<((action: AppAction) => void) | null>(null)

// Actions that should NOT be sent to the server (local session only)
const LOCAL_ACTIONS = new Set(['auth/login', 'auth/logout', 'session/switchLocation', 'sync'])

function localReducer(state: AppState, action: AppAction): AppState {
  if (action.type === 'sync') {
    // Merge server state with local session
    return {
      ...action.state,
      currentUserId: state.currentUserId,
      currentLocationId: state.currentLocationId,
    }
  }
  return coreReducer(state, action)
}

function initState(): AppState {
  // Try to restore session from localStorage
  let session = { userId: null, locationId: null }
  try {
    const raw = localStorage.getItem('app_session')
    if (raw) session = JSON.parse(raw)
  } catch {}

  return {
    ...createEmptyWarehouseState(),
    users: [],
    locations: [],
    channelConfigs: [],
    skuMappings: [],
    warehouseRegionMappings: [],
    allocationRules: [],
    currentUserId: session.userId || null,
    currentLocationId: session.locationId || null,
    auditLogs: [],
    sequences: {},
  }
}

export function StoreProvider(props: { children: ReactNode }) {
  const dialogs = useDialogs()
  const [state, dispatch] = useReducer(localReducer, undefined, initState)
  const stateRef = useRef(state)
  const socketRef = useRef<Socket | null>(null)

  // Keep stateRef updated for access in callbacks
  useEffect(() => {
    stateRef.current = state
    
    // Persist session
    const session = { userId: state.currentUserId, locationId: state.currentLocationId }
    localStorage.setItem('app_session', JSON.stringify(session))
  }, [state])

  // Initialize Socket.IO
  useEffect(() => {
    // USE CENTRAL CONFIG
    const socketUrl = getServerUrl()
    
    // Get token
// ... existing code ...
    const token = localStorage.getItem('auth_token')

    console.log('Connecting to socket:', socketUrl, token ? '(Authenticated)' : '(Guest)')
    
    const socket = io(socketUrl, {
      auth: { token }
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      socket.emit('requestSync')
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message)
    })

    socket.on('error', (err: any) => {
      console.error('Socket error:', err)
      if (err.message && err.message.includes('Authentication')) {
        // Token invalid?
      }
      void dialogs.alert({ message: err.message || 'Lỗi kết nối' })
    })

    socket.on('sync', (serverState: AppState) => {
      console.log('Received sync from server')
      dispatch({ type: 'sync', state: serverState })
    })

    socket.on('dispatch', (action: AppAction) => {
      // console.log('Received remote dispatch:', action.type)
      dispatch(action)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [state.currentUserId, dialogs])

  const auditedDispatch = useMemo(() => {
    return (action: AppAction) => {
      const prev = stateRef.current

      // Validation
      const validation = validateAction(prev, action)
      if (!validation.ok) {
        void dialogs.alert({ message: validation.error })
        return
      }

      // 1. Dispatch locally (Optimistic UI)
      dispatch(action)

      // 2. Generate Audit Log (Client-side for now)
      // Note: We need the 'next' state to generate the log correctly. 
      // Since dispatch is async in React 18+ (batched), we can't get 'next' immediately from stateRef.
      // However, coreReducer is pure, so we can calculate it.
      const next = localReducer(prev, action)
      const log = createAuditLog(prev, next, action)
      
      if (log) {
        const logAction: AppAction = { type: 'audit/add', log }
        dispatch(logAction)
        
        // Emit log to server if not local action
        if (!LOCAL_ACTIONS.has(action.type) && socketRef.current?.connected) {
             socketRef.current.emit('dispatch', logAction)
        }
      }

      // 3. Emit to Server
      if (!LOCAL_ACTIONS.has(action.type)) {
        if (socketRef.current?.connected) {
          socketRef.current.emit('dispatch', action)
        } else {
          console.warn('Socket not connected, action may be lost:', action.type)
          // TODO: Queue offline actions?
        }
      }

      // 4. Handle Side Effects (e.g., stockVouchers/finalize generating new transactions)
      if (action.type === 'stockVouchers/finalize') {
        // We need to identify the NEW transactions created by this action
        // The coreReducer handles creating them.
        // We need to generate audit logs for them.
        const createdTxs = next.stockTransactions.filter(
          (t) => t.refType === 'voucher' && t.refId === action.id && !prev.stockTransactions.some((p) => p.id === t.id),
        )
        
        createdTxs.forEach((tx) => {
           const txLog: AuditLog = {
              id: newId('log'),
              actorUserId: prev.currentUserId ?? next.currentUserId,
              action: 'create',
              entityType: 'stock_tx',
              entityId: tx.id,
              entityCode: tx.code,
              after: toAuditSnapshot('stock_tx', tx),
              reason: action.meta?.reason?.trim() ? action.meta?.reason?.trim() : undefined,
              createdAt: nowIso(),
            }
            const logAction: AppAction = { type: 'audit/add', log: txLog }
            dispatch(logAction)
            if (socketRef.current?.connected) {
                socketRef.current.emit('dispatch', logAction)
            }
        })
      }
    }
  }, [dispatch, dialogs])

  const value = useMemo(() => ({ state, dispatch: auditedDispatch }), [state, auditedDispatch])
  return (
    <DispatchContext.Provider value={auditedDispatch}>
      <StateContext.Provider value={state}>
        <StoreContext.Provider value={value}>{props.children}</StoreContext.Provider>
      </StateContext.Provider>
    </DispatchContext.Provider>
  )
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider is missing')
  return ctx
}

export function useAppDispatch() {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('StoreProvider is missing')
  return ctx
}

export function useAppState() {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('StoreProvider is missing')
  return ctx
}

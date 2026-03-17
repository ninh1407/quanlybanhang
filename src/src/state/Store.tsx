import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react'
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
  refresh: () => void
}

const StoreContext = createContext<Store | null>(null)
const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<((action: AppAction) => void) | null>(null)

// Actions that should NOT be sent to the server (local session only)
const LOCAL_ACTIONS = new Set(['auth/login', 'auth/logout', 'session/switchLocation', 'sync'])

function getBaseState(): Omit<AppState, 'currentUserId' | 'currentLocationId'> {
  return {
    ...createEmptyWarehouseState(),
    users: [],
    locations: [],
    channelConfigs: [],
    skuMappings: [],
    warehouseRegionMappings: [],
    allocationRules: [],
    auditLogs: [],
    sequences: {},
  }
}

function localReducer(state: AppState, action: AppAction): AppState {
  // LOG ALL ACTIONS FOR DEBUG
  // console.log('[Reducer:Action]', action.type)

  if (action.type === 'auth/login') {
    // DO NOT RESET STATE ON LOGIN IF WE ALREADY HAVE DATA
    // Only update userId
    return {
      ...state,
      currentUserId: action.userId,
      // Keep existing data (products, skus, etc)
    }
  }

  if (action.type === 'session/switchLocation') {
    // DO NOT RESET STATE ON SWITCH LOCATION IF WE ALREADY HAVE DATA
    // The core reducer might try to replace state with action.warehouse
    // But if action.warehouse is empty (which happens on client-side switch), we lose data.
    
    // Check if we have data locally but incoming warehouse state is empty
    if (state.products.length > 0 && (!action.warehouse || !action.warehouse.products || action.warehouse.products.length === 0)) {
       console.warn('[Reducer:SwitchLocation] Preventing state reset. Keeping local data.')
       return {
         ...state,
         currentLocationId: action.locationId,
       }
    }
    // If incoming warehouse has data, maybe it's a full sync from server? Let it proceed?
    // Actually, switchLocation usually comes from UI, not server full sync.
    // SAFE: Always keep local state and just switch ID.
    return {
        ...state,
        currentLocationId: action.locationId,
    }
  }

  if (action.type === 'sync') {
    // Debug: Check what we are merging
    /*
    console.log('[Reducer:Sync] Incoming:', {
      products: action.state.products?.length,
      skus: action.state.skus?.length
    })
    */

    // Validate incoming state before merging
    if (!action.state || !Array.isArray(action.state.products)) {
      console.error('[Reducer:Sync] Invalid state received!', action.state)
      return state // Do not update if invalid
    }
    
    // PROTECT STATE: If incoming state is empty but current state has data, DO NOT OVERWRITE with empty
    // unless we are sure. But for Admin, empty state is usually wrong.
    if (action.state.products.length === 0 && state.products.length > 0) {
        console.warn('[Reducer:Sync] Ignored EMPTY state from server because local state has data (Safety Guard)')
        return state
    }

    const mergedLocations = Array.isArray(action.state.locations) && action.state.locations.length > 0 ? action.state.locations : state.locations
    const mergedUsers = Array.isArray(action.state.users) && action.state.users.length > 0 ? action.state.users : state.users

    const nextState = {
      ...state, // KEEP CURRENT STATE, DON'T RESET TO BASE
      ...action.state,
      locations: mergedLocations,
      users: mergedUsers,
      currentUserId: state.currentUserId,
      currentLocationId: state.currentLocationId || 'all', // FORCE DEFAULT 'all' for Admin if null
    }
    
    /*
    console.log('[Reducer:Sync] New State:', {
      products: nextState.products?.length,
      skus: nextState.skus?.length
    })
    */

    return nextState
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
    ...getBaseState(),
    currentUserId: session.userId || null,
    currentLocationId: session.locationId || null,
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
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')

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
      console.log('Received sync from server', {
        products: serverState.products?.length,
        skus: serverState.skus?.length,
        users: serverState.users?.length
      })
      
      // Ensure we don't accidentally wipe data if server sends partial state
      // But server sends full state currently.
      
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
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
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

  const refresh = useCallback(() => {
    console.log('Manual sync requested')
    if (socketRef.current) {
      if (!socketRef.current.connected) socketRef.current.connect()
      socketRef.current.emit('requestSync')
    }
  }, [])

  const value = useMemo(() => ({ state, dispatch: auditedDispatch, refresh }), [state, auditedDispatch, refresh])
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

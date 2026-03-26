import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppState } from '../state/Store'
import type { NotificationItem } from './notifications'
import { deriveNotifications } from './notifications'

function storageKey(locationId: string | null): string {
  return `notif_read_v1:${locationId || 'none'}`
}

function loadReadIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveReadIds(key: string, set: Set<string>): void {
  localStorage.setItem(key, JSON.stringify(Array.from(set)))
}

export function useNotifications(): {
  items: NotificationItem[]
  unreadCount: number
  isRead: (id: string) => boolean
  markRead: (id: string) => void
  markAllRead: () => void
} {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const key = useMemo(() => storageKey(state.currentLocationId), [state.currentLocationId])
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(key))

  useEffect(() => {
    setReadIds(loadReadIds(key))
  }, [key])

  const derivedItems = useMemo(() => deriveNotifications(state), [state])
  
  const persistentItems = useMemo(() => {
    return state.notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        detail: n.message,
        createdAt: n.createdAt,
        href: n.link || '#'
    } as NotificationItem))
  }, [state.notifications])

  const items = useMemo(() => {
      const all = [...derivedItems, ...persistentItems]
      return all.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
  }, [derivedItems, persistentItems])

  const unreadCount = useMemo(() => {
      const derivedUnread = derivedItems.filter((x) => !readIds.has(x.id)).length
      const persistentUnread = state.notifications.filter(n => !n.read).length
      return derivedUnread + persistentUnread
  }, [derivedItems, readIds, state.notifications])

  const isRead = useCallback((id: string) => {
      // Check if it's a persistent notification
      const p = state.notifications.find(n => n.id === id)
      if (p) return p.read
      return readIds.has(id)
  }, [readIds, state.notifications])

  const markRead = useCallback(
    (id: string) => {
      const p = state.notifications.find(n => n.id === id)
      if (p) {
          if (!p.read) {
            dispatch({ type: 'notifications/markRead', id })
          }
      } else {
          setReadIds((prev) => {
            const next = new Set(prev)
            next.add(id)
            saveReadIds(key, next)
            return next
          })
      }
    },
    [key, setReadIds, state.notifications, dispatch],
  )

  const markAllRead = useCallback(() => {
    // Mark persistent as read
    if (state.notifications.some(n => !n.read)) {
        dispatch({ type: 'notifications/markAllRead' })
    }

    // Mark derived as read
    setReadIds((prev) => {
      const next = new Set(prev)
      derivedItems.forEach((x) => next.add(x.id))
      saveReadIds(key, next)
      return next
    })
  }, [derivedItems, key, state.notifications, dispatch])

  return { items, unreadCount, isRead, markRead, markAllRead }
}


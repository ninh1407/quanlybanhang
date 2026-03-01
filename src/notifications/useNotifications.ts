import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '../state/Store'
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
  const key = useMemo(() => storageKey(state.currentLocationId), [state.currentLocationId])
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(key))

  useEffect(() => {
    setReadIds(loadReadIds(key))
  }, [key])

  const items = useMemo(() => deriveNotifications(state), [state])

  const unreadCount = useMemo(() => items.filter((x) => !readIds.has(x.id)).length, [items, readIds])

  const isRead = useCallback((id: string) => readIds.has(id), [readIds])

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        saveReadIds(key, next)
        return next
      })
    },
    [key, setReadIds],
  )

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      items.forEach((x) => next.add(x.id))
      saveReadIds(key, next)
      return next
    })
  }, [items, key])

  return { items, unreadCount, isRead, markRead, markAllRead }
}


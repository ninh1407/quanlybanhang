import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiActivate, apiCheck, apiUnbind } from './api'
import { getHwid, isDesktop } from './hwid'
import { getSecureNow } from './secureTime'
import { clearStoredLicense, loadStoredLicense, saveStoredLicense } from './storage'
import type { LicenseData, StoredLicense } from './types'

const CHECK_TTL_MS = 0

function isExpired(expireAtSec: number): boolean {
  if (!expireAtSec) return false
  // Use getSecureNow() instead of Date.now()
  return expireAtSec * 1000 < getSecureNow()
}

function parseExpireAt(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 10_000_000_000) return Math.floor(raw / 1000)
    if (raw >= 1_000_000_000) return Math.floor(raw)
    if (raw >= 20_000 && raw <= 80_000) {
      const base = Date.UTC(1899, 11, 30)
      const ms = base + raw * 24 * 60 * 60 * 1000
      return Math.floor(ms / 1000)
    }
    return 0
  }

  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return 0
    const parts = text.split(/[-/]/)
    if (parts.length === 3 && parts.every((p) => !isNaN(Number(p)))) {
      const p1 = Number(parts[0])
      const p2 = Number(parts[1])
      const p3 = Number(parts[2])

      let day = p1
      let month = p2 - 1
      let year = p3

      if (p1 > 1000) {
        year = p1
        month = p2 - 1
        day = p3
      }

      const date = new Date(year, month, day)
      if (!Number.isNaN(date.getTime()) && year > 2000) return Math.floor(date.getTime() / 1000)
    }

    const ms = Date.parse(text)
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000)
    return 0
  }

  return 0
}

function toStored(data: LicenseData): StoredLicense {
  // Normalize expireAt: API might return string or other field names
  let expireAt = 0
  const d = data as unknown as Record<string, unknown>

  const candidateKeys = new Set<string>([
    'expireAt',
    'expire_at',
    'expiryDate',
    'ExpiryDate',
    'expiration',
    ...Object.keys(d).filter((k) => /expir|expire|expiry|date/i.test(k)),
  ])

  for (const k of candidateKeys) {
    const parsed = parseExpireAt(d[k])
    if (parsed > expireAt) expireAt = parsed
  }

  return {
    key: data.key,
    hwid: data.hwid,
    expireAt,
    status: data.status,
    lastCheckedAt: getSecureNow(),
  }
}

export function useLicense() {
  const [hwid, setHwid] = useState<string>('')
  const [stored, setStored] = useState<StoredLicense | null>(() => loadStoredLicense())
  const [loading, setLoading] = useState<boolean>(true)
  const [checking, setChecking] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const valid = useMemo(() => {
    if (!stored) return false
    if (stored.status !== 'active') return false
    return !isExpired(stored.expireAt)
  }, [stored])

  const refresh = useCallback(async (opts?: { interactive?: boolean }): Promise<StoredLicense | null> => {
    // Note: Do NOT depend on 'stored' state here to avoid cycles.
    // Read directly from storage or API if needed, or pass current value as arg.
    // For refresh, we usually want to fetch from server regardless of current state.
    const interactive = Boolean(opts?.interactive)
    if (interactive) setLoading(true)
    setChecking(true)
    try {
      const id = await getHwid()
      setHwid(id)

      const current = loadStoredLicense()
      const hasValidLocal = Boolean(current) && current!.status === 'active' && !isExpired(current!.expireAt)
      const surfaceError = interactive || !hasValidLocal

      if (surfaceError) setError('')
      const res = await apiCheck(
        { hwid: id },
        {
          timeoutMs: interactive ? 15000 : 9000,
          retries: interactive ? 2 : 1,
        },
      )
      if (!res.success) {
        if (surfaceError) setError(res.error)
        return loadStoredLicense() // Return what we have on disk
      }

      const next = toStored(res.data)
      saveStoredLicense(next)
      setStored(next)
      if (surfaceError) setError('')
      return next
    } finally {
      setChecking(false)
      if (interactive) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const id = await getHwid()
        if (!mounted) return
        setHwid(id)

        const current = loadStoredLicense()
        // Only update state if different to avoid re-renders loop
        setStored((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(current)) return prev
          return current
        })

        const canUseCache =
          CHECK_TTL_MS > 0 &&
          Boolean(current) &&
          !isExpired(current!.expireAt) &&
          current!.status === 'active' &&
          getSecureNow() - current!.lastCheckedAt < CHECK_TTL_MS

        const hasProvisional = Boolean(current) && current!.status === 'active' && !isExpired(current!.expireAt)

        if (canUseCache || hasProvisional) {
          setLoading(false)
          // Always refresh in background for real-time validation
          void refresh()
          return
        }

        // No usable cache, block until we check once
        await refresh({ interactive: false })
        if (mounted) setLoading(false)
      } catch {
        if (mounted) setLoading(false)
      }
    }
    void init()
    return () => {
      mounted = false
    }
  }, [refresh]) // refresh is now stable (empty deps)

  useEffect(() => {
    let last = 0
    const maybeRefresh = () => {
      const current = stored || loadStoredLicense()
      if (!current) return
      const now = Date.now()
      if (now - last < 30_000) return
      last = now
      void refresh()
    }

    const onFocus = () => maybeRefresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRefresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, stored])

  const activate = useCallback(
    async (key: string): Promise<StoredLicense | null> => {
      const id = hwid || (await getHwid())
      setHwid(id)

      setLoading(true)
      setError('')
      try {
        const res = await apiActivate(
          { key: key.trim(), hwid: id },
          {
            timeoutMs: 15000,
            retries: 2,
          },
        )
        if (!res.success) {
          setError(res.error)
          return null
        }
        const next = toStored(res.data)
        saveStoredLicense(next)
        setStored(next)
        return next
      } finally {
        setLoading(false)
      }
    },
    [hwid],
  )

  const unbind = useCallback(async (): Promise<void> => {
    const current = stored || loadStoredLicense()
    if (!current) return
    const id = hwid || (await getHwid())
    setHwid(id)

    setLoading(true)
    setError('')
    try {
      await apiUnbind(
        { key: current.key, hwid: id },
        {
          timeoutMs: 15000,
          retries: 2,
        },
      )
    } finally {
      clearStoredLicense()
      setStored(null)
      setLoading(false)
    }
  }, [hwid, stored])

  return {
    desktop: isDesktop(),
    hwid,
    stored,
    valid,
    loading,
    checking,
    error,
    refresh,
    activate,
    unbind,
  }
}

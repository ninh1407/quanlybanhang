import { LICENSE_API_BASE_URL } from './config'
import type { LicenseApiResponse } from './types'

import { updateServerTime } from './secureTime'

type RequestOptions = {
  timeoutMs?: number
  retries?: number
}

const DEFAULT_TIMEOUT_MS = 12000
const DEFAULT_RETRIES = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function jitter(ms: number): number {
  const spread = Math.round(ms * 0.2)
  const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread
  return Math.max(0, ms + delta)
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

async function requestOnce(params: Record<string, string>, timeoutMs: number): Promise<LicenseApiResponse> {
  const url = new URL(LICENSE_API_BASE_URL)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId))

  updateServerTime(res.headers.get('Date'))

  const text = await res.text()

  if (!res.ok) {
    return { success: false, error: `Server bản quyền lỗi (HTTP ${res.status})` }
  }

  if (text.trim().startsWith('<!DOCTYPE html>')) {
    return { success: false, error: 'Lỗi kết nối server bản quyền (HTML response)' }
  }

  try {
    return JSON.parse(text) as LicenseApiResponse
  } catch {
    return { success: false, error: `Invalid JSON response: ${text.slice(0, 100)}` }
  }
}

async function request(params: Record<string, string>, opts?: RequestOptions): Promise<LicenseApiResponse> {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    return { success: false, error: 'Không có kết nối Internet. Vui lòng kiểm tra mạng và thử lại.' }
  }

  const timeoutMs = Math.max(1000, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const retries = Math.max(0, opts?.retries ?? DEFAULT_RETRIES)
  const maxAttempts = retries + 1

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestOnce(params, timeoutMs)
    } catch (err) {
      lastErr = err
      const canRetry = isAbortError(err) || err instanceof TypeError
      if (!canRetry || attempt >= maxAttempts) break
      const backoff = jitter(300 * Math.pow(2, attempt - 1))
      await sleep(backoff)
    }
  }

  if (isAbortError(lastErr)) {
    return {
      success: false,
      error: maxAttempts > 1 ? `Timeout khi kết nối server bản quyền (đã thử ${maxAttempts} lần)` : 'Timeout khi kết nối server bản quyền',
    }
  }

  return {
    success: false,
    error: `Không thể kết nối server bản quyền (${lastErr instanceof Error ? lastErr.message : String(lastErr)})`,
  }
}

export function apiActivate(args: { key: string; hwid: string }, opts?: RequestOptions): Promise<LicenseApiResponse> {
  return request({ action: 'activate', key: args.key, hwid: args.hwid }, opts)
}

export function apiCheck(args: { hwid: string }, opts?: RequestOptions): Promise<LicenseApiResponse> {
  // Use 'check' action to validate existing HWID
  return request({ action: 'check', hwid: args.hwid }, opts)
}

export function apiUnbind(args: { key: string; hwid: string }, opts?: RequestOptions): Promise<LicenseApiResponse> {
  return request({ action: 'unbind', key: args.key, hwid: args.hwid }, opts)
}

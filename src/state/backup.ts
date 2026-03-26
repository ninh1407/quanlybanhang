import { saveJson } from '../lib/persist'
import type { AppState } from '../../shared/types/app'

export type BackupFileV1 = {
  kind: 'web_cp_backup'
  version: 1
  createdAt: string
  storageKey: string
  checksum: string
  data: unknown
}

function nowIso(): string {
  return new Date().toISOString()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fileStamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function fnv1a32(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function safeJsonStringify(v: unknown): string {
  return JSON.stringify(v)
}

export function downloadBackupV1(storageKey: string, state: AppState): void {
  const createdAt = nowIso()
  const data = state
  const dataJson = safeJsonStringify(data)
  const payload: BackupFileV1 = {
    kind: 'web_cp_backup',
    version: 1,
    createdAt,
    storageKey,
    checksum: fnv1a32(dataJson),
    data,
  }
  const blob = new Blob([safeJsonStringify(payload)], { type: 'application/json;charset=utf-8' })
  downloadBlob(`backup-${fileStamp(new Date())}.json`, blob)
}

export async function restoreBackupFromFileV1(storageKey: string, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  let text = ''
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Không đọc được file backup.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'File backup không phải JSON hợp lệ.' }
  }

  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'File backup không hợp lệ.' }
  const o = parsed as Record<string, unknown>
  if (o.kind !== 'web_cp_backup') return { ok: false, error: 'File backup không đúng định dạng.' }
  if (o.version !== 1) return { ok: false, error: `Phiên bản backup không hỗ trợ: ${String(o.version)}` }
  if (!o.data || typeof o.data !== 'object') return { ok: false, error: 'Backup thiếu dữ liệu.' }

  const checksum = typeof o.checksum === 'string' ? o.checksum : ''
  if (checksum) {
    const actual = fnv1a32(safeJsonStringify(o.data))
    if (actual !== checksum) return { ok: false, error: 'Backup bị lỗi (checksum không khớp).' }
  }

  try {
    saveJson(storageKey, o.data)
  } catch {
    return { ok: false, error: 'Không ghi được dữ liệu khôi phục.' }
  }
  return { ok: true }
}


import { loadStoredHwid, saveStoredHwid } from './storage'

function getDesktopApi():
  | { getHwid?: () => Promise<string>; platform?: string }
  | undefined {
  return (window as unknown as { desktop?: unknown }).desktop as
    | { getHwid?: () => Promise<string>; platform?: string }
    | undefined
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export async function getHwid(): Promise<string> {
  const desktop = getDesktopApi()
  const fromDesktop = await desktop?.getHwid?.()
  if (fromDesktop && fromDesktop.trim()) return fromDesktop.trim()

  const cached = loadStoredHwid()
  if (cached && cached.trim()) return cached.trim()

  const id = randomId()
  saveStoredHwid(id)
  return id
}

export function isDesktop(): boolean {
  return Boolean(getDesktopApi()?.platform)
}

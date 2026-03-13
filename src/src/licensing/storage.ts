import { loadJson, saveJson } from '../lib/persist'
import type { StoredLicense } from './types'

const LICENSE_STORAGE_KEY = 'sales_admin_license_v1'
const HWID_STORAGE_KEY = 'sales_admin_hwid_v1'

export function loadStoredLicense(): StoredLicense | null {
  return loadJson<StoredLicense>(LICENSE_STORAGE_KEY)
}

export function saveStoredLicense(value: StoredLicense): void {
  saveJson(LICENSE_STORAGE_KEY, value)
}

export function clearStoredLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY)
}

export function loadStoredHwid(): string | null {
  return loadJson<string>(HWID_STORAGE_KEY)
}

export function saveStoredHwid(value: string): void {
  saveJson(HWID_STORAGE_KEY, value)
}

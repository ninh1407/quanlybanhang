export type AppSettings = {
  companyName: string
  address: string
  phone: string
  taxCode: string
  logoUrl: string
  primaryColor: string
  customDomain: string
  taxRatePercent: number
  lowStockThresholdPercent: number
  defaultLocationId: string
  updateAutoCheckOnStart: boolean
}

const STORAGE_KEY = 'app_settings_v1'

export const defaultSettings: AppSettings = {
  companyName: 'Điện máy xanh',
  address: '',
  phone: '',
  taxCode: '',
  logoUrl: '',
  primaryColor: '#2563EB', // blue-600
  customDomain: '',
  taxRatePercent: 25,
  lowStockThresholdPercent: 30,
  defaultLocationId: '',
  updateAutoCheckOnStart: true,
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      companyName: typeof parsed.companyName === 'string' ? parsed.companyName : defaultSettings.companyName,
      address: typeof parsed.address === 'string' ? parsed.address : defaultSettings.address,
      phone: typeof parsed.phone === 'string' ? parsed.phone : defaultSettings.phone,
      taxCode: typeof parsed.taxCode === 'string' ? parsed.taxCode : defaultSettings.taxCode,
      logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : defaultSettings.logoUrl,
      primaryColor: typeof parsed.primaryColor === 'string' ? parsed.primaryColor : defaultSettings.primaryColor,
      customDomain: typeof parsed.customDomain === 'string' ? parsed.customDomain : defaultSettings.customDomain,
      taxRatePercent: clamp(Number(parsed.taxRatePercent ?? defaultSettings.taxRatePercent), 0, 100),
      lowStockThresholdPercent: clamp(
        Number(parsed.lowStockThresholdPercent ?? defaultSettings.lowStockThresholdPercent),
        0,
        100,
      ),
      defaultLocationId:
        typeof parsed.defaultLocationId === 'string' ? parsed.defaultLocationId : defaultSettings.defaultLocationId,
      updateAutoCheckOnStart:
        typeof parsed.updateAutoCheckOnStart === 'boolean'
          ? parsed.updateAutoCheckOnStart
          : defaultSettings.updateAutoCheckOnStart,
    }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(next: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}


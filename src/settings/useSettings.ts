import { useEffect, useMemo, useState } from 'react'
import type { AppSettings } from './settings'
import { defaultSettings, loadSettings, saveSettings } from './settings'

export function useSettings(): {
  settings: AppSettings
  setSettings: (next: AppSettings) => void
  patchSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
} {
  const [settings, setSettingsState] = useState<AppSettings>(() => loadSettings())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'app_settings_v1') return
      setSettingsState(loadSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const api = useMemo(() => {
    const setSettings = (next: AppSettings) => {
      setSettingsState(next)
      saveSettings(next)
    }
    const patchSettings = (patch: Partial<AppSettings>) => {
      setSettings({ ...settings, ...patch })
    }
    const resetSettings = () => {
      setSettings(defaultSettings)
    }
    return { setSettings, patchSettings, resetSettings }
  }, [settings])

  return { settings, ...api }
}


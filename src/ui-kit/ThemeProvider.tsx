import { createContext, useContext, useEffect, useState } from 'react'
import { loadSettings } from '../settings/settings'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme')
      return (saved === 'dark' || saved === 'light') ? saved : 'light'
    } catch {
      return 'light'
    }
  })

  // Apply Primary Color
  useEffect(() => {
    const applySettings = () => {
        const s = loadSettings()
        if (s.primaryColor) {
            document.documentElement.style.setProperty('--primary-600', s.primaryColor)
            // You might want to generate shades if needed, but for now just main color
            // Or assume the user provides a valid CSS color
        }
    }
    applySettings()

    const onStorage = (e: StorageEvent) => {
        if (e.key === 'app_settings_v1') applySettings()
    }
    window.addEventListener('storage', onStorage)
    // Also listen to custom event if settings change in same tab
    const onLocalSettingsChange = () => applySettings()
    window.addEventListener('settings_changed', onLocalSettingsChange)

    return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('settings_changed', onLocalSettingsChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

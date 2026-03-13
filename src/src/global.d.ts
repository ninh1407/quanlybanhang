export {}

declare global {
  interface Window {
    desktop?: {
      platform: string
      getHwid: () => Promise<string>
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<unknown>
      downloadUpdate: () => Promise<unknown>
      installUpdate: () => Promise<void>
      onUpdateAvailable: (cb: (info: unknown) => void) => void
      onUpdateNotAvailable: (cb: (info: unknown) => void) => void
      onUpdateProgress: (cb: (progress: unknown) => void) => void
      onUpdateDownloaded: (cb: (info: unknown) => void) => void
      onUpdateError: (cb: (err: unknown) => void) => void
    }
  }
}

export {}

declare global {
  interface Window {
    desktop?: {
      platform?: string
      getHwid?: () => Promise<string>
    }
  }
}

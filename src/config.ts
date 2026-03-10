// Cấu hình mặc định
export const DEFAULT_SERVER_IP = 'localhost'
export const SERVER_PORT = 3000
export const HTTPS_PORT = 3443
export const USE_HTTPS = true // Default to secure

// Hàm lấy địa chỉ Server
export function getServerUrl() {
  // If running in Vite dev, use env or default
  // In production (Electron), this might be hardcoded or loaded from a config file
  const protocol = USE_HTTPS ? 'https' : 'http'
  const port = USE_HTTPS ? HTTPS_PORT : SERVER_PORT
  return `${protocol}://${DEFAULT_SERVER_IP}:${port}`
}

export function getSavedIp() {
  return DEFAULT_SERVER_IP
}

export function saveServerIp(ip: string) {
  // Disabled: Không cho phép lưu IP tùy chỉnh
  console.warn('Changing server IP is disabled', ip)
}

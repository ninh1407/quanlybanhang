// Cấu hình mặc định
export const DEFAULT_SERVER_IP = '3.238.123.132'
export const SERVER_PORT = 3000

// Hàm lấy địa chỉ Server (Hardcoded)
export function getServerUrl() {
  return `http://${DEFAULT_SERVER_IP}:${SERVER_PORT}`
}

export function getSavedIp() {
  return DEFAULT_SERVER_IP
}

export function saveServerIp(ip: string) {
  // Disabled: Không cho phép lưu IP tùy chỉnh
  console.warn('Changing server IP is disabled', ip)
}

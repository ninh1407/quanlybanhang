// Cấu hình mặc định
export const DEFAULT_SERVER_IP = 'localhost'
export const SERVER_PORT = 3000
export const HTTPS_PORT = 3443
export const USE_HTTPS = false // Chuyển về false để dễ kết nối ban đầu

// Key lưu trữ
const STORAGE_KEY_SERVER_IP = 'app_server_ip'

// Hàm lấy địa chỉ IP đã lưu
export function getSavedIp() {
  return localStorage.getItem(STORAGE_KEY_SERVER_IP) || DEFAULT_SERVER_IP
}

// Hàm lưu địa chỉ IP mới
export function saveServerIp(ip: string) {
  if (!ip) {
    localStorage.removeItem(STORAGE_KEY_SERVER_IP)
  } else {
    localStorage.setItem(STORAGE_KEY_SERVER_IP, ip)
  }
}

// Hàm lấy URL Server đầy đủ
export function getServerUrl() {
  const ip = getSavedIp()
  
  // Nếu người dùng nhập full URL (có http/https), dùng luôn
  if (ip.startsWith('http://') || ip.startsWith('https://')) {
      // Loại bỏ dấu / ở cuối nếu có
      return ip.replace(/\/$/, '')
  }

  // Nếu chỉ nhập IP/Domain, tự thêm protocol và port
  const protocol = USE_HTTPS ? 'https' : 'http'
  const port = USE_HTTPS ? HTTPS_PORT : SERVER_PORT
  
  // Nếu nhập IP có port rồi (vd: 1.2.3.4:5000) thì không thêm port mặc định
  if (ip.includes(':')) {
      return `${protocol}://${ip}`
  }

  return `${protocol}://${ip}:${port}`
}

// Cấu hình mặc định
export const DEFAULT_SERVER_IP = '3.238.123.132'
export const SERVER_PORT = 3000

// Hàm lấy địa chỉ Server hiện tại (ưu tiên cấu hình từ người dùng)
export function getServerUrl() {
  // Kiểm tra xem chạy trong môi trường browser chưa
  if (typeof localStorage === 'undefined') {
    return `http://${DEFAULT_SERVER_IP}:${SERVER_PORT}`
  }
  
  const customIp = localStorage.getItem('server_ip')
  const ip = customIp || DEFAULT_SERVER_IP
  return `http://${ip}:${SERVER_PORT}`
}

export function getSavedIp() {
  if (typeof localStorage === 'undefined') return DEFAULT_SERVER_IP
  return localStorage.getItem('server_ip') || DEFAULT_SERVER_IP
}

export function saveServerIp(ip: string) {
  if (!ip || ip === DEFAULT_SERVER_IP) {
    localStorage.removeItem('server_ip')
  } else {
    localStorage.setItem('server_ip', ip)
  }
}

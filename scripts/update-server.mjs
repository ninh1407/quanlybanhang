import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

console.log('🚀 Đang cập nhật Server...')

try {
  // 1. Pull latest code
  console.log('📥 Đang tải code mới từ GitHub...')
  execSync('git pull', { stdio: 'inherit' })

  // 2. Install dependencies
  console.log('📦 Đang cài đặt thư viện mới...')
  execSync('npm install', { stdio: 'inherit' })

  // 3. Rebuild frontend (if needed)
  console.log('🏗️ Đang build lại giao diện...')
  execSync('npm run build', { stdio: 'inherit' })

  // 4. Restart server (using PM2 if available, otherwise just warn)
  console.log('🔄 Đang khởi động lại Server...')
  try {
    execSync('pm2 restart quanlykho', { stdio: 'inherit' })
    console.log('✅ Đã khởi động lại PM2.')
  } catch (e) {
    console.log('⚠️ Không tìm thấy PM2 hoặc lỗi khi restart. Nếu bạn đang chạy server thủ công, hãy tắt đi bật lại.')
  }

  console.log('🎉 Cập nhật hoàn tất!')
} catch (e) {
  console.error('❌ Lỗi khi cập nhật:', e.message)
}

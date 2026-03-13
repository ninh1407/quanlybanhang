import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

console.log('🚀 Đang cập nhật Server & Database...')

try {
  // 1. Pull latest code
  console.log('📥 1. Đang tải code mới từ GitHub...')
  execSync('git pull', { stdio: 'inherit' })

  // 2. Install dependencies
  console.log('📦 2. Đang cài đặt thư viện mới...')
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' }) // Force legacy peer deps just in case

  // Check if schema.prisma exists
  const schemaPath = path.resolve('prisma/schema.prisma')
  if (!fs.existsSync(schemaPath)) {
      console.error('❌ LỖI: Không tìm thấy file "prisma/schema.prisma"!')
      console.error('👉 Nguyên nhân: Bạn chưa push file này lên GitHub.')
      console.error('👉 Cách sửa: Tại máy tính của bạn (Local), hãy chạy "git add ." -> "git commit" -> "git push".')
      process.exit(1)
  }

  // FORCE DELETE prisma.config.ts if it exists (Fix for Prisma v7 P1012 error)
  const configPath = path.resolve('prisma.config.ts')
  if (fs.existsSync(configPath)) {
      console.log('🗑️  Đang xóa file prisma.config.ts thừa...')
      fs.unlinkSync(configPath)
  }
  
  // Also try to delete in 'prisma' folder just in case
  const configPath2 = path.resolve('prisma/prisma.config.ts')
  if (fs.existsSync(configPath2)) {
      console.log('🗑️  Đang xóa file prisma/prisma.config.ts thừa...')
      fs.unlinkSync(configPath2)
  }

  // 3. Database Setup (Prisma)
  console.log('🗄️ 3. Đang cập nhật cấu trúc Database...')
  execSync('npx prisma generate', { stdio: 'inherit' })
  execSync('npx prisma db push', { stdio: 'inherit' })

  // 4. Data Migration (JSON -> PG)
  // Only run if data.json exists to ensure we don't crash
  const dataPath = path.resolve('server/data.json')
  if (fs.existsSync(dataPath)) {
      console.log('🚚 4. Đang đồng bộ dữ liệu cũ (JSON) sang Database...')
      try {
        execSync('npm run db:migrate-data', { stdio: 'inherit' })
      } catch (e) {
          console.warn('⚠️ Cảnh báo: Lỗi khi migrate dữ liệu (có thể bỏ qua nếu đã migrate xong).')
      }
  } else {
      console.log('⏩ Bỏ qua migrate dữ liệu (không tìm thấy data.json).')
  }

  // 5. Rebuild frontend
  console.log('🏗️ 5. Đang build lại giao diện...')
  execSync('npm run build', { stdio: 'inherit' })

  // 6. Restart server
  console.log('🔄 6. Đang khởi động lại Server...')
  try {
    // Try to reload using ecosystem config
    execSync('pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs', { stdio: 'inherit' })
    console.log('✅ Server đã khởi động lại.')
  } catch (e) {
    console.log('⚠️ Không thể restart PM2 tự động. Hãy kiểm tra lại PM2.')
  }

  console.log('🎉 Cập nhật hoàn tất! Hệ thống đã sẵn sàng.')
} catch (e) {
  console.error('❌ Lỗi khi cập nhật:', e.message)
  process.exit(1)
}

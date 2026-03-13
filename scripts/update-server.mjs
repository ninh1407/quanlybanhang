import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

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

  const runPrisma = (cmd) => {
    try {
      const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' })
      if (out) process.stdout.write(out)
      return { ok: true, output: out ?? '' }
    } catch (e) {
      const stdout = e?.stdout?.toString?.() ?? ''
      const stderr = e?.stderr?.toString?.() ?? ''
      if (stdout) process.stdout.write(stdout)
      if (stderr) process.stderr.write(stderr)
      return { ok: false, output: `${stdout}\n${stderr}`.trim() }
    }
  }

  const dbPush = () => runPrisma('npx prisma db push --accept-data-loss')
  let dbPushResult = dbPush()

  if (!dbPushResult.ok) {
    const outputText = dbPushResult.output.toLowerCase()
    const looksLikeMissingTable = outputText.includes('p1014') || outputText.includes('does not exist')

    if (looksLikeMissingTable) {
      console.log('⚠️  Prisma không thể đồng bộ schema với Database hiện tại (P1014 / thiếu bảng).')
      console.log('⚠️  Giải pháp nhanh: RESET Database để tạo lại toàn bộ bảng theo schema mới (SẼ MẤT DỮ LIỆU).')

      const allowForceReset = process.env.PRISMA_FORCE_RESET === '1'
      let shouldReset = allowForceReset

      if (!allowForceReset) {
        const rl = readline.createInterface({ input, output })
        const answer = (await rl.question('👉 Bạn có muốn reset database ngay bây giờ? (yes/no): ')).trim().toLowerCase()
        rl.close()
        shouldReset = answer === 'y' || answer === 'yes'
      }

      if (!shouldReset) {
        throw new Error('Dừng cập nhật vì không reset database. Nếu muốn tự động reset, set PRISMA_FORCE_RESET=1.')
      }

      const resetResult = runPrisma('npx prisma db push --force-reset --accept-data-loss')
      if (!resetResult.ok) {
        throw new Error('Reset database thất bại. Vui lòng kiểm tra DATABASE_URL và quyền truy cập Postgres.')
      }
    } else {
      throw new Error('Prisma db push thất bại. Vui lòng kiểm tra log phía trên.')
    }
  }

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

import fs from 'fs'
import path from 'path'

const iconPath = path.resolve('build/icon.ico')
if (fs.existsSync(iconPath)) {
  process.stdout.write('✅ icon.ico đã tồn tại\n')
  process.exit(0)
}

process.stderr.write('❌ Không tìm thấy build/icon.ico\n')
process.exit(1)


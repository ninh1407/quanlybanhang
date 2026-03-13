import fs from 'node:fs/promises'

const iconPath = new URL('../build/icon.ico', import.meta.url)

try {
  await fs.access(iconPath)
} catch {
  process.stdout.write(
    '[gen:icon] Không tìm thấy build/icon.ico. Bỏ qua bước tạo icon.\n'
  )
}

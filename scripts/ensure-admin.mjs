import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

function loadDotEnvIfPresent() {
  const envPath = path.resolve('.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

async function main() {
  loadDotEnvIfPresent()

  const username = (process.env.ADMIN_USERNAME || 'admin').trim()
  const password = (process.env.ADMIN_PASSWORD || '123').trim()
  const fullName = (process.env.ADMIN_FULL_NAME || 'Quản trị (Admin)').trim()
  const resetPassword = (process.env.RESET_ADMIN_PASSWORD || '') === '1'

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { username } })
    const hash = await bcrypt.hash(password, 10)

    if (!existing) {
      await prisma.user.create({
        data: {
          username,
          password: hash,
          fullName,
          role: 'admin',
          active: true,
          allowedLocationIds: [],
          scope: 'all',
        },
      })
      process.stdout.write(`✅ Đã tạo tài khoản quản trị mặc định: ${username}\n`)
      process.stdout.write(`🔑 Mật khẩu mặc định: ${password}\n`)
      return
    }

    if (resetPassword) {
      await prisma.user.update({ where: { username }, data: { password: hash, active: true } })
      process.stdout.write(`✅ Đã reset mật khẩu cho tài khoản: ${username}\n`)
      process.stdout.write(`🔑 Mật khẩu mới: ${password}\n`)
      return
    }

    process.stdout.write(`ℹ️ Tài khoản ${username} đã tồn tại. Bỏ qua tạo mới.\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  process.stderr.write(`❌ ensure-admin lỗi: ${e?.message || e}\n`)
  process.exit(1)
})


import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const DATA_FILE = path.resolve('server/data.json')
const prisma = new PrismaClient()

async function migrate() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('Data file not found:', DATA_FILE)
    return
  }

  console.log('Reading data.json...')
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const data = JSON.parse(raw)

  console.log('Starting migration to PostgreSQL...')

  console.log(`Migrating ${data.users?.length || 0} users...`)
  for (const u of (data.users || [])) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        id: u.id,
        username: u.username,
        password: u.password,
        fullName: u.fullName || u.username,
        role: u.role,
        active: u.active ?? true,
        allowedLocationIds: u.allowedLocationIds || [],
        scope: u.scope,
        region: u.region,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
      },
    })
  }

  console.log('Migration completed!')
}

migrate()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })


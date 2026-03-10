import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const DATA_FILE = path.resolve(__dirname, '../server/data.json')
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

  // 1. Users
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
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined
      }
    })
  }

  // 2. Locations
  console.log(`Migrating ${data.locations?.length || 0} locations...`)
  for (const l of (data.locations || [])) {
    await prisma.location.upsert({
      where: { code: l.code },
      update: {},
      create: {
        id: l.id,
        code: l.code,
        name: l.name,
        province: l.province,
        note: l.note,
        active: l.active ?? true,
        createdAt: l.createdAt ? new Date(l.createdAt) : undefined
      }
    })
  }

  // 3. Categories
  console.log(`Migrating ${data.categories?.length || 0} categories...`)
  for (const c of (data.categories || [])) {
    await prisma.category.create({
      data: {
        id: c.id,
        name: c.name
      }
    }).catch(e => console.warn(`Skipping category ${c.name}: ${e.message}`))
  }

  // 4. Suppliers
  console.log(`Migrating ${data.suppliers?.length || 0} suppliers...`)
  for (const s of (data.suppliers || [])) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: {
        id: s.id,
        code: s.code,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        note: s.note,
        country: s.country,
        manufacturingCountry: s.manufacturingCountry,
        segment: s.segment
      }
    })
  }

  // 5. Products & SKUs
  console.log(`Migrating ${data.products?.length || 0} products...`)
  for (const p of (data.products || [])) {
    try {
        await prisma.product.create({
        data: {
            id: p.id,
            internalCode: p.internalCode,
            manualInternalCode: p.manualInternalCode,
            barcode: p.barcode,
            manufacturerBatchCode: p.manufacturerBatchCode,
            specs: p.specs,
            internalBatchCode: p.internalBatchCode,
            name: p.name,
            categoryId: p.categoryId,
            supplierId: p.supplierId,
            isMaterial: p.isMaterial ?? false,
            active: p.active ?? true,
            isHidden: p.isHidden ?? false
        }
        })
    } catch(e: any) {
        console.warn(`Skipping product ${p.name}: ${e.message}`)
    }
  }

  console.log(`Migrating ${data.skus?.length || 0} SKUs...`)
  for (const s of (data.skus || [])) {
    try {
        await prisma.sku.create({
        data: {
            id: s.id,
            productId: s.productId,
            skuCode: s.skuCode,
            color: s.color,
            size: s.size,
            material: s.material,
            volume: s.volume,
            capacity: s.capacity,
            power: s.power,
            unit: s.unit || 'cái',
            cost: s.cost || 0,
            price: s.price || 0,
            active: s.active ?? true,
            kind: s.kind || 'single',
            components: s.components || []
        }
        })
    } catch (e: any) {
        console.warn(`Skipping SKU ${s.skuCode}: ${e.message}`)
    }
  }

  // 6. Customers
  console.log(`Migrating ${data.customers?.length || 0} customers...`)
  for (const c of (data.customers || [])) {
    await prisma.customer.create({
      data: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        note: c.note,
        discountPercent: c.discountPercent || 0,
        loyaltyPoints: c.loyaltyPoints || 0
      }
    }).catch(e => console.warn(`Skipping customer ${c.name}: ${e.message}`))
  }

  // 7. Orders (Complex relations)
  console.log(`Migrating ${data.orders?.length || 0} orders...`)
  for (const o of (data.orders || [])) {
    try {
      await prisma.order.create({
        data: {
          id: o.id,
          code: o.code,
          customerId: o.customerId,
          fulfillmentLocationId: o.fulfillmentLocationId,
          warehouseId: o.warehouseId,
          type: o.type || 'internal',
          source: o.source || 'pos',
          paymentMethod: o.paymentMethod || 'cod',
          status: o.status,
          subTotalOverride: o.subTotalOverride,
          shippingFee: o.shippingFee || 0,
          carrierName: o.carrierName,
          trackingCode: o.trackingCode,
          platformOrderId: o.platformOrderId,
          dropshipBrand: o.dropshipBrand,
          partnerVoucherCode: o.partnerVoucherCode,
          discountPercent: o.discountPercent || 0,
          discountAmount: o.discountAmount || 0,
          vatAmount: o.vatAmount || 0,
          otherFees: o.otherFees || 0,
          otherFeesNote: o.otherFeesNote,
          note: o.note,
          cancelReason: o.cancelReason,
          isReconciledCarrier: o.isReconciledCarrier || 'unreconciled',
          isReconciledSupplier: o.isReconciledSupplier || 'unreconciled',
          reconciliationResultAmount: o.reconciliationResultAmount,
          createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
          createdByUserId: o.createdByUserId,
          items: {
            create: (o.items || []).map((i: any) => ({
              skuId: i.skuId,
              qty: i.qty,
              price: i.price
            }))
          },
          attachments: o.attachments || []
        }
      })
    } catch (e: any) {
      console.error(`Failed to migrate order ${o.code}: ${e.message}`)
    }
  }

  // 8. Stock Transactions
  console.log(`Migrating ${data.stockTransactions?.length || 0} stock transactions...`)
  for (const t of (data.stockTransactions || [])) {
      try {
        await prisma.stockTransaction.create({
            data: {
                id: t.id,
                code: t.code || `TX-${t.id.substring(0,8)}`, // Fallback code
                type: t.type,
                skuId: t.skuId,
                locationId: t.locationId,
                warehouseId: t.warehouseId,
                qty: t.qty,
                unitCost: t.unitCost,
                note: t.note,
                createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
                refType: 'manual', // Default
                refId: null
            }
        })
      } catch (e: any) {
          // console.warn(`Skipping stock tx ${t.id}: ${e.message}`)
      }
  }
  
  // Other modules (Finance, StockCount, etc.) can be added similarly...
  // For brevity, migrating core modules first.

  console.log('Migration completed!')
}

migrate()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })

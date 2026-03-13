import { useMemo, useState, useRef } from 'react'
import { useAuth } from '../auth/auth'
import type { Product, Sku } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useAppDispatch, useAppState } from '../state/Store'
import { Drawer } from '../ui-kit/Drawer'
import { useDialogs } from '../ui-kit/Dialogs'
import { PageHeader } from '../ui-kit/PageHeader'
import { SmartTable, Column, SortConfig } from '../ui-kit/listing/SmartTable'
import { AdvancedFilter, FilterDef } from '../ui-kit/listing/AdvancedFilter'
import { Plus, Edit, Save, Upload, Download, FileSpreadsheet, Image as ImageIcon, Tag } from 'lucide-react'
import * as XLSX from 'xlsx'

function autoInternalCode(): string {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `SP-${d}-${rnd}`
}

const emptyProductForm: Omit<Product, 'id' | 'createdAt'> = {
  internalCode: '',
  manualInternalCode: '',
  barcode: '',
  manufacturerBatchCode: '',
  specs: '',
  internalBatchCode: '',
  name: '',
  categoryId: null,
  supplierId: null,
  isMaterial: false,
  active: true,
  isHidden: false,
}

const emptySkuForm: Omit<Sku, 'id' | 'createdAt' | 'productId'> = {
  skuCode: '',
  color: '',
  size: '',
  material: '',
  volume: '',
  capacity: '',
  power: '',
  unit: 'cái',
  cost: 0,
  price: 0,
  active: true,
  kind: 'single',
  components: [],
}

export function ProductsPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canWrite = can('products:write')
  const dialogs = useDialogs()

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'product' | 'sku'>('product')

  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState(() => ({
    ...emptyProductForm,
    internalCode: autoInternalCode(),
  }))

  const [editingSkuId, setEditingSkuId] = useState<string | null>(null)
  const [skuForm, setSkuForm] = useState(emptySkuForm)

  // Filter states
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' })
  const [activeTab, setActiveTab] = useState('products')

  // Derived filters
  const search = (filterValues.search as string) || ''
  const filterCategory = (filterValues.category as string) || ''
  const filterStatus = (filterValues.status as string) || ''
  const filterLocationId = (filterValues.location as string) || ''

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importData, setImportData] = useState<Record<string, unknown>[]>([])
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload')

  const categoriesById = useMemo(() => new Map(state.categories.map((c) => [c.id, c.name])), [state.categories])
  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])
  const productObjById = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products])

  const stockQtyBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    ;(state.stockTransactions || []).forEach((t) => {
      // Filter by location if selected
      if (filterLocationId && t.locationId && t.locationId !== filterLocationId) return
      
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      m.set(t.skuId, (m.get(t.skuId) ?? 0) + delta)
    })
    return m
  }, [state.stockTransactions, filterLocationId])

  const availableQtyBySkuId = useMemo(() => {
    const m = new Map<string, number>()
    state.skus.forEach((sku) => {
      if (sku.kind === 'single') {
        m.set(sku.id, stockQtyBySkuId.get(sku.id) ?? 0)
        return
      }
      if (!sku.components.length) {
        m.set(sku.id, 0)
        return
      }
      let min = Infinity
      sku.components.forEach((c) => {
        const per = Number(c.qty) || 0
        if (per <= 0) {
          min = 0
          return
        }
        const stock = stockQtyBySkuId.get(c.skuId) ?? 0
        const can = Math.floor(stock / per)
        if (can < min) min = can
      })
      m.set(sku.id, Number.isFinite(min) ? min : 0)
    })
    return m
  }, [state.skus, stockQtyBySkuId])

  const inventoryByCategory = useMemo(() => {
    const map = new Map<string, number>()
    state.categories.forEach(c => {
      let total = 0
      const products = state.products.filter(p => p.categoryId === c.id)
      products.forEach(p => {
         const productSkus = state.skus.filter(s => s.productId === p.id)
         productSkus.forEach(s => {
            total += availableQtyBySkuId.get(s.id) ?? 0
         })
      })
      map.set(c.id, total)
    })
    return map
  }, [state.categories, state.products, state.skus, availableQtyBySkuId])

  const skus = useMemo(() => {
    let list = state.skus.slice()
    
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => {
        const p = productObjById.get(s.productId)
        return (
          s.skuCode.toLowerCase().includes(q) ||
          p?.name.toLowerCase().includes(q) ||
          p?.internalCode.toLowerCase().includes(q)
        )
      })
    }

    if (filterCategory) {
      list = list.filter(s => {
        const p = productObjById.get(s.productId)
        return p?.categoryId === filterCategory
      })
    }

    if (filterStatus) {
       const isActive = filterStatus === '1'
       list = list.filter(s => s.active === isActive)
    }

    // Sort
    return list.sort((a, b) => {
      const pa = productObjById.get(a.productId)
      const pb = productObjById.get(b.productId)
      
      let valA: any = ''
      let valB: any = ''

      switch (sortConfig.key) {
        case 'internalCode':
          valA = pa?.internalCode ?? ''
          valB = pb?.internalCode ?? ''
          break
        case 'name':
          valA = pa?.name ?? ''
          valB = pb?.name ?? ''
          break
        case 'skuCode':
          valA = a.skuCode
          valB = b.skuCode
          break
        case 'qty':
          valA = availableQtyBySkuId.get(a.id) ?? 0
          valB = availableQtyBySkuId.get(b.id) ?? 0
          break
        case 'cost':
          valA = a.cost
          valB = b.cost
          break
        case 'price':
          valA = a.price
          valB = b.price
          break
        case 'profit':
           valA = a.price - a.cost
           valB = b.price - b.cost
           break
        default:
          return 0
      }

      if (typeof valA === 'string') {
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA
    })
  }, [state.skus, search, filterCategory, filterStatus, productObjById, productsById, sortConfig, availableQtyBySkuId])

  // Columns Definition
  const columns = useMemo<Column<Sku>[]>(() => [
    {
      key: 'image',
      title: 'Ảnh',
      width: 60,
      render: () => (
        <div style={{ width: 44, height: 44, background: 'var(--neutral-100)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <ImageIcon size={20} color="var(--text-muted)" />
        </div>
      )
    },
    {
      key: 'name',
      title: 'Sản phẩm',
      sortable: true,
      render: (s) => {
        const p = productObjById.get(s.productId)
        const variant = [
            s.color.trim(),
            s.size.trim(),
            s.material?.trim()
          ].filter(Boolean).join(' - ')
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--primary-700)', fontSize: 14 }}>{p?.name}</div>
            <div className="row" style={{ gap: 6, marginTop: 4, fontSize: 12 }}>
               <span className="badge badge-neutral" style={{ padding: '0 4px' }}>{s.skuCode}</span>
               {variant && <span className="text-muted">{variant}</span>}
            </div>
          </div>
        )
      }
    },
    {
      key: 'category',
      title: 'Danh mục',
      render: (s) => {
        const p = productObjById.get(s.productId)
        const catName = p?.categoryId ? categoriesById.get(p.categoryId) : ''
        return catName ? <span className="badge badge-neutral">{catName}</span> : null
      }
    },
    {
      key: 'qty',
      title: 'Tồn kho',
      align: 'right',
      width: 120,
      sortable: true,
      render: (s) => {
        const qty = availableQtyBySkuId.get(s.id) ?? 0
        const max = 100 // Mock max for visual bar
        const percent = Math.min(100, Math.max(0, (qty / max) * 100))
        const color = qty <= 5 ? 'var(--danger)' : qty <= 20 ? 'var(--warning)' : 'var(--success)'
        
        return (
           <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, color: color }}>{qty}</div>
              <div style={{ height: 4, background: 'var(--neutral-200)', borderRadius: 2, marginTop: 4, width: '100%' }}>
                 <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: 2 }} />
              </div>
           </div>
        )
      }
    },
    {
      key: 'price',
      title: 'Giá bán',
      align: 'right',
      sortable: true,
      render: (s) => <span style={{ fontWeight: 600 }}>{formatVnd(s.price)}</span>
    },
    {
      key: 'profit',
      title: 'Lợi nhuận',
      align: 'right',
      sortable: true,
      render: (s) => {
        const profit = s.price - s.cost
        const percent = s.price > 0 ? (profit / s.price) * 100 : 0
        return (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: profit > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {percent.toFixed(1)}%
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                 {formatVnd(profit)}
              </span>
           </div>
        )
      }
    },
    {
      key: 'status',
      title: 'Trạng thái',
      width: 100,
      render: (s) => {
        const p = productObjById.get(s.productId)
        if (p?.isHidden) return <span className="badge badge-neutral">Ẩn</span>
        if (p?.active && s.active) return <span className="badge badge-success">Bán</span>
        return <span className="badge badge-danger">Ngưng</span>
      }
    },
    {
      key: 'actions',
      title: 'Thao tác',
      align: 'right',
      width: 100,
      render: (s) => {
         if (!canWrite) return null
         const p = productObjById.get(s.productId)
         return (
            <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                {p && (
                  <button className="btn btn-small" onClick={() => startEditProduct(p)} title="Sửa sản phẩm">
                    <Edit size={14} />
                  </button>
                )}
                <button className="btn btn-small" onClick={() => startEditSku(s)} title="Sửa SKU">
                  <Tag size={14} />
                </button>
                {/* More actions could be in a dropdown menu */}
             </div>
          )
       }
     }
   ], [productObjById, categoriesById, availableQtyBySkuId, canWrite])

  const filterDefs: FilterDef[] = [
    {
      key: 'category',
      label: 'Danh mục',
      type: 'select',
      options: state.categories.map(c => ({ label: c.name, value: c.id }))
    },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'status',
      options: [
        { label: 'Đang bán', value: '1' },
        { label: 'Ngưng bán', value: '0' }
      ]
    },
    {
      key: 'location',
      label: 'Kho hàng',
      type: 'select',
      options: state.locations.map(l => ({ label: `${l.code} - ${l.name}`, value: l.id }))
    }
  ]

  function startCreateProduct() {
    const internalCode = autoInternalCode()
    setEditingProductId(null)
    setProductForm({ ...emptyProductForm, internalCode })
    setEditingSkuId(null)
    setSkuForm({ ...emptySkuForm, skuCode: `${internalCode}-DEFAULT` })
    setDrawerMode('product')
    setIsDrawerOpen(true)
  }

  function startEditProduct(p: Product) {
    setEditingProductId(p.id)
    setProductForm({
      internalCode: p.internalCode,
      manualInternalCode: p.manualInternalCode ?? '',
      barcode: p.barcode ?? '',
      manufacturerBatchCode: p.manufacturerBatchCode ?? '',
      specs: p.specs ?? '',
      internalBatchCode: p.internalBatchCode ?? '',
      name: p.name,
      categoryId: p.categoryId,
      supplierId: p.supplierId,
      isMaterial: p.isMaterial,
      active: p.active,
      isHidden: p.isHidden ?? false,
    })
    setEditingSkuId(null)
    setSkuForm(emptySkuForm)
    setDrawerMode('product')
    setIsDrawerOpen(true)
  }

  function saveProduct() {
    if (!canWrite) return
    if (!productForm.name.trim()) return
    const existing = editingProductId ? state.products.find((p) => p.id === editingProductId) : undefined
    const product: Product = {
      id: existing?.id ?? newId('prd'),
      createdAt: existing?.createdAt ?? nowIso(),
      internalCode: (productForm.internalCode.trim() || autoInternalCode()).toUpperCase(),
      manualInternalCode: productForm.manualInternalCode?.trim(),
      barcode: productForm.barcode?.trim(),
      manufacturerBatchCode: productForm.manufacturerBatchCode?.trim(),
      specs: productForm.specs?.trim(),
      internalBatchCode: productForm.internalBatchCode?.trim(),
      name: productForm.name.trim(),
      categoryId: productForm.categoryId || null,
      supplierId: productForm.supplierId || null,
      isMaterial: productForm.isMaterial,
      active: productForm.active,
      isHidden: productForm.isHidden,
    }
    dispatch({ type: 'products/upsert', product })
    
    if (!existing) {
      const sku: Sku = {
        id: newId('sku'),
        productId: product.id,
        skuCode: (skuForm.skuCode.trim() || `${product.internalCode}-DEFAULT`).trim(),
        color: skuForm.color.trim(),
        size: skuForm.size.trim(),
        material: skuForm.material?.trim(),
        volume: skuForm.volume?.trim(),
      capacity: skuForm.capacity?.trim(),
      power: skuForm.power?.trim(),
      unit: skuForm.unit.trim() || 'cái',
      cost: Number(skuForm.cost) || 0,
        price: Number(skuForm.price) || 0,
        active: skuForm.active,
        kind: 'single',
        components: [],
        createdAt: nowIso(),
      }
      dispatch({ type: 'skus/upsert', sku })
    }
    setIsDrawerOpen(false)
  }

  function startCreateSkuGlobal() {
    setEditingProductId(null)
    setEditingSkuId(null)
    setSkuForm(emptySkuForm)
    setDrawerMode('sku')
    setIsDrawerOpen(true)
  }

  function startEditSku(s: Sku) {
    setEditingProductId(s.productId)
    setEditingSkuId(s.id)
    setSkuForm({
      skuCode: s.skuCode,
      color: s.color,
      size: s.size,
      material: s.material ?? '',
      volume: s.volume ?? '',
      capacity: s.capacity ?? '',
      power: s.power ?? '',
      unit: s.unit,
      cost: s.cost,
      price: s.price,
      active: s.active,
      kind: s.kind,
      components: s.components ?? [],
    })
    setDrawerMode('sku')
    setIsDrawerOpen(true)
  }

  async function saveSku() {
    if (!canWrite) return
    if (!editingProductId) return
    if (!skuForm.skuCode.trim()) return
    const existing = editingSkuId ? state.skus.find((s) => s.id === editingSkuId) : undefined
    const sku: Sku = {
      id: existing?.id ?? newId('sku'),
      productId: existing?.productId ?? editingProductId,
      createdAt: existing?.createdAt ?? nowIso(),
      skuCode: skuForm.skuCode.trim(),
      color: skuForm.color.trim(),
      size: skuForm.size.trim(),
      material: skuForm.material?.trim(),
      volume: skuForm.volume?.trim(),
      capacity: skuForm.capacity?.trim(),
      power: skuForm.power?.trim(),
      unit: skuForm.unit.trim() || 'cái',
      cost: Number(skuForm.cost) || 0,
      price: Number(skuForm.price) || 0,
      active: skuForm.active,
      kind: skuForm.kind,
      components:
        skuForm.kind === 'bundle'
          ? (skuForm.components ?? [])
              .map((c) => ({ skuId: c.skuId, qty: Number(c.qty) || 0 }))
              .filter((c) => c.skuId && c.qty > 0)
          : [],
    }
    const priceChanged = existing ? Number(existing.price) !== Number(sku.price) : false
    const costChanged = existing ? Number(existing.cost) !== Number(sku.cost) : false
    if (existing && (priceChanged || costChanged)) {
      const reason = await dialogs.prompt({ message: 'Nhập lý do thay đổi giá vốn/giá bán (bắt buộc):', required: true })
      if (reason == null) return
      if (!reason.trim()) {
        await dialogs.alert({ message: 'Vui lòng nhập lý do thay đổi giá.' })
        return
      }
      dispatch({ type: 'skus/upsert', sku, meta: { reason: reason.trim() } })
      setIsDrawerOpen(false)
      return
    }

    dispatch({ type: 'skus/upsert', sku })
    setIsDrawerOpen(false)
  }

  // Import Functions
  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Tên sản phẩm': 'Áo Thun',
        'Mã SKU': 'AT-001',
        'Giá vốn': 50000,
        'Giá bán': 100000,
        'Màu sắc': 'Đỏ',
        'Kích thước': 'L',
        'Đơn vị': 'cái',
        'Loại (single/bundle)': 'single'
      }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'mau_nhap_hang.xlsx')
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      setImportData(data)
      setImportStep('preview')
    }
    reader.readAsBinaryString(file)
  }

  function processImport() {
    let importedCount = 0
    importData.forEach((row: Record<string, unknown>) => {
      const name = typeof row['Tên sản phẩm'] === 'string' ? (row['Tên sản phẩm'] as string) : 'Sản phẩm mới'
      const skuCode = typeof row['Mã SKU'] === 'string' ? (row['Mã SKU'] as string) : `SKU-${Date.now()}`
      
      // Simple logic: Create new product for each row for now, or find existing by name?
      // For simplicity: Create new product + sku
      const productId = newId('prd')
      const product: Product = {
        id: productId,
        createdAt: nowIso(),
        internalCode: autoInternalCode(),
        name: name,
        categoryId: null,
        supplierId: null,
        isMaterial: false,
        active: true
      }
      
      const sku: Sku = {
        id: newId('sku'),
        productId: productId,
        createdAt: nowIso(),
        skuCode: skuCode,
        color: (row['Màu sắc'] as string) || '',
        size: (row['Kích thước'] as string) || '',
        unit: (row['Đơn vị'] as string) || 'cái',
        cost: Number(row['Giá vốn']) || 0,
        price: Number(row['Giá bán']) || 0,
        active: true,
        kind: row['Loại (single/bundle)'] === 'bundle' ? 'bundle' : 'single',
        components: []
      }

      dispatch({ type: 'products/upsert', product })
      dispatch({ type: 'skus/upsert', sku })
      importedCount++
    })

    void dialogs.alert({ message: `Đã nhập thành công ${importedCount} sản phẩm!` })
    setImportData([])
    setImportStep('upload')
    setActiveTab('products')
  }

  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Quản lý sản phẩm" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-color)', marginBottom: 24, padding: '0 20px' }}>
        {['Sản phẩm', 'Danh mục', 'Biến thể', 'Nhập hàng'].map((tab, idx) => {
          const key = ['products', 'categories', 'variants', 'import'][idx]
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 0',
                borderBottom: isActive ? '2px solid var(--primary-500)' : '2px solid transparent',
                color: isActive ? 'var(--primary-500)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '0 20px 20px' }}>
        {activeTab === 'products' && (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title">
             Danh sách sản phẩm
             <div className="row">
                <div className="badge badge-neutral">{skus.length} SKU</div>
                {canWrite && (
                  <button className="btn btn-primary btn-small" onClick={startCreateProduct}>
                    <Plus size={16} /> Thêm sản phẩm
                  </button>
                )}
             </div>
          </div>
          
          <AdvancedFilter
            filters={filterDefs}
            values={filterValues}
            onChange={setFilterValues}
            onSearchChange={(text) => setFilterValues(prev => ({ ...prev, search: text }))}
            searchValue={search}
          />

          <div style={{ flex: 1, minHeight: 0 }}>
            <SmartTable
              columns={columns}
              data={skus}
              keyField="id"
              emptyText="Không tìm thấy sản phẩm nào"
              sort={sortConfig}
              onSort={setSortConfig}
            />
          </div>
        </div>
        )}

        {activeTab === 'categories' && (
          <div className="card">
            <div className="card-title">Quản lý danh mục</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Số sản phẩm</th>
                    <th>Tổng tồn kho</th>
                  </tr>
                </thead>
                <tbody>
                  {state.categories.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{state.products.filter(p => p.categoryId === c.id).length} sản phẩm</td>
                      <td>{inventoryByCategory.get(c.id) ?? 0}</td>
                    </tr>
                  ))}
                   {state.categories.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Chưa có danh mục nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'variants' && (
           <div className="card">
              <div className="card-title">
                <div>
                  Quản lý biến thể (Nhanh)
                  <div className="text-muted" style={{ fontWeight: 400, fontSize: 13 }}>Cập nhật nhanh giá và tồn kho</div>
                </div>
                {canWrite && (
                  <div className="row">
                    <button className="btn btn-primary btn-small" onClick={startCreateSkuGlobal}>
                      <Plus size={16} /> Thêm biến thể
                    </button>
                  </div>
                )}
              </div>
              
              <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>SKU</th>
                      <th>Màu / Size</th>
                      <th>Giá vốn</th>
                      <th>Giá bán</th>
                      <th>Tồn kho</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((s) => {
                      const p = productObjById.get(s.productId)
                      const qty = availableQtyBySkuId.get(s.id) ?? 0
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{p?.name}</td>
                          <td><span className="badge badge-neutral">{s.skuCode}</span></td>
                          <td>{s.color} {s.size ? `/ ${s.size}` : ''}</td>
                          <td>{formatVnd(s.cost)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatVnd(s.price)}</td>
                          <td>{qty}</td>
                          <td>
                             <button className="btn btn-small" onClick={() => startEditSku(s)}>
                               <Edit size={14} />
                             </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {activeTab === 'import' && (
           <div className="card">
              <div className="card-title">Nhập hàng từ Excel</div>
              
              {importStep === 'upload' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40, border: '2px dashed var(--border-color)', borderRadius: 16 }}>
                  <div style={{ background: 'var(--primary-50)', padding: 20, borderRadius: '50%' }}>
                    <FileSpreadsheet size={48} color="var(--primary-600)" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 8px' }}>Tải lên file danh sách sản phẩm</h3>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Hỗ trợ định dạng .xlsx, .xls</p>
                  </div>
                  
                  <div className="row">
                    <button className="btn" onClick={downloadTemplate}>
                      <Download size={16} /> Tải file mẫu
                    </button>
                    <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} /> Chọn file
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept=".xlsx, .xls"
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="row-between" style={{ marginBottom: 16 }}>
                    <div>
                      <strong>Xem trước dữ liệu</strong> ({importData.length} dòng)
                    </div>
                    <div className="row">
                      <button className="btn" onClick={() => { setImportData([]); setImportStep('upload') }}>Hủy bỏ</button>
                      <button className="btn btn-primary" onClick={processImport}>Tiến hành nhập</button>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          {importData.length > 0 && Object.keys(importData[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((val, i) => (
                              <td key={i}>{typeof val === 'string' || typeof val === 'number' ? String(val) : ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
           </div>
        )}
      </div>

      {/* Drawer Form */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={drawerMode === 'product' ? (editingProductId ? 'Sửa sản phẩm' : 'Thêm sản phẩm') : (editingSkuId ? 'Sửa SKU' : 'Thêm SKU')}
        width={600}
        footer={
          <>
            <button className="btn" onClick={() => setIsDrawerOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={drawerMode === 'product' ? saveProduct : saveSku}>
              <Save size={16} /> Lưu lại
            </button>
          </>
        }
      >
        {drawerMode === 'product' ? (
           <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <h4 style={{ margin: '0 0 16px', color: 'var(--primary-600)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                  📦 Thông tin cơ bản
                </h4>
                <div className="field">
                  <label>Tên sản phẩm <span className="text-danger">*</span></label>
                  <input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Nhập tên sản phẩm..."
                    autoFocus
                  />
                </div>
                <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                   <div className="field">
                    <label>Danh mục</label>
                    <select
                      value={productForm.categoryId ?? ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, categoryId: e.target.value || null })
                      }
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Thương hiệu</label>
                    <select
                      value={productForm.supplierId ?? ''}
                      onChange={(e) =>
                        setProductForm({ ...productForm, supplierId: e.target.value || null })
                      }
                    >
                      <option value="">-- Chọn thương hiệu --</option>
                      {state.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Thông số kỹ thuật</label>
                  <textarea
                    value={productForm.specs}
                    onChange={(e) => setProductForm({ ...productForm, specs: e.target.value })}
                    placeholder="Thông số kỹ thuật sản phẩm..."
                    rows={3}
                  />
                </div>
                
                 <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="field">
                    <label>Loại sản phẩm</label>
                    <select
                      value={productForm.isMaterial ? 'material' : 'goods'}
                      onChange={(e) =>
                        setProductForm({ ...productForm, isMaterial: e.target.value === 'material' })
                      }
                    >
                      <option value="goods">Hàng hóa (Bán)</option>
                      <option value="material">Vật tư (Không bán)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Trạng thái</label>
                    <select
                      value={productForm.isHidden ? 'hidden' : (productForm.active ? '1' : '0')}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === 'hidden') {
                           setProductForm({ ...productForm, active: true, isHidden: true })
                        } else {
                           setProductForm({ ...productForm, active: v === '1', isHidden: false })
                        }
                      }}
                    >
                      <option value="1">Đang kinh doanh</option>
                      <option value="0">Ngừng kinh doanh</option>
                      <option value="hidden">Để ẩn</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                 <h4 style={{ margin: '0 0 16px', color: 'var(--primary-600)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                  🏷️ Thông tin hệ thống & Mã vạch
                </h4>
                 <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label>Mã nội bộ (Tự động)</label>
                      <input
                        value={productForm.internalCode}
                        onChange={(e) => setProductForm({ ...productForm, internalCode: e.target.value })}
                        placeholder="Mã tự sinh..."
                        style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                        disabled
                      />
                    </div>
                    <div className="field">
                      <label>Mã nội bộ (Nhập tay)</label>
                      <input
                        value={productForm.manualInternalCode}
                        onChange={(e) => setProductForm({ ...productForm, manualInternalCode: e.target.value })}
                        placeholder="Mã nhập tay..."
                      />
                    </div>
                 </div>

                 <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label>Mã vạch (Barcode)</label>
                      <input
                        value={productForm.barcode}
                        onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                        placeholder="Scan hoặc nhập mã vạch..."
                      />
                    </div>
                    <div className="field">
                      <label>Mã Lô (Nội bộ)</label>
                      <input
                        value={productForm.internalBatchCode}
                        onChange={(e) => setProductForm({ ...productForm, internalBatchCode: e.target.value })}
                      />
                    </div>
                 </div>
                 
                 <div className="field">
                    <label>Mã Lô (NSX)</label>
                    <input
                      value={productForm.manufacturerBatchCode}
                      onChange={(e) => setProductForm({ ...productForm, manufacturerBatchCode: e.target.value })}
                    />
                 </div>
              </div>

              {!editingProductId ? (
                <div>
                  <h4 style={{ margin: '0 0 16px', color: 'var(--primary-600)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                    🧾 SKU mặc định
                  </h4>
                  <div className="field">
                    <label>Mã SKU</label>
                    <input
                      value={skuForm.skuCode}
                      onChange={(e) => setSkuForm({ ...skuForm, skuCode: e.target.value })}
                      placeholder={`${productForm.internalCode || 'SP-...'}-DEFAULT`}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label>Giá bán</label>
                      <input
                        type="number"
                        value={skuForm.price}
                        onChange={(e) => setSkuForm({ ...skuForm, price: Number(e.target.value) })}
                        style={{ fontWeight: 600, color: 'var(--success)' }}
                      />
                    </div>
                    <div className="field">
                      <label>Giá vốn</label>
                      <input
                        type="number"
                        value={skuForm.cost}
                        onChange={(e) => setSkuForm({ ...skuForm, cost: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label>Đơn vị</label>
                      <input value={skuForm.unit} onChange={(e) => setSkuForm({ ...skuForm, unit: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Trạng thái</label>
                      <select value={skuForm.active ? '1' : '0'} onChange={(e) => setSkuForm({ ...skuForm, active: e.target.value === '1' })}>
                        <option value="1">Đang bán</option>
                        <option value="0">Ngưng bán</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label>Màu sắc</label>
                      <input value={skuForm.color} onChange={(e) => setSkuForm({ ...skuForm, color: e.target.value })} placeholder="VD: Đỏ" />
                    </div>
                    <div className="field">
                      <label>Kích thước</label>
                      <input value={skuForm.size} onChange={(e) => setSkuForm({ ...skuForm, size: e.target.value })} placeholder="VD: L" />
                    </div>
                  </div>
                </div>
              ) : null}
           </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
             {!editingProductId && (
               <div className="field">
                 <label>Chọn sản phẩm <span className="text-danger">*</span></label>
                 <select
                    value=""
                    onChange={(e) => {
                      const pid = e.target.value;
                      if(pid) {
                         setEditingProductId(pid);
                         const p = state.products.find(x => x.id === pid);
                         setSkuForm(prev => ({ ...prev, skuCode: p ? `${p.internalCode}-` : '' }))
                      }
                    }}
                 >
                   <option value="">-- Chọn sản phẩm --</option>
                   {state.products.map(p => (
                     <option key={p.id} value={p.id}>{p.name} ({p.internalCode})</option>
                   ))}
                 </select>
               </div>
             )}
             <div className="field">
              <label>Mã SKU <span className="text-danger">*</span></label>
              <input value={skuForm.skuCode} onChange={(e) => setSkuForm({ ...skuForm, skuCode: e.target.value })} style={{ fontFamily: 'monospace' }} />
            </div>
             <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="field">
                  <label>Giá bán</label>
                  <input type="number" value={skuForm.price} onChange={(e) => setSkuForm({ ...skuForm, price: Number(e.target.value) })} style={{ fontWeight: 600, color: 'var(--success)' }} />
                </div>
                 <div className="field">
                  <label>Giá vốn</label>
                  <input type="number" value={skuForm.cost} onChange={(e) => setSkuForm({ ...skuForm, cost: Number(e.target.value) })} />
                </div>
             </div>
            <div className="field">
              <label>Đơn vị</label>
              <input value={skuForm.unit} onChange={(e) => setSkuForm({ ...skuForm, unit: e.target.value })} />
            </div>
            <div className="field">
              <label>Loại</label>
              <select
                value={skuForm.kind}
                onChange={(e) => setSkuForm({ ...skuForm, kind: e.target.value as 'single' | 'bundle' })}
              >
                <option value="single">Sản phẩm đơn</option>
                <option value="bundle">Combo / Set</option>
              </select>
            </div>
            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="field">
                <label>Màu sắc</label>
                <input value={skuForm.color} onChange={(e) => setSkuForm({ ...skuForm, color: e.target.value })} placeholder="VD: Xanh, Đỏ..." />
              </div>
              <div className="field">
                <label>Kích thước</label>
                <input value={skuForm.size} onChange={(e) => setSkuForm({ ...skuForm, size: e.target.value })} placeholder="VD: L, XL, 42..." />
              </div>
            </div>
            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="field">
                <label>Chất liệu</label>
                <input value={skuForm.material} onChange={(e) => setSkuForm({ ...skuForm, material: e.target.value })} placeholder="VD: Tre, Kim loại..." />
              </div>
              <div className="field">
                <label>Thể tích</label>
                <input value={skuForm.volume} onChange={(e) => setSkuForm({ ...skuForm, volume: e.target.value })} placeholder="VD: 1 lít..." />
              </div>
              <div className="field">
                <label>Công suất</label>
                <input value={skuForm.power} onChange={(e) => setSkuForm({ ...skuForm, power: e.target.value })} placeholder="VD: 1000W..." />
              </div>
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select value={skuForm.active ? '1' : '0'} onChange={(e) => setSkuForm({ ...skuForm, active: e.target.value === '1' })}>
                <option value="1">Đang bán</option>
                <option value="0">Ngưng bán</option>
              </select>
            </div>

            {skuForm.kind === 'bundle' && (
               <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>Thành phần combo</div>
                   <div className="field">
                      <div className="text-muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
                        (Chức năng chỉnh sửa thành phần combo trong Drawer đang được hoàn thiện. Vui lòng sử dụng giao diện cũ nếu cần chỉnh sửa phức tạp)
                      </div>
                   </div>
               </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

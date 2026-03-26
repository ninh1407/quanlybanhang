import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Category } from '../../shared/types/domain'
import { nowIso } from '../../shared/lib/date'
import { newId } from '../../shared/lib/id'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { SmartTable, Column, SortConfig } from '../ui-kit/listing/SmartTable'
import { Modal } from '../ui-kit/Modal'
import { Plus, Edit, Trash2, Save, Layers, Package, Database } from 'lucide-react'
import { useDialogs } from '../ui-kit/Dialogs'

const emptyForm: Omit<Category, 'id' | 'createdAt'> = {
  name: '',
}

export function CategoriesPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canWrite = can('products:write')
  const dialogs = useDialogs()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' })

  const inventoryByCategory = useMemo(() => {
    const stockQtyBySkuId = new Map<string, number>()
    state.stockTransactions.forEach((t) => {
      const delta = t.type === 'in' ? t.qty : t.type === 'out' ? -t.qty : t.qty
      stockQtyBySkuId.set(t.skuId, (stockQtyBySkuId.get(t.skuId) ?? 0) + delta)
    })

    const map = new Map<string, number>()
    state.categories.forEach(c => {
      let total = 0
      const products = state.products.filter(p => p.categoryId === c.id)
      products.forEach(p => {
         const productSkus = state.skus.filter(s => s.productId === p.id && s.kind === 'single')
         productSkus.forEach(s => {
            total += stockQtyBySkuId.get(s.id) ?? 0
         })
      })
      map.set(c.id, total)
    })
    return map
  }, [state.categories, state.products, state.skus, state.stockTransactions])

  const categories = useMemo(() => {
    const list = state.categories.slice().sort((a: any, b: any) => {
       if (sortConfig.key === 'products') {
          const countA = state.products.filter(p => p.categoryId === a.id).length
          const countB = state.products.filter(p => p.categoryId === b.id).length
          return sortConfig.direction === 'asc' ? countA - countB : countB - countA
       }
       if (sortConfig.key === 'stock') {
          const stockA = inventoryByCategory.get(a.id) ?? 0
          const stockB = inventoryByCategory.get(b.id) ?? 0
          return sortConfig.direction === 'asc' ? stockA - stockB : stockB - stockA
       }
       return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
    return list
  }, [state.categories, sortConfig, state.products, inventoryByCategory])

  const stats = useMemo(() => {
     return {
        total: state.categories.length,
        products: state.products.filter(p => p.categoryId).length,
        stock: Array.from(inventoryByCategory.values()).reduce((a, b) => a + b, 0)
     }
  }, [state.categories, state.products, inventoryByCategory])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setForm({ name: c.name })
    setIsModalOpen(true)
  }

  function save() {
    if (!canWrite) return
    if (!form.name.trim()) return
    const existing = editingId ? state.categories.find((c) => c.id === editingId) : undefined
    const category: Category = {
      id: existing?.id ?? newId('cat'),
      createdAt: existing?.createdAt ?? nowIso(),
      name: form.name.trim(),
    }
    dispatch({ type: 'categories/upsert', category })
    setIsModalOpen(false)
  }

  async function remove(id: string) {
    if (!canWrite) return
    const ok = await dialogs.confirm({ message: 'Bạn có chắc chắn muốn xóa danh mục này?', dangerous: true })
    if (!ok) return
    dispatch({ type: 'categories/delete', id })
  }

  const columns = useMemo<Column<Category>[]>(() => [
    {
       key: 'name',
       title: 'Tên danh mục',
       sortable: true,
       render: (c) => <div style={{ fontWeight: 600 }}>{c.name}</div>
    },
    {
       key: 'products',
       title: 'Sản phẩm',
       sortable: true,
       align: 'right',
       render: (c) => state.products.filter(p => p.categoryId === c.id).length
    },
    {
       key: 'stock',
       title: 'Tồn kho',
       sortable: true,
       align: 'right',
       render: (c) => (inventoryByCategory.get(c.id) ?? 0)
    },
    {
       key: 'actions',
       title: 'Thao tác',
       align: 'right',
       width: 100,
       render: (c) => canWrite ? (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
             <button className="btn btn-small" onClick={() => startEdit(c)}><Edit size={14} /></button>
             <button className="btn btn-small text-danger" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
          </div>
       ) : null
    }
  ], [state.products, inventoryByCategory, canWrite])

  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Quản lý danh mục" />

      {/* KPI Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
               <Layers size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Tổng danh mục</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total}</div>
            </div>
         </div>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--info-50)', color: 'var(--info-600)' }}>
               <Package size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Sản phẩm đã phân loại</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.products}</div>
            </div>
         </div>
         <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-50)', color: 'var(--success-600)' }}>
               <Database size={24} />
            </div>
            <div>
               <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Tổng tồn kho theo danh mục</div>
               <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.stock}</div>
            </div>
         </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="card-title">
           Danh sách danh mục
           {canWrite && (
             <button className="btn btn-primary btn-small" onClick={startCreate}>
               <Plus size={16} /> Thêm mới
             </button>
           )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
           <SmartTable
              columns={columns}
              data={categories}
              keyField="id"
              sort={sortConfig}
              onSort={setSortConfig}
              emptyText="Chưa có danh mục nào"
           />
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Sửa danh mục' : 'Thêm danh mục mới'}
        width={400}
        footer={
          <>
            <button className="btn" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={save}>
              <Save size={16} /> Lưu lại
            </button>
          </>
        }
      >
         <div className="field">
           <label>Tên danh mục <span className="text-danger">*</span></label>
           <input value={form.name} onChange={(e) => setForm({ name: e.target.value })} placeholder="VD: Điện thoại, Laptop..." autoFocus />
         </div>
      </Modal>
    </div>
  )
}

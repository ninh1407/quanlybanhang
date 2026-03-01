import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Category } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useStore } from '../state/Store'
import { EmptyState } from '../ui-kit/EmptyState'
import { PageHeader } from '../ui-kit/PageHeader'

const emptyForm: Omit<Category, 'id' | 'createdAt'> = {
  name: '',
}

export function CategoriesPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('products:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const categories = useMemo(() => {
    return state.categories.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [state.categories])

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

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setForm({ name: c.name })
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
    startCreate()
  }

  function remove(id: string) {
    if (!canWrite) return
    dispatch({ type: 'categories/delete', id })
  }

  return (
    <div className="page">
      <PageHeader title="Danh mục sản phẩm" />

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa danh mục' : 'Thêm danh mục'}</div>
          <div className="grid-form">
            <div className="field field-span-2">
              <label>Tên danh mục</label>
              <input value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={save}>
              Lưu
            </button>
            <button className="btn" onClick={startCreate}>
              Mới
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Danh sách</div>
        {categories.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Số sản phẩm</th>
                  <th>Tổng tồn kho</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{state.products.filter(p => p.categoryId === c.id).length} sản phẩm</td>
                    <td>{inventoryByCategory.get(c.id) ?? 0}</td>
                    <td className="cell-actions">
                      {canWrite ? (
                        <>
                          <button className="btn btn-small" onClick={() => startEdit(c)}>
                            Sửa
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => remove(c.id)}>
                            Xóa
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Chưa có danh mục" hint="Tạo danh mục để dễ phân loại sản phẩm." />
        )}
      </div>
    </div>
  )
}

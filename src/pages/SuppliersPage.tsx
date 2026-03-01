import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Supplier } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useStore } from '../state/Store'
import { EmptyState } from '../ui-kit/EmptyState'
import { PageHeader } from '../ui-kit/PageHeader'

function autoSupplierCode(): string {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `NCC-${d}-${rnd}`
}

const emptyForm: Omit<Supplier, 'id' | 'createdAt'> = {
  code: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  note: '',
  country: '',
  segment: 'cheap',
}

export function SuppliersPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('products:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({ ...emptyForm, code: autoSupplierCode() }))

  const suppliers = useMemo(() => {
    return state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [state.suppliers])

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, code: autoSupplierCode() })
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id)
    setForm({
      code: s.code,
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      note: s.note,
      country: s.country || '',
      segment: s.segment || 'cheap',
    })
  }

  function save() {
    if (!canWrite) return
    if (!form.code.trim() || !form.name.trim()) return
    const existing = editingId ? state.suppliers.find((s) => s.id === editingId) : undefined
    const supplier: Supplier = {
      id: existing?.id ?? newId('sup'),
      createdAt: existing?.createdAt ?? nowIso(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      note: form.note.trim(),
      country: form.country?.trim(),
      segment: form.segment,
    }
    dispatch({ type: 'suppliers/upsert', supplier })
    startCreate()
  }

  function remove(id: string) {
    if (!canWrite) return
    dispatch({ type: 'suppliers/delete', id })
  }

  return (
    <div className="page">
      <PageHeader title="Thương hiệu" />

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa thương hiệu' : 'Thêm thương hiệu'}</div>
          <div className="grid-form">
            <div className="field">
              <label>Mã thương hiệu</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="field">
              <label>Tên thương hiệu</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Quốc gia</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="VD: Việt Nam, Nhật Bản..." />
            </div>
             <div className="field">
              <label>Phân khúc</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                <option value="cheap">Giá rẻ (Phổ thông)</option>
                <option value="mid">Trung cấp</option>
                <option value="near-high">Cận cao cấp</option>
                <option value="high">Cao cấp</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>
            <div className="field">
              <label>SĐT</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field field-span-2">
              <label>Địa chỉ</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="field field-span-2">
              <label>Ghi chú</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
        {suppliers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Quốc gia</th>
                  <th>Phân khúc</th>
                  <th>SĐT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.country}</td>
                    <td>
                       {s.segment === 'cheap' && <span className="badge badge-neutral">Phổ thông</span>}
                       {s.segment === 'mid' && <span className="badge badge-info">Trung cấp</span>}
                       {s.segment === 'near-high' && <span className="badge badge-success">Cận cao cấp</span>}
                       {s.segment === 'high' && <span className="badge badge-warning">Cao cấp</span>}
                       {s.segment === 'luxury' && <span className="badge badge-danger">Luxury</span>}
                    </td>
                    <td>{s.phone}</td>
                    <td className="cell-actions">
                      {canWrite ? (
                        <>
                          <button className="btn btn-small" onClick={() => startEdit(s)}>
                            Sửa
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => remove(s.id)}>
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
          <EmptyState title="Chưa có nhà cung cấp" hint="Tạo nhà cung cấp để quản lý nguồn hàng rõ ràng hơn." />
        )}
      </div>
    </div>
  )
}

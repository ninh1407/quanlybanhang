import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Location } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useStore } from '../state/Store'
import { EmptyState } from '../ui-kit/EmptyState'
import { PageHeader } from '../ui-kit/PageHeader'

function autoLocationCode(): string {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `LOC-${d}-${rnd}`
}

const emptyForm: Omit<Location, 'id' | 'createdAt'> = {
  code: '',
  name: '',
  note: '',
  active: true,
}

export function LocationsPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('inventory:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({ ...emptyForm, code: autoLocationCode() }))

  const locations = useMemo(() => {
    return state.locations.slice().sort((a, b) => a.code.localeCompare(b.code))
  }, [state.locations])

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, code: autoLocationCode() })
  }

  function startEdit(l: Location) {
    setEditingId(l.id)
    setForm({ code: l.code, name: l.name, note: l.note, active: l.active })
  }

  function save() {
    if (!canWrite) return
    if (!form.code.trim() || !form.name.trim()) return
    const existing = editingId ? state.locations.find((l) => l.id === editingId) : undefined
    const location: Location = {
      id: existing?.id ?? newId('loc'),
      createdAt: existing?.createdAt ?? nowIso(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      note: form.note.trim(),
      active: form.active,
    }
    dispatch({ type: 'locations/upsert', location })
    startCreate()
  }

  function remove(id: string) {
    if (!canWrite) return
    dispatch({ type: 'locations/delete', id })
  }

  return (
    <div className="page">
      <PageHeader title="Vị trí kho" />

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa vị trí' : 'Thêm vị trí'}</div>
          <div className="grid-form">
            <div className="field">
              <label>Mã</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="field">
              <label>Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                <option value="1">Hoạt động</option>
                <option value="0">Ngưng</option>
              </select>
            </div>
            <div className="field">
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
        {locations.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td>{l.code}</td>
                    <td>{l.name}</td>
                    <td>{l.active ? 'Hoạt động' : 'Ngưng'}</td>
                    <td>{l.note}</td>
                    <td className="cell-actions">
                      {canWrite ? (
                        <>
                          <button className="btn btn-small" onClick={() => startEdit(l)}>
                            Sửa
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => remove(l.id)}>
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
          <EmptyState title="Chưa có vị trí kho" hint="Tạo vị trí kho để quản lý tồn theo khu vực." />
        )}
      </div>
    </div>
  )
}

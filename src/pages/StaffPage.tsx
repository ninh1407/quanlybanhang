import { useMemo, useState } from 'react'
import bcrypt from 'bcryptjs'
import { useAuth } from '../auth/auth'
import { groupPermissions, rolePermissions } from '../domain/permissions'
import type { Location, Role, User } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'

const roles: Role[] = ['admin', 'staff']

const emptyForm: Omit<User, 'id' | 'createdAt'> = {
  username: '',
  password: '',
  fullName: '',
  role: 'staff',
  active: true,
  allowedLocationIds: [],
}

function roleLabel(role: Role): string {
  if (role === 'admin') return 'Admin'
  return 'Nhân sự'
}

export function StaffPage() {
  const { state, dispatch } = useStore()
  const { can, user: currentUser } = useAuth()
  const canWrite = can('staff:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const users = useMemo(() => {
    return state.users.slice().sort((a, b) => a.username.localeCompare(b.username))
  }, [state.users])

  const activeLocations = useMemo(() => {
    return state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code))
  }, [state.locations])

  const locationById = useMemo(() => {
    return new Map<string, Location>(state.locations.map((l) => [l.id, l]))
  }, [state.locations])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function startEdit(u: User) {
    setEditingId(u.id)
    setError('')
    setForm({
      username: u.username,
      password: '',
      fullName: u.fullName,
      role: u.role,
      active: u.active,
      allowedLocationIds: u.allowedLocationIds ?? [],
    })
  }

  function save() {
    if (!canWrite) return
    setError('')
    if (!form.username.trim() || !form.fullName.trim()) return
    if (form.role !== 'admin' && (form.allowedLocationIds ?? []).length === 0) {
      setError('Vui lòng chọn ít nhất 1 kho cho nhân sự (trừ Admin).')
      return
    }
    const existing = editingId ? state.users.find((u) => u.id === editingId) : undefined
    
    let password = form.password
    if (password) {
      password = bcrypt.hashSync(password, 10)
    } else if (existing) {
      password = existing.password
    } else {
      setError('Vui lòng nhập mật khẩu.')
      return
    }

    const next: User = {
      id: existing?.id ?? newId('usr'),
      createdAt: existing?.createdAt ?? nowIso(),
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      role: form.role,
      active: form.active,
      allowedLocationIds: (form.allowedLocationIds ?? []).slice(),
      password: password || undefined
    }
    dispatch({ type: 'users/upsert', user: next })
    startCreate()
  }

  function toggleAllowed(id: string) {
    const current = form.allowedLocationIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setForm({ ...form, allowedLocationIds: next })
  }

  function remove(id: string) {
    if (!canWrite) return
    if (currentUser?.id === id) return
    dispatch({ type: 'users/delete', id })
  }

  return (
    <div className="page">
      <PageHeader title="Phân quyền nhân sự" />

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa nhân sự' : 'Thêm nhân sự'}</div>
          {error ? (
            <div className="error" style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 12px', borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          ) : null}
          <div className="grid-form">
            <div className="field">
              <label>Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Tên đăng nhập"
              />
            </div>
            <div className="field">
              <label>Mật khẩu {editingId ? '(Để trống nếu không đổi)' : ''}</label>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'Nhập mật khẩu mới' : 'Nhập mật khẩu'}
              />
            </div>
            <div className="field">
              <label>Họ tên</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Họ và tên"
              />
            </div>
            <div className="field">
              <label>Vai trò</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select
                value={form.active ? '1' : '0'}
                onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
              >
                <option value="1">Hoạt động</option>
                <option value="0">Khóa</option>
              </select>
            </div>

            <div className="field field-span-2">
              <label>Kho được cấp</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 12 }}>
                {activeLocations.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    {activeLocations.map((l) => {
                      const checked = (form.allowedLocationIds ?? []).includes(l.id)
                      return (
                        <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAllowed(l.id)} disabled={form.role === 'admin'} />
                          <span>
                            <span style={{ fontWeight: 800 }}>{l.name}</span>
                            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{l.code}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>Chưa có kho nào.</div>
                )}
                {form.role === 'admin' ? (
                  <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                    Admin có quyền truy cập mọi kho.
                  </div>
                ) : null}
              </div>
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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Kho</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>
                    {u.role === 'admin'
                      ? 'Tất cả'
                      : (u.allowedLocationIds ?? [])
                          .map((id) => locationById.get(id)?.code ?? '')
                          .filter((x) => x)
                          .join(', ')}
                  </td>
                  <td>{u.active ? 'Hoạt động' : 'Khóa'}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td className="cell-actions">
                    {canWrite ? (
                      <>
                        <button className="btn btn-small" onClick={() => startEdit(u)}>
                          Sửa
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => remove(u.id)}
                          disabled={currentUser?.id === u.id}
                        >
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
      </div>

      <div className="card">
        <div className="card-title">Ma trận quyền</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Quyền</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r}>
                  <td>{roleLabel(r)}</td>
                  <td>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {groupPermissions(rolePermissions[r]).map((g) => (
                        <div
                          key={g.moduleKey}
                          style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}
                        >
                          <div style={{ fontWeight: 700 }}>{g.moduleLabel}</div>
                          <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {g.actions.map((a, idx) => (
                              <span key={a.code} title={a.code}>
                                {idx ? ', ' : ''}
                                {a.label} ({a.detail})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

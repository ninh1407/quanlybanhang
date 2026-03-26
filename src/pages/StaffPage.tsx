import { useMemo, useState } from 'react'
import { fetchApi } from '../api/client'
import { useAuth } from '../auth/auth'
import { groupPermissions, rolePermissions } from '../../shared/domain/permissions'
import type { Role, User } from '../../shared/types/domain'
import { newId } from '../../shared/lib/id'
import { useStore } from '../state/Store'
import { useDialogs } from '../ui-kit/Dialogs'
import { PageHeader } from '../ui-kit/PageHeader'

const roles: Role[] = ['admin', 'manager', 'region_manager', 'accountant', 'staff']

const emptyForm: Omit<User, 'id' | 'createdAt'> = {
  username: '',
  password: '',
  fullName: '',
  role: 'staff',
  active: true,
  allowedLocationIds: [],
}

function roleLabel(role: Role): string {
  if (role === 'admin') return 'Quản trị viên (Toàn quyền)'
  if (role === 'manager') return 'Quản lý tổng (Xem tất cả kho)'
  if (role === 'region_manager') return 'Quản lý vùng (Xem kho được gán)'
  if (role === 'accountant') return 'Kế toán (Xem tài chính)'
  return 'Nhân viên kho (Chỉ kho mình)'
}

export function StaffPage() {
  const { state, dispatch } = useStore()
  const { can, user: currentUser } = useAuth()
  const canWrite = can('staff:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<Role>('manager')

  const users = useMemo(() => {
    return state.users.slice().sort((a: any, b: any) => a.username.localeCompare(b.username))
  }, [state.users])

  const activeLocations = useMemo(() => {
    return state.locations.filter((l) => l.active).slice().sort((a: any, b: any) => a.code.localeCompare(b.code))
  }, [state.locations])

  const dialogs = useDialogs()

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

  async function save() {
    if (!canWrite) return
    setError('')
    if (!form.username.trim() || !form.fullName.trim()) return
    if (form.role !== 'admin' && (form.allowedLocationIds ?? []).length === 0) {
      setError('Vui lòng chọn ít nhất 1 kho cho nhân sự.')
      return
    }
    const existing = editingId ? state.users.find((u) => u.id === editingId) : undefined
    
    const payload = {
      id: existing?.id ?? newId('usr'),
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      role: form.role,
      active: form.active,
      allowedLocationIds: (form.allowedLocationIds ?? []).slice(),
      password: form.password || undefined
    }

    try {
      const savedUser = await fetchApi<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      dispatch({ type: 'users/upsert', user: savedUser })
      startCreate()
      await dialogs.alert({ message: 'Lưu nhân sự thành công.' })
    } catch (e: any) {
      setError(e.message || 'Lỗi khi lưu nhân sự')
    }
  }

  function toggleAllowed(id: string) {
    const current = form.allowedLocationIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setForm({ ...form, allowedLocationIds: next })
  }

  async function remove(id: string) {
    if (!canWrite) return
    if (currentUser?.id === id) return
    
    const ok = await dialogs.confirm({ message: 'Bạn có chắc chắn muốn xóa nhân sự này?', dangerous: true })
    if (!ok) return

    try {
      await fetchApi(`/api/users/${id}`, { method: 'DELETE' })
      dispatch({ type: 'users/delete', id })
    } catch (e: any) {
      await dialogs.alert({ message: e.message || 'Lỗi khi xóa nhân sự' })
    }
  }

  return (
    <div className="page">
      <PageHeader title="Phân quyền nhân sự" />

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24 }}>
        {/* Left: Add/Edit Form */}
        {canWrite ? (
          <div>
            <div className="card" style={{ position: 'sticky', top: 88 }}>
              <div className="card-title">{editingId ? 'Sửa nhân sự' : 'Thêm nhân sự'}</div>
              {error ? (
                <div className="error" style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              ) : null}
              
              <div className="grid-form" style={{ gap: 20 }}>
                {/* Account Group */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Tài khoản</div>
                    <div style={{ display: 'grid', gap: 12 }}>
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
                    </div>
                </div>

                <div style={{ height: 1, background: 'var(--border-color)' }}></div>

                {/* Info Group */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Thông tin</div>
                    <div style={{ display: 'grid', gap: 12 }}>
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
                    </div>
                </div>

                <div style={{ height: 1, background: 'var(--border-color)' }}></div>

                {/* Warehouse Group */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Phạm vi kho</div>
                    <div className="field">
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, maxHeight: 200, overflowY: 'auto' }}>
                        {activeLocations.length ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {activeLocations.map((l) => {
                            const checked = (form.allowedLocationIds ?? []).includes(l.id)
                            return (
                                <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleAllowed(l.id)} disabled={form.role === 'admin'} />
                                <span>
                                    <span style={{ fontWeight: 600 }}>{l.name}</span>
                                    <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 11 }}>{l.code}</span>
                                </span>
                                </label>
                            )
                            })}
                        </div>
                        ) : (
                        <div style={{ color: 'var(--text-muted)' }}>Chưa có kho nào.</div>
                        )}
                        {form.role === 'admin' ? (
                        <div style={{ marginTop: 8, color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
                            ✓ Admin có quyền truy cập tất cả kho.
                        </div>
                        ) : null}
                    </div>
                    </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 24 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
                  {editingId ? 'Cập nhật' : 'Tạo mới'}
                </button>
                <button className="btn" onClick={startCreate}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        ) : <div></div>}

        {/* Right: List & Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
                <div className="card-title">Danh sách nhân sự ({users.length})</div>
                <div className="table-wrap">
                <table className="table">
                    <thead>
                    <tr>
                        <th>Username</th>
                        <th>Họ tên</th>
                        <th>Vai trò</th>
                        <th>Kho</th>
                        <th>Trạng thái</th>
                        <th />
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u) => (
                        <tr 
                            key={u.id} 
                            onClick={() => setSelectedRoleForMatrix(u.role)}
                            style={{ cursor: 'pointer', background: selectedRoleForMatrix === u.role ? 'var(--primary-50)' : 'transparent' }}
                        >
                        <td style={{ fontWeight: 600 }}>{u.username}</td>
                        <td>{u.fullName}</td>
                        <td><span className="badge">{roleLabel(u.role).split('(')[0]}</span></td>
                        <td>
                            {['admin'].includes(u.role)
                            ? 'All'
                            : (u.allowedLocationIds ?? []).length + ' kho'}
                        </td>
                        <td>
                            {u.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Locked</span>}
                        </td>
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
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Ma trận phân quyền</span>
                    <select 
                        value={selectedRoleForMatrix} 
                        onChange={(e) => setSelectedRoleForMatrix(e.target.value as Role)}
                        style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)' }}
                    >
                        {roles.map(r => (
                            <option key={r} value={r}>{roleLabel(r).split('(')[0]}</option>
                        ))}
                    </select>
                </div>
                <div className="table-wrap">
                <table className="table">
                    <thead>
                    <tr>
                        <th>Module</th>
                        <th style={{ textAlign: 'center' }}>Xem (View)</th>
                        <th style={{ textAlign: 'center' }}>Tạo (Create)</th>
                        <th style={{ textAlign: 'center' }}>Sửa (Edit)</th>
                        <th style={{ textAlign: 'center' }}>Xóa (Delete)</th>
                    </tr>
                    </thead>
                    <tbody>
                    {groupPermissions(rolePermissions[selectedRoleForMatrix]).map((g: any) => (
                        <tr key={g.moduleKey}>
                            <td style={{ fontWeight: 600 }}>{g.moduleLabel}</td>
                            <td style={{ textAlign: 'center', color: g.actions.some((a: any) => a.code.includes(':read')) ? 'var(--success)' : 'var(--text-muted)' }}>
                                {g.actions.some((a: any) => a.code.includes(':read')) ? '✓' : '—'}
                            </td>
                            <td style={{ textAlign: 'center', color: g.actions.some((a: any) => a.code.includes(':write')) ? 'var(--success)' : 'var(--text-muted)' }}>
                                {g.actions.some((a: any) => a.code.includes(':write')) ? '✓' : '—'}
                            </td>
                            <td style={{ textAlign: 'center', color: g.actions.some((a: any) => a.code.includes(':write')) ? 'var(--success)' : 'var(--text-muted)' }}>
                                {g.actions.some((a: any) => a.code.includes(':write')) ? '✓' : '—'}
                            </td>
                            <td style={{ textAlign: 'center', color: g.actions.some((a: any) => a.code.includes(':delete')) ? 'var(--success)' : 'var(--text-muted)' }}>
                                {g.actions.some((a: any) => a.code.includes(':delete')) ? '✓' : '—'}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    * Bảng trên hiển thị quyền hạn của vai trò <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{roleLabel(selectedRoleForMatrix)}</span>.
                </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Customer, Order, OrderStatus } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { EmptyState } from '../ui-kit/EmptyState'

const emptyForm: Omit<Customer, 'id' | 'createdAt'> = {
  name: '',
  phone: '',
  email: '',
  address: '',
  note: '',
  discountPercent: 0,
}

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

function orderSubTotal(order: Order): number {
  if (order.subTotalOverride != null) return Number(order.subTotalOverride) || 0
  return order.items.reduce((acc, it) => acc + it.qty * it.price, 0)
}

function orderTotal(order: Order): number {
  return orderSubTotal(order) - (Number(order.discountAmount) || 0) + (Number(order.shippingFee) || 0)
}

function isPurchaseStatus(s: OrderStatus): boolean {
  return s === 'paid' || s === 'delivered'
}

export function CustomersPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('customers:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState<'all' | 'new' | 'old' | 'vip' | 'none'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [newDays, setNewDays] = useState<number>(30)
  const [vipSpend, setVipSpend] = useState<number>(20000000)
  const [vipOrders, setVipOrders] = useState<number>(10)

  const refMs = useMemo(() => {
    const maxOrder = Math.max(0, ...state.orders.map((o) => Date.parse(o.createdAt) || 0))
    const maxCustomer = Math.max(0, ...state.customers.map((c) => Date.parse(c.createdAt) || 0))
    return Math.max(maxOrder, maxCustomer, 0)
  }, [state.customers, state.orders])

  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, Order[]>()
    state.orders.forEach((o) => {
      if (!o.customerId) return
      const arr = map.get(o.customerId) ?? []
      arr.push(o)
      map.set(o.customerId, arr)
    })
    map.forEach((arr, k) => map.set(k, arr.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
    return map
  }, [state.orders])

  const customers = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = state.customers
      .map((c) => {
        const orders = ordersByCustomer.get(c.id) ?? []
        const purchases = orders.filter((o) => isPurchaseStatus(o.status))
        const spend = sum(purchases.map(orderTotal))
        const count = purchases.length
        const first = purchases.length ? purchases[purchases.length - 1].createdAt : null
        const last = purchases.length ? purchases[0].createdAt : null
        const daysSinceFirst = first ? (refMs - (Date.parse(first) || 0)) / 86400000 : Infinity
        const isVip = count > 0 && (spend >= Math.max(0, Number(vipSpend) || 0) || count >= Math.max(1, Number(vipOrders) || 0))
        const isNew = count > 0 && !isVip && daysSinceFirst <= Math.max(1, Number(newDays) || 1)
        const seg = count === 0 ? 'none' : isVip ? 'vip' : isNew ? 'new' : 'old'
        return { c, orders, purchases, spend, count, first, last, seg }
      })
      .filter((x) => {
        if (!query) return true
        return (
          x.c.name.toLowerCase().includes(query) ||
          x.c.phone.toLowerCase().includes(query) ||
          x.c.email.toLowerCase().includes(query)
        )
      })
      .filter((x) => (segment === 'all' ? true : x.seg === segment))
      .sort((a, b) => b.c.createdAt.localeCompare(a.c.createdAt))
    return list
  }, [newDays, ordersByCustomer, q, refMs, segment, state.customers, vipOrders, vipSpend])

  const segmentCounts = useMemo(() => {
    const counts = { new: 0, old: 0, vip: 0, none: 0 }
    customers.forEach((x) => {
      if (x.seg === 'new') counts.new += 1
      else if (x.seg === 'old') counts.old += 1
      else if (x.seg === 'vip') counts.vip += 1
      else counts.none += 1
    })
    return counts
  }, [customers])

  const selected = useMemo(() => customers.find((x) => x.c.id === selectedId) ?? null, [customers, selectedId])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function startEdit(c: Customer) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      note: c.note,
      discountPercent: c.discountPercent,
    })
  }

  function save() {
    if (!canWrite) return
    if (!form.name.trim()) return
    const existing = editingId ? state.customers.find((c) => c.id === editingId) : undefined
    const customer: Customer = {
      id: existing?.id ?? newId('cus'),
      createdAt: existing?.createdAt ?? nowIso(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      note: form.note.trim(),
      discountPercent: Math.max(0, Math.min(100, Number(form.discountPercent) || 0)),
    }
    dispatch({ type: 'customers/upsert', customer })
    startCreate()
  }

  function remove(id: string) {
    if (!canWrite) return
    dispatch({ type: 'customers/delete', id })
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="page">
      <PageHeader title="Quản lý khách hàng" />

      <div className="grid">
        <div className="stat">
          <div className="stat-label">Tổng khách</div>
          <div className="stat-value">{customers.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Khách mới</div>
          <div className="stat-value">{segmentCounts.new}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Khách cũ</div>
          <div className="stat-value">{segmentCounts.old}</div>
        </div>
        <div className="stat">
          <div className="stat-label">VIP</div>
          <div className="stat-value">{segmentCounts.vip}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Bộ lọc & phân nhóm</div>
        <div className="grid-form">
          <div className="field">
            <label>Tìm kiếm</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên / SĐT / Email" />
          </div>
          <div className="field">
            <label>Nhóm</label>
            <select value={segment} onChange={(e) => setSegment(e.target.value as typeof segment)}>
              <option value="all">Tất cả</option>
              <option value="none">Chưa mua</option>
              <option value="new">Khách mới</option>
              <option value="old">Khách cũ</option>
              <option value="vip">VIP</option>
            </select>
          </div>
          <div className="field">
            <label>Khách mới (ngày)</label>
            <input type="number" value={newDays} onChange={(e) => setNewDays(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>VIP theo chi tiêu</label>
            <input type="number" value={vipSpend} onChange={(e) => setVipSpend(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>VIP theo số đơn</label>
            <input type="number" value={vipOrders} onChange={(e) => setVipOrders(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'}</div>
          <div className="grid-form">
            <div className="field">
              <label>Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>SĐT</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Địa chỉ</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="field field-span-2">
              <label>Ghi chú</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="field">
              <label>Chiết khấu (%)</label>
              <input
                type="number"
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
              />
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
        {customers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th>Tên</th>
                  <th>SĐT</th>
                  <th>Email</th>
                  <th>Địa chỉ</th>
                  <th>CK (%)</th>
                  <th>Số đơn</th>
                  <th>Tổng mua</th>
                  <th>Lần mua cuối</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map(({ c, count, spend, last, seg }) => (
                  <tr key={c.id}>
                    <td>{seg === 'vip' ? 'VIP' : seg === 'new' ? 'Khách mới' : seg === 'old' ? 'Khách cũ' : 'Chưa mua'}</td>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.email}</td>
                    <td>{c.address}</td>
                    <td>{c.discountPercent}</td>
                    <td>{count}</td>
                    <td>{formatVnd(spend)}</td>
                    <td>{last ? formatDateTime(last) : ''}</td>
                    <td className="cell-actions">
                      <button className="btn btn-small" onClick={() => setSelectedId(c.id)}>
                        Lịch sử
                      </button>
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
          <EmptyState title="Chưa có khách hàng" hint="Thêm khách hàng mới hoặc bỏ lọc để xem dữ liệu." />
        )}
      </div>

      {selected ? (
        <div className="card">
          <div className="row row-between">
            <div className="card-title">Lịch sử mua: {selected.c.name}</div>
            <button className="btn btn-small" onClick={() => setSelectedId(null)}>
              Đóng
            </button>
          </div>
          <div className="grid">
            <div className="stat">
              <div className="stat-label">Số đơn mua</div>
              <div className="stat-value">{selected.count}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tổng chi tiêu</div>
              <div className="stat-value">{formatVnd(selected.spend)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Lần mua gần nhất</div>
              <div className="stat-value">{selected.last ? formatDateTime(selected.last) : '-'}</div>
            </div>
          </div>

          {(ordersByCustomer.get(selected.c.id) ?? []).length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Mã đơn</th>
                    <th>Trạng thái</th>
                    <th>Giá trị</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {(ordersByCustomer.get(selected.c.id) ?? []).map((o) => (
                    <tr key={o.id}>
                      <td>{formatDateTime(o.createdAt)}</td>
                      <td>{o.code}</td>
                      <td>{o.status}</td>
                      <td>{formatVnd(orderTotal(o))}</td>
                      <td>{o.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có lịch sử mua hàng" hint="Khách này chưa có đơn POS được ghi nhận." />
          )}
        </div>
      ) : null}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { Customer, Order, OrderStatus } from '../domain/types'
import { formatDateTime, nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useAppDispatch, useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { SmartTable, Column, SortConfig } from '../ui-kit/listing/SmartTable'
import { Modal } from '../ui-kit/Modal'
import { Plus, Search, Phone, Mail, MapPin, User, Edit, Trash2, Save, History } from 'lucide-react'
import { useDialogs } from '../ui-kit/Dialogs'

const emptyForm: Omit<Customer, 'id' | 'createdAt'> = {
  name: '',
  phone: '',
  email: '',
  address: '',
  note: '',
  discountPercent: 0,
  loyaltyPoints: 0,
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
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canWrite = can('customers:write')
  const dialogs = useDialogs()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState<'all' | 'new' | 'old' | 'vip' | 'none' | 'debt'>('all')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'createdAt', direction: 'desc' })

  // Config for segments
  const [newDays] = useState<number>(30)
  const [vipSpend] = useState<number>(20000000)
  const [vipOrders] = useState<number>(10)

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

  const debtByCustomer = useMemo(() => {
    const map = new Map<string, number>()
    state.debts.forEach((d) => {
      let customerId = d.partnerId
      if (!customerId) {
         const c = state.customers.find(c => c.name === d.partnerName)
         if (c) customerId = c.id
      }
      if (customerId && d.status === 'open' && d.type === 'receivable') {
        map.set(customerId, (map.get(customerId) ?? 0) + d.amount)
      }
    })
    return map
  }, [state.debts, state.customers])

  const customersData = useMemo(() => {
    return state.customers.map((c) => {
      const orders = ordersByCustomer.get(c.id) ?? []
      const purchases = orders.filter((o) => isPurchaseStatus(o.status))
      const spend = sum(purchases.map(orderTotal))
      const count = purchases.length
      const first = purchases.length ? purchases[purchases.length - 1].createdAt : null
      const last = purchases.length ? purchases[0].createdAt : null
      const daysSinceFirst = first ? (refMs - (Date.parse(first) || 0)) / 86400000 : Infinity
      const isVip = count > 0 && (spend >= Math.max(0, Number(vipSpend) || 0) || count >= Math.max(1, Number(vipOrders) || 0))
      const isNew = count > 0 && !isVip && daysSinceFirst <= Math.max(1, Number(newDays) || 1)
      const debt = debtByCustomer.get(c.id) ?? 0
      
      let seg = 'none'
      if (count === 0) seg = 'none'
      else if (isVip) seg = 'vip'
      else if (isNew) seg = 'new'
      else seg = 'old'

      return { ...c, spend, count, last, seg, debt, orders }
    })
  }, [state.customers, ordersByCustomer, debtByCustomer, refMs, vipOrders, vipSpend, newDays])

  const filteredCustomers = useMemo(() => {
    let list = customersData
    const query = q.trim().toLowerCase()
    
    if (query) {
      list = list.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
      )
    }

    if (segment !== 'all') {
      if (segment === 'debt') {
        list = list.filter(c => c.debt > 0)
      } else {
        list = list.filter(c => c.seg === segment)
      }
    }

    // Sort
    list.sort((a, b) => {
      const valA = a[sortConfig.key as keyof typeof a]
      const valB = b[sortConfig.key as keyof typeof b]
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA
      }
      return 0
    })

    return list
  }, [customersData, q, segment, sortConfig])

  const stats = useMemo(() => {
    return {
      total: customersData.length,
      new: customersData.filter(c => c.seg === 'new').length,
      vip: customersData.filter(c => c.seg === 'vip').length,
      debt: customersData.filter(c => c.debt > 0).length,
      debtTotal: sum(customersData.map(c => c.debt))
    }
  }, [customersData])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setIsModalOpen(true)
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
      loyaltyPoints: c.loyaltyPoints || 0,
    })
    setIsModalOpen(true)
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
      loyaltyPoints: existing ? (existing.loyaltyPoints || 0) : 0,
    }
    dispatch({ type: 'customers/upsert', customer })
    setIsModalOpen(false)
  }

  async function remove(id: string) {
    if (!canWrite) return
    const ok = await dialogs.confirm({ message: 'Bạn có chắc chắn muốn xóa khách hàng này?', dangerous: true })
    if (!ok) return
    dispatch({ type: 'customers/delete', id })
  }

  const columns = useMemo<Column<typeof customersData[0]>[]>(() => [
    {
      key: 'name',
      title: 'Khách hàng',
      sortable: true,
      render: (c) => (
        <div className="row">
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
            <div className="row" style={{ gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              <Phone size={10} /> {c.phone || '---'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'seg',
      title: 'Nhóm',
      render: (c) => {
        let color = 'neutral'
        let text = 'Chưa mua'
        if (c.seg === 'vip') { color = 'warning'; text = 'VIP' }
        else if (c.seg === 'new') { color = 'success'; text = 'Mới' }
        else if (c.seg === 'old') { color = 'info'; text = 'Cũ' }
        return <span className={`badge badge-${color}`}>{text}</span>
      }
    },
    {
      key: 'spend',
      title: 'Tổng chi tiêu',
      align: 'right',
      sortable: true,
      render: (c) => <span style={{ fontWeight: 500 }}>{formatVnd(c.spend)}</span>
    },
    {
      key: 'debt',
      title: 'Công nợ',
      align: 'right',
      sortable: true,
      render: (c) => c.debt > 0 ? (
        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatVnd(c.debt)}</span>
      ) : <span className="text-muted">-</span>
    },
    {
      key: 'last',
      title: 'Gần nhất',
      sortable: true,
      render: (c) => c.last ? <span className="text-muted" style={{ fontSize: 13 }}>{formatDateTime(c.last)}</span> : '-'
    },
    {
      key: 'actions',
      title: 'Thao tác',
      align: 'right',
      width: 100,
      render: (c) => (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button className="btn btn-small" onClick={() => setSelectedHistoryId(c.id)} title="Lịch sử mua hàng">
            <History size={14} />
          </button>
          {canWrite && (
            <>
              <button className="btn btn-small" onClick={() => startEdit(c)} title="Sửa">
                <Edit size={14} />
              </button>
              <button className="btn btn-small text-danger" onClick={() => remove(c.id)} title="Xóa">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )
    }
  ], [canWrite])

  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
      <PageHeader title="Quản lý khách hàng" />

      {/* KPI Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <User size={24} />
           </div>
           <div>
              <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Tổng khách hàng</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total}</div>
           </div>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-50)', color: 'var(--success-600)' }}>
              <User size={24} />
           </div>
           <div>
              <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Khách mới (Tháng)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-700)' }}>+{stats.new}</div>
           </div>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ padding: 12, borderRadius: 12, background: 'var(--warning-50)', color: 'var(--warning-600)' }}>
              <User size={24} />
           </div>
           <div>
              <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Khách hàng VIP</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning-700)' }}>{stats.vip}</div>
           </div>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', border: segment === 'debt' ? '2px solid var(--danger)' : undefined }} onClick={() => setSegment(segment === 'debt' ? 'all' : 'debt')}>
           <div style={{ padding: 12, borderRadius: 12, background: 'var(--danger-50)', color: 'var(--danger-600)' }}>
              <User size={24} />
           </div>
           <div>
              <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Khách nợ</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger-700)' }}>{stats.debt}</div>
              <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>{formatVnd(stats.debtTotal)}</div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
           <div className="row" style={{ flex: 1 }}>
              <div style={{ position: 'relative', width: 300 }}>
                 <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                 <input 
                    placeholder="Tìm tên, SĐT, Email..." 
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    style={{ paddingLeft: 34, width: '100%' }}
                 />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="text-muted" style={{ fontSize: 14 }}>Lọc:</span>
                {['all', 'new', 'vip', 'old'].map(k => (
                  <button 
                    key={k}
                    className={`btn btn-small ${segment === k ? 'btn-primary' : ''}`}
                    onClick={() => setSegment(k as any)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {k === 'all' ? 'Tất cả' : k === 'new' ? 'Mới' : k === 'vip' ? 'VIP' : 'Cũ'}
                  </button>
                ))}
              </div>
           </div>
           {canWrite && (
             <button className="btn btn-primary" onClick={startCreate}>
               <Plus size={16} /> Thêm khách hàng
             </button>
           )}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <SmartTable
            columns={columns}
            data={filteredCustomers}
            keyField="id"
            sort={sortConfig}
            onSort={setSortConfig}
            emptyText="Chưa có khách hàng nào"
          />
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
        footer={
          <>
            <button className="btn" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={save}>
              <Save size={16} /> Lưu lại
            </button>
          </>
        }
      >
        <div className="grid-form" style={{ gap: 20 }}>
          <div className="field">
            <label>Tên khách hàng <span className="text-danger">*</span></label>
            <div className="input-icon">
               <User size={16} />
               <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Nguyễn Văn A" autoFocus />
            </div>
          </div>
          <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Số điện thoại</label>
              <div className="input-icon">
                 <Phone size={16} />
                 <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0912..." />
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <div className="input-icon">
                 <Mail size={16} />
                 <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="VD: email@example.com" />
              </div>
            </div>
          </div>
          <div className="field">
            <label>Địa chỉ</label>
            <div className="input-icon">
               <MapPin size={16} />
               <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="VD: Số 10, Ngõ 5..." />
            </div>
          </div>
          <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Chiết khấu cố định (%)</label>
              <input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} />
            </div>
            {editingId && (
              <div className="field">
                <label>Điểm tích lũy</label>
                <input value={form.loyaltyPoints} disabled style={{ background: 'var(--bg-subtle)' }} />
              </div>
            )}
          </div>
          <div className="field">
             <label>Ghi chú</label>
             <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú thêm..." />
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
         open={!!selectedHistoryId}
         onClose={() => setSelectedHistoryId(null)}
         title="Lịch sử mua hàng"
      >
         {selectedHistoryId && (() => {
           const c = customersData.find(x => x.id === selectedHistoryId)
           if (!c) return null
           return (
             <div>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                   <div className="card" style={{ padding: 12, background: 'var(--bg-subtle)' }}>
                      <div className="text-muted" style={{ fontSize: 12 }}>Tổng chi tiêu</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{formatVnd(c.spend)}</div>
                   </div>
                   <div className="card" style={{ padding: 12, background: 'var(--bg-subtle)' }}>
                      <div className="text-muted" style={{ fontSize: 12 }}>Số đơn hàng</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{c.count}</div>
                   </div>
                   <div className="card" style={{ padding: 12, background: 'var(--bg-subtle)' }}>
                      <div className="text-muted" style={{ fontSize: 12 }}>Công nợ</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: c.debt > 0 ? 'var(--danger)' : 'inherit' }}>{formatVnd(c.debt)}</div>
                   </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Mã đơn</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.orders.map(o => (
                      <tr key={o.id}>
                        <td className="text-muted" style={{ fontSize: 13 }}>{formatDateTime(o.createdAt)}</td>
                        <td style={{ fontWeight: 500 }}>{o.code}</td>
                        <td><span className="badge badge-neutral">{o.status}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatVnd(orderTotal(o))}</td>
                      </tr>
                    ))}
                    {c.orders.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Chưa có đơn hàng nào</td></tr>
                    )}
                  </tbody>
                </table>
             </div>
           )
         })()}
      </Modal>
    </div>
  )
}

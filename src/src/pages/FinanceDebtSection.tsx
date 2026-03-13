import { useMemo, useState } from 'react'
import type { Debt, DebtType, FinanceTransaction, FinanceTxType, Order, OrderStatus } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { formatVnd } from '../lib/money'
import { useDialogs } from '../ui-kit/Dialogs'

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

export function isOrderReceivableStatus(s: OrderStatus): boolean {
  return s === 'confirmed' || s === 'packed' || s === 'shipped' || s === 'delivered'
}

export function FinanceDebtSection(props: {
  canWrite: boolean
  debts: Debt[]
  ordersReceivable: Order[]
  onUpsertDebt: (debt: Debt) => void
  onDeleteDebt: (id: string) => void
  onAddFinance: (tx: FinanceTransaction) => void
}) {
  const dialogs = useDialogs()
  const [type, setType] = useState<DebtType>('receivable')
  const [partnerName, setPartnerName] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [dueDate, setDueDate] = useState<string>('')
  const [note, setNote] = useState('')

  const openDebts = useMemo(
    () => props.debts.filter((d) => d.status === 'open').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [props.debts],
  )
  const settledDebts = useMemo(
    () => props.debts.filter((d) => d.status === 'settled').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [props.debts],
  )

  const summary = useMemo(() => {
    const openReceivable = sum(props.debts.filter((d) => d.status === 'open' && d.type === 'receivable').map((d) => d.amount))
    const openPayable = sum(props.debts.filter((d) => d.status === 'open' && d.type === 'payable').map((d) => d.amount))
    return { openReceivable, openPayable }
  }, [props.debts])

  function addDebt() {
    if (!props.canWrite) return
    const a = Number(amount) || 0
    if (a <= 0) return
    if (!partnerName.trim()) return
    const createdAt = nowIso()
    props.onUpsertDebt({
      id: newId('dbt'),
      code: '',
      type,
      partnerName: partnerName.trim(),
      amount: a,
      status: 'open',
      dueDate: dueDate || null,
      settledAt: null,
      note: note.trim(),
      createdAt,
    })
    setPartnerName('')
    setAmount(0)
    setDueDate('')
    setNote('')
  }

  async function settleDebt(debt: Debt, settleType: FinanceTxType) {
    if (!props.canWrite) return
    if (debt.status !== 'open') return
    const ok = await dialogs.confirm({ message: `Tất toán công nợ ${debt.code}?` })
    if (!ok) return
    const reason = await dialogs.prompt({ message: 'Nhập lý do tất toán (khuyến nghị):', initialValue: '' })
    if (reason == null) return
    const createdAt = nowIso()
    props.onUpsertDebt({ ...debt, status: 'settled', settledAt: createdAt })
    props.onAddFinance({
      id: newId('fin'),
      code: '',
      type: settleType,
      amount: Math.max(0, debt.amount),
      category: debt.type === 'receivable' ? 'Thu công nợ' : 'Chi công nợ',
      note: `${debt.type === 'receivable' ? 'Thu' : 'Chi'} công nợ ${debt.code}${reason.trim() ? ` - ${reason.trim()}` : ''}`,
      createdAt,
      refType: 'debt',
      refId: debt.id,
      attachments: [],
    })
  }

  async function deleteDebt(debt: Debt) {
    if (!props.canWrite) return
    const ok = await dialogs.confirm({ message: `Xóa công nợ ${debt.code}?`, dangerous: true })
    if (!ok) return
    props.onDeleteDebt(debt.id)
  }

  return (
    <>
      <div className="grid">
        <div className="stat">
          <div className="stat-label">Công nợ phải thu</div>
          <div className="stat-value">{formatVnd(summary.openReceivable)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Công nợ phải trả</div>
          <div className="stat-value">{formatVnd(summary.openPayable)}</div>
        </div>
      </div>

      {props.canWrite ? (
        <div className="card">
          <div className="card-title">Thêm công nợ</div>
          <div className="grid-form">
            <div className="field">
              <label>Loại</label>
              <select value={type} onChange={(e) => setType(e.target.value as DebtType)}>
                <option value="receivable">Phải thu</option>
                <option value="payable">Phải trả</option>
              </select>
            </div>
            <div className="field">
              <label>Đối tác</label>
              <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Khách hàng / NCC" />
            </div>
            <div className="field">
              <label>Số tiền</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label>Hạn</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="field field-span-2">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={addDebt}>
              Thêm
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Công nợ đang mở</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Đối tác</th>
                <th>Số tiền</th>
                <th>Hạn</th>
                <th>Ghi chú</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {openDebts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace' }}>{d.code}</td>
                  <td>{d.type === 'receivable' ? 'Phải thu' : 'Phải trả'}</td>
                  <td>{d.partnerName}</td>
                  <td>{formatVnd(d.type === 'payable' ? -d.amount : d.amount)}</td>
                  <td>{d.dueDate ?? ''}</td>
                  <td>{d.note}</td>
                  <td className="cell-actions">
                    {props.canWrite ? (
                      <>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => settleDebt(d, d.type === 'receivable' ? 'income' : 'expense')}
                        >
                          Tất toán
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => deleteDebt(d)}>
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
        <div className="card-title">Công nợ đã tất toán</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Đối tác</th>
                <th>Số tiền</th>
                <th>Tất toán</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {settledDebts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace' }}>{d.code}</td>
                  <td>{d.type === 'receivable' ? 'Phải thu' : 'Phải trả'}</td>
                  <td>{d.partnerName}</td>
                  <td>{formatVnd(d.type === 'payable' ? -d.amount : d.amount)}</td>
                  <td>{d.settledAt ?? ''}</td>
                  <td>{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}


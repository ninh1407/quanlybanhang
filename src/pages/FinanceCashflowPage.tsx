import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { exportCsv, exportXlsx } from '../lib/export'
import { formatVnd } from '../../shared/lib/money'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

function toMs(v: string): number {
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : 0
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function monthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function isoWeekKey(ms: number): string {
  const d = new Date(ms)
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${pad2(weekNo)}`
}

function rangeMs(startDate: string, endDate: string): { startMs: number; endMs: number } {
  const startMs = toMs(`${startDate}T00:00:00.000Z`)
  const endMs = toMs(`${endDate}T23:59:59.999Z`)
  return { startMs, endMs }
}

export function FinanceCashflowPage() {
  const { state } = useStore()

  const txs = useMemo(
    () => state.financeTransactions.slice().sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)),
    [state.financeTransactions],
  )

  function exportCashbook(kind: 'csv' | 'xlsx') {
    const rows = txs.map((t) => ({
      'Mã': t.code,
      'Ngày': t.createdAt,
      'Loại': t.type,
      'Số tiền': t.amount,
      'Nhóm': t.category,
      'Ghi chú': t.note,
      'Tham chiếu': `${t.refType}${t.refId ? `:${t.refId}` : ''}`,
    }))
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    if (kind === 'csv') exportCsv(`so-quy-${stamp}.csv`, rows)
    else exportXlsx(`so-quy-${stamp}.xlsx`, 'SoQuy', rows)
  }

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)
  const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')

  const cashflowRows = useMemo(() => {
    const { startMs, endMs } = rangeMs(startDate, endDate)
    const keyFn = bucket === 'day' ? dayKey : bucket === 'week' ? isoWeekKey : monthKey

    const txInRange = state.financeTransactions.filter((t) => {
      const ms = toMs(t.createdAt)
      return ms >= startMs && ms <= endMs
    })

    const cashflowByBucket = new Map<string, { in: number; out: number }>()
    txInRange.forEach((t) => {
      const ms = toMs(t.createdAt)
      const k = keyFn(ms)
      const cur = cashflowByBucket.get(k) ?? { in: 0, out: 0 }
      if (t.type === 'income') cur.in += t.amount
      else cur.out += t.amount
      cashflowByBucket.set(k, cur)
    })

    return Array.from(cashflowByBucket.entries())
      .map(([k, v]) => ({ key: k, in: v.in, out: v.out, net: v.in - v.out }))
      .sort((a: any, b: any) => a.key.localeCompare(b.key))
  }, [bucket, endDate, startDate, state.financeTransactions])

  const totals = useMemo(() => {
    const income = sum(cashflowRows.map((r) => r.in))
    const expense = sum(cashflowRows.map((r) => r.out))
    return { income, expense, net: income - expense }
  }, [cashflowRows])

  return (
    <div className="page">
      <PageHeader
        title="Dòng tiền"
        actions={
          <>
            <button className="btn" onClick={() => exportCashbook('xlsx')}>
              Xuất sổ quỹ Excel
            </button>
            <button className="btn" onClick={() => exportCashbook('csv')}>
              Xuất sổ quỹ CSV
            </button>
            <NavLink to="/finance/overview" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : ''}`}>
              Tổng quan
            </NavLink>
            <NavLink to="/finance/cashflow" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : ''}`}>
              Dòng tiền
            </NavLink>
            <NavLink to="/finance/debts" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : ''}`}>
              Công nợ
            </NavLink>
          </>
        }
      />

      <div className="card">
        <div className="card-title">Bộ lọc kỳ</div>
        <div className="grid-form">
          <div className="field">
            <label>Từ ngày</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Đến ngày</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Gom theo</label>
            <select value={bucket} onChange={(e) => setBucket(e.target.value as 'day' | 'week' | 'month')}>
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="stat">
          <div className="stat-label">Tiền vào</div>
          <div className="stat-value">{formatVnd(totals.income)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tiền ra</div>
          <div className="stat-value">{formatVnd(-totals.expense)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Ròng</div>
          <div className="stat-value">{formatVnd(totals.net)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Báo cáo dòng tiền (theo sổ quỹ)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Tiền vào</th>
                <th>Tiền ra</th>
                <th>Ròng</th>
              </tr>
            </thead>
            <tbody>
              {cashflowRows.map((r) => (
                <tr key={r.key}>
                  <td>{r.key}</td>
                  <td>{formatVnd(r.in)}</td>
                  <td>{formatVnd(-r.out)}</td>
                  <td>{formatVnd(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}


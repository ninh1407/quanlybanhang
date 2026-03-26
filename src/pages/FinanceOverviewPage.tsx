import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { getAverageCost } from '../domain/cost'
import { X, Paperclip } from 'lucide-react'
import { validateAttachmentFiles } from '../lib/attachments'
import type { FinanceAttachment, FinanceAttachmentType, FinanceTxType, OrderStatus, Sku } from '../../shared/types/domain'
import { formatDateTime, nowIso } from '../../shared/lib/date'
import { newId } from '../../shared/lib/id'
import { formatVnd } from '../../shared/lib/money'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { FilterBar } from '../ui-kit/FilterBar'
import { EmptyState } from '../ui-kit/EmptyState'
import { LoadingState } from '../ui-kit/LoadingState'
import { useSettings } from '../settings/useSettings'
import { useDialogs } from '../ui-kit/Dialogs'


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

function isOrderReceivableStatus(s: OrderStatus): boolean {
  return s === 'confirmed' || s === 'packed' || s === 'shipped' || s === 'delivered'
}

export function FinanceOverviewPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('finance:write')
  const { settings } = useSettings()
  const dialogs = useDialogs()
  
  const txs = useMemo(
    () => state.financeTransactions.slice().sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)),
    [state.financeTransactions],
  )

  const [type, setType] = useState<FinanceTxType>('income')
  const [amount, setAmount] = useState<number>(0)
  const [category, setCategory] = useState('Khác')
  const [note, setNote] = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)
  const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')

  const report = useMemo(() => {
    const { startMs, endMs } = rangeMs(startDate, endDate)
    const keyFn = bucket === 'day' ? dayKey : bucket === 'week' ? isoWeekKey : monthKey

    const txInRange = state.financeTransactions.filter((t) => {
      const ms = toMs(t.createdAt)
      return ms >= startMs && ms <= endMs
    })
    const incomeTx = txInRange.filter((t) => t.type === 'income')
    const expenseTx = txInRange.filter((t) => t.type === 'expense')

    const income = sum(incomeTx.map((t) => t.amount))
    const expense = sum(expenseTx.map((t) => t.amount))

    const revenueByCategory = new Map<string, number>()
    incomeTx.forEach((t) => {
      const k = t.category || 'Khác'
      revenueByCategory.set(k, (revenueByCategory.get(k) ?? 0) + t.amount)
    })

    const expenseByCategory = new Map<string, number>()
    expenseTx.forEach((t) => {
      const k = t.category || 'Khác'
      expenseByCategory.set(k, (expenseByCategory.get(k) ?? 0) + t.amount)
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

    const ordersInRange = state.orders.filter((o) => {
      const ms = toMs(o.createdAt)
      return ms >= startMs && ms <= endMs
    })

    const skusById = new Map<string, Sku>(state.skus.map((s) => [s.id, s]))
    const avgCostBySku = new Map<string, number>()
    state.skus.forEach((s) => {
      avgCostBySku.set(s.id, getAverageCost(state.stockTransactions, s.id))
    })

    function expandToSingles(sku: Sku | undefined, qty: number, depth = 0): Array<{ skuId: string; qty: number }> {
      if (!sku) return []
      if (depth > 4) return []
      if (sku.kind === 'single') return [{ skuId: sku.id, qty }]
      return sku.components
        .flatMap((c) => {
          const q = qty * (Number(c.qty) || 0)
          const child = skusById.get(c.skuId)
          return expandToSingles(child, q, depth + 1)
        })
        .filter((x) => x.skuId && x.qty > 0)
    }

    const shippingExpense = sum(
      ordersInRange
        .filter((o) => o.status !== 'draft' && o.status !== 'cancelled')
        .map((o) => Math.max(0, Number(o.shippingFee) || 0)),
    )

    const purchaseExpense = sum(
      state.stockTransactions
        .filter((t) => t.type === 'in' && t.unitCost != null)
        .filter((t) => {
          const ms = toMs(t.createdAt)
          return ms >= startMs && ms <= endMs
        })
        .map((t) => (Number(t.unitCost) || 0) * (Number(t.qty) || 0)),
    )

    const cogs = sum(
      ordersInRange
        .filter((o) => o.status === 'paid' || o.status === 'delivered')
        .flatMap((o) => o.items)
        .flatMap((it) => {
          const sku = skusById.get(it.skuId)
          return expandToSingles(sku, Number(it.qty) || 0)
        })
        .map((x) => (avgCostBySku.get(x.skuId) ?? 0) * x.qty),
    )

    const netProfit = income - expense - cogs - shippingExpense
    const tax = Math.max(0, netProfit) * (Math.max(0, Math.min(100, settings.taxRatePercent)) / 100)
    
    // Calculate tax paid (filter expenses with category related to Tax)
    const taxPaid = sum(
      expenseTx
        .filter((t) => {
          const c = (t.category || '').toLowerCase().trim()
          return c === 'thuế' || c === 'tax' || c === 'nộp thuế' || c === 'vat'
        })
        .map((t) => t.amount),
    )
    const taxRemaining = tax - taxPaid

    const profitAfterTax = netProfit - tax

    return {
      income,
      expense,
      revenueByCategory,
      expenseByCategory,
      cashflowByBucket,
      shippingExpense,
      purchaseExpense,
      cogs,
      netProfit,
      tax,
      taxPaid,
      taxRemaining,
      profitAfterTax,
    }
  }, [bucket, endDate, startDate, state, settings.taxRatePercent])

  const debtsSummary = useMemo(() => {
    const openReceivable = sum(state.debts.filter((d) => d.status === 'open' && d.type === 'receivable').map((d) => d.amount))
    const openPayable = sum(state.debts.filter((d) => d.status === 'open' && d.type === 'payable').map((d) => d.amount))
    return { openReceivable, openPayable }
  }, [state.debts])

  const revenueCategoryRows = useMemo(() => {
    return Array.from(report.revenueByCategory.entries())
      .map(([k, v]) => ({ category: k, amount: v }))
      .sort((a: any, b: any) => b.amount - a.amount)
  }, [report.revenueByCategory])

  const expenseCategoryRows = useMemo(() => {
    return Array.from(report.expenseByCategory.entries())
      .map(([k, v]) => ({ category: k, amount: v }))
      .sort((a: any, b: any) => b.amount - a.amount)
  }, [report.expenseByCategory])

  async function addTx() {
    if (!canWrite) return
    const a = Number(amount) || 0
    if (a <= 0) return

    const createdAt = nowIso()
    
    // Upload attachments
    const attachments: FinanceAttachment[] = []
    if (attachmentFiles.length > 0) {
       const validated = validateAttachmentFiles(attachmentFiles)
       if (!validated.ok) {
          void dialogs.alert({ message: validated.error })
          return
       }

       const readers = attachmentFiles.map(f => new Promise<FinanceAttachment | null>(resolve => {
          const r = new FileReader()
          r.onload = () => {
             const dataUrl = typeof r.result === 'string' ? r.result : ''
             if (!dataUrl) return resolve(null)
             // Auto-detect type based on category or default to 'other'
             let type: FinanceAttachmentType = 'other'
             const c = category.toLowerCase().trim()
             if (c.includes('thuế') || c.includes('tax') || c.includes('vat')) type = 'vat'
             else if (c.includes('lương') || c.includes('hợp đồng')) type = 'contract'
             else if (c.includes('phiếu') || c.includes('kho')) type = 'voucher'

             resolve({
                id: newId('att'),
                type,
                name: f.name,
                dataUrl,
                createdAt
             })
          }
          r.onerror = () => resolve(null)
          r.readAsDataURL(f)
       }))
       const results = await Promise.all(readers)
       attachments.push(...(results.filter(Boolean) as FinanceAttachment[]))
    }

    dispatch({
      type: 'finance/add',
      tx: {
        id: newId('fin'),
        code: '',
        type,
        amount: a,
        category: category.trim() || 'Khác',
        note: note.trim(),
        createdAt,
        refType: 'manual',
        refId: null,
        attachments,
      },
    })
    setAmount(0)
    setNote('')
    setAttachmentFiles([])
  }

  const orderReceivables = useMemo(() => {
    return state.orders.filter((o) => isOrderReceivableStatus(o.status)).slice().sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
  }, [state.orders])

  const cashbookRows = useMemo(() => txs.slice(0, 400), [txs])

  const isLikelyLoading =
    state.currentUserId !== null &&
    state.locations.length === 0 &&
    state.users.length === 0 &&
    state.products.length === 0 &&
    state.skus.length === 0 &&
    state.orders.length === 0

  return (
    <div className="page">
      <PageHeader
        title="Tổng quan tài chính"
        actions={
          <>
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

      <FilterBar
        left={
          <>
            <div className="field" style={{ minWidth: 180 }}>
              <label>Từ ngày</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <label>Đến ngày</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label>Gom theo</label>
              <select value={bucket} onChange={(e) => setBucket(e.target.value as 'day' | 'week' | 'month')}>
                <option value="day">Ngày</option>
                <option value="week">Tuần</option>
                <option value="month">Tháng</option>
              </select>
            </div>
          </>
        }
        right={
          <button className="btn btn-outline btn-small" onClick={() => { setStartDate(defaultStart); setEndDate(today); setBucket('day') }}>
            Reset
          </button>
        }
      />

      {isLikelyLoading ? (
        <LoadingState title="Đang tải dữ liệu tài chính..." rows={7} />
      ) : state.orders.length === 0 && state.financeTransactions.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu tài chính" hint="Tạo đơn hàng hoặc ghi nhận giao dịch để bắt đầu." />
      ) : null}

      <div className="grid">
        <div className="stat">
          <div className="stat-label">Doanh thu</div>
          <div className="stat-value">{formatVnd(report.income)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Chi phí (sổ quỹ)</div>
          <div className="stat-value">{formatVnd(report.expense)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Giá vốn (ước tính)</div>
          <div className="stat-value">{formatVnd(report.cogs)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Phí vận chuyển (ước tính)</div>
          <div className="stat-value">{formatVnd(report.shippingExpense)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Lợi nhuận ròng</div>
          <div className="stat-value">{formatVnd(report.netProfit)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Thuế cuối kỳ ({settings.taxRatePercent}%)</div>
          <div className="stat-value">{formatVnd(report.tax)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Đã nộp thuế (Hóa đơn)</div>
          <div className="stat-value">{formatVnd(report.taxPaid)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Còn lại trong hũ</div>
          <div className="stat-value" style={{ color: report.taxRemaining < 0 ? 'var(--danger)' : undefined }}>
            {formatVnd(report.taxRemaining)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">LN sau thuế</div>
          <div className="stat-value">{formatVnd(report.profitAfterTax)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Công nợ phải thu</div>
          <div className="stat-value">{formatVnd(debtsSummary.openReceivable)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Công nợ phải trả</div>
          <div className="stat-value">{formatVnd(debtsSummary.openPayable)}</div>
        </div>
      </div>

      {canWrite ? (
        <div className="card">
          <div className="card-title">Thêm giao dịch</div>
          <div className="grid-form">
            <div className="field">
              <label>Loại</label>
              <select value={type} onChange={(e) => setType(e.target.value as FinanceTxType)}>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
              </select>
            </div>
            <div className="field">
              <label>Số tiền</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label>Nhóm</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field">
               <label>Đính kèm (Hóa đơn/Chứng từ)</label>
               <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="btn btn-small">
                     <Paperclip size={14} /> Chọn file
                     <input 
                        type="file" 
                        multiple 
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => {
                           if (e.target.files) {
                              setAttachmentFiles(prev => [...prev, ...Array.from(e.target.files!)])
                              e.target.value = ''
                           }
                        }}
                     />
                  </label>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                     {attachmentFiles.length} file
                  </div>
               </div>
               {attachmentFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                     {attachmentFiles.map((f, i) => (
                        <div key={i} className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                           {f.name}
                           <X 
                              size={12} 
                              style={{ cursor: 'pointer' }} 
                              onClick={() => setAttachmentFiles(prev => prev.filter((_, idx) => idx !== i))}
                           />
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={addTx}>
              Thêm
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Doanh thu theo danh mục</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Danh mục</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {revenueCategoryRows.map((r) => (
                <tr key={r.category}>
                  <td>{r.category}</td>
                  <td>{formatVnd(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Chi phí theo danh mục</div>
        <div className="row">
          <div className="stat" style={{ minWidth: 240 }}>
            <div className="stat-label">Giá nhập (từ phiếu nhập)</div>
            <div className="stat-value">{formatVnd(report.purchaseExpense)}</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Danh mục</th>
                <th>Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {expenseCategoryRows.map((r) => (
                <tr key={r.category}>
                  <td>{r.category}</td>
                  <td>{formatVnd(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Lịch sử (sổ quỹ)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Số tiền</th>
                <th>Nhóm</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {cashbookRows.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace' }}>{t.code}</td>
                  <td>{formatDateTime(t.createdAt)}</td>
                  <td>{t.type === 'income' ? 'Thu' : 'Chi'}</td>
                  <td>{formatVnd(t.type === 'expense' ? -t.amount : t.amount)}</td>
                  <td>{t.category}</td>
                  <td>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Đơn đang ghi nhận phải thu</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {orderReceivables.slice(0, 200).map((o) => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'monospace' }}>{o.code}</td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>{o.status}</td>
                  <td>{o.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


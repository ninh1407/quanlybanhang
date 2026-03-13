import { NavLink } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../auth/auth'
import { exportCsv, exportXlsx } from '../lib/export'
import { useStore } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { FinanceDebtSection, isOrderReceivableStatus } from './FinanceDebtSection'

export function FinanceDebtsPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('finance:write')

  const ordersReceivable = useMemo(() => {
    return state.orders.filter((o) => isOrderReceivableStatus(o.status)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state.orders])

  function exportDebts(kind: 'csv' | 'xlsx') {
    const rows = state.debts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => ({
        'Mã': d.code,
        'Ngày tạo': d.createdAt,
        'Loại': d.type,
        'Đối tác': d.partnerName,
        'Số tiền': d.amount,
        'Trạng thái': d.status,
        'Hạn': d.dueDate ?? '',
        'Tất toán': d.settledAt ?? '',
        'Ghi chú': d.note,
      }))
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    if (kind === 'csv') exportCsv(`cong-no-${stamp}.csv`, rows)
    else exportXlsx(`cong-no-${stamp}.xlsx`, 'CongNo', rows)
  }

  return (
    <div className="page">
      <PageHeader
        title="Công nợ"
        actions={
          <>
            <button className="btn" onClick={() => exportDebts('xlsx')}>
              Xuất công nợ Excel
            </button>
            <button className="btn" onClick={() => exportDebts('csv')}>
              Xuất công nợ CSV
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

      <FinanceDebtSection
        canWrite={canWrite}
        debts={state.debts}
        ordersReceivable={ordersReceivable}
        onUpsertDebt={(debt) => dispatch({ type: 'debts/upsert', debt })}
        onDeleteDebt={(id) => dispatch({ type: 'debts/delete', id })}
        onAddFinance={(tx) => dispatch({ type: 'finance/add', tx })}
      />
    </div>
  )
}


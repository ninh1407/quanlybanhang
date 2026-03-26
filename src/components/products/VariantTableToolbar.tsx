import { Edit3, Filter, Wand2 } from 'lucide-react'

import type { VariantStatusFilter, VariantStockFlag } from './types'

type IssueFilter = 'all' | 'has_issue' | 'missing_sku' | 'duplicate_sku' | 'missing_price' | 'missing_cost'

export function VariantTableToolbar(props: {
  filteredCount: number
  selectedCount: number
  query: string
  onChangeQuery: (v: string) => void
  status: VariantStatusFilter
  onChangeStatus: (v: VariantStatusFilter) => void
  stockFlag: VariantStockFlag
  onChangeStockFlag: (v: VariantStockFlag) => void
  issue: IssueFilter
  onChangeIssue: (v: IssueFilter) => void
  onOpenBulk: () => void
  onRegenerateSkuCodes: () => void
  onSelectIssues: () => void
}) {
  const {
    filteredCount,
    selectedCount,
    query,
    onChangeQuery,
    status,
    onChangeStatus,
    stockFlag,
    onChangeStockFlag,
    issue,
    onChangeIssue,
    onOpenBulk,
    onRegenerateSkuCodes,
    onSelectIssues,
  } = props

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>4) Danh sách biến thể</div>
          <span className="badge badge-neutral">{filteredCount} dòng</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={onOpenBulk} disabled={!selectedCount}>
            <Edit3 size={16} /> Sửa hàng loạt
          </button>
          <button type="button" className="btn" onClick={onRegenerateSkuCodes} disabled={!selectedCount}>
            <Wand2 size={16} /> Tạo lại skuCode
          </button>
          <button type="button" className="btn" onClick={onSelectIssues} disabled={filteredCount === 0}>
            Chọn dòng lỗi
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--bg-subtle)' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <Filter size={16} />
            <input
              className="input-compact"
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Tìm skuCode / màu / size..."
              style={{ minWidth: 240 }}
            />
          </div>
          <select className="input-compact" value={status} onChange={(e) => onChangeStatus(e.target.value as VariantStatusFilter)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngưng bán</option>
          </select>
          <select className="input-compact" value={stockFlag} onChange={(e) => onChangeStockFlag(e.target.value as VariantStockFlag)}>
            <option value="all">Tất cả tồn</option>
            <option value="in_stock">Còn hàng</option>
            <option value="low_stock">Tồn thấp (≤5)</option>
            <option value="out_of_stock">Hết hàng</option>
          </select>
          <select className="input-compact" value={issue} onChange={(e) => onChangeIssue(e.target.value as IssueFilter)}>
            <option value="all">Tất cả cảnh báo</option>
            <option value="has_issue">Có cảnh báo</option>
            <option value="missing_sku">Thiếu skuCode</option>
            <option value="duplicate_sku">Trùng skuCode</option>
            <option value="missing_price">Thiếu giá bán</option>
            <option value="missing_cost">Thiếu giá vốn</option>
          </select>
        </div>
      </div>
    </>
  )
}


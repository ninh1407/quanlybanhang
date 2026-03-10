
import { useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2 } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { Pagination } from './Pagination'

export type Column<T> = {
  key: string
  title: string
  render?: (item: T) => React.ReactNode
  width?: number | string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: 'left' | 'right'
}

export type SortConfig = {
  key: string
  direction: 'asc' | 'desc'
}

interface SmartTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  isLoading?: boolean
  selection?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
  sort?: SortConfig
  onSort?: (sort: SortConfig) => void
  pagination?: {
    page: number
    pageSize: number
    total: number
    onChangePage: (page: number) => void
    onChangePageSize?: (size: number) => void
  }
  emptyText?: string
  onRowClick?: (item: T) => void
}

export function SmartTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  isLoading,
  selection,
  onSelectionChange,
  sort,
  onSort,
  pagination,
  emptyText = 'Không có dữ liệu',
  onRowClick,
}: SmartTableProps<T>) {
  const [internalSelection, setInternalSelection] = useState<string[]>([])
  
  const selectedIds = selection ?? internalSelection
  const handleSelectionChange = onSelectionChange ?? setInternalSelection

  const allSelected = data.length > 0 && data.every((item) => selectedIds.includes(item[keyField]))
  const indeterminate = data.some((item) => selectedIds.includes(item[keyField])) && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      handleSelectionChange([])
    } else {
      handleSelectionChange(data.map((item) => item[keyField]))
    }
  }

  const toggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      handleSelectionChange(selectedIds.filter((i) => i !== id))
    } else {
      handleSelectionChange([...selectedIds, id])
    }
  }

  const handleSort = (key: string) => {
    if (!onSort) return
    if (sort?.key === key) {
      if (sort.direction === 'asc') {
        onSort({ key, direction: 'desc' })
      } else {
        onSort({ key, direction: 'asc' }) // Or undefined to clear? Let's stick to toggle
      }
    } else {
      onSort({ key, direction: 'asc' })
    }
  }

  return (
    <div className="smart-table-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="table-wrap" style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)' }}>
            <tr>
              {onSelectionChange && (
                <th style={{ width: 40, padding: '0 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = indeterminate
                    }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    textAlign: col.align ?? 'left',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    padding: '12px 16px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 13,
                    borderBottom: '1px solid var(--border-color)',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'center' ? 'center' : col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                    {col.title}
                    {col.sortable && (
                      <span style={{ display: 'flex', flexDirection: 'column', width: 14 }}>
                        {sort?.key === col.key ? (
                          sort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronsUpDown size={14} style={{ color: 'var(--border-color)' }} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
               <tr>
                 <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} style={{ padding: 40, textAlign: 'center' }}>
                   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, color: 'var(--text-secondary)' }}>
                     <Loader2 className="animate-spin" size={24} />
                     <span>Đang tải dữ liệu...</span>
                   </div>
                 </td>
               </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectionChange ? 1 : 0)}>
                   <EmptyState title={emptyText} />
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = item[keyField]
                const isSelected = selectedIds.includes(id)
                return (
                  <tr 
                    key={String(id)} 
                    className={isSelected ? 'selected' : ''}
                    style={{ 
                      cursor: onRowClick ? 'pointer' : 'default',
                      background: isSelected ? 'var(--primary-50)' : undefined
                    }}
                    onClick={() => onRowClick?.(item)}
                  >
                    {onSelectionChange && (
                      <td style={{ textAlign: 'center', width: 40 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td 
                        key={col.key} 
                        style={{ 
                          textAlign: col.align ?? 'left',
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: 14
                        }}
                      >
                        {col.render ? col.render(item) : item[col.key]}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {pagination && (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.total}
            onChangePage={pagination.onChangePage}
            onChangePageSize={pagination.onChangePageSize}
          />
        </div>
      )}
    </div>
  )
}

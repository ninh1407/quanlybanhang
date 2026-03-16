
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
    <div className="smart-table">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {onSelectionChange && (
                <th style={{ width: 40, textAlign: 'center' }}>
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
                  className={col.sortable ? 'sortable' : undefined}
                  style={{
                    width: col.width,
                    textAlign: col.align ?? 'left',
                    whiteSpace: 'nowrap',
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
                    className={`${isSelected ? 'selected' : ''}${onRowClick ? ' clickable' : ''}`}
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
        <div className="smart-table-footer">
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

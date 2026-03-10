
import { useState } from 'react'
import { Filter, X, Search } from 'lucide-react'

export type FilterType = 'select' | 'text' | 'date-range' | 'status'

export type FilterConfigOption = {
  label: string
  value: string | number
  color?: string
}

export type FilterDef = {
  key: string
  label: string
  type: FilterType
  options?: FilterConfigOption[]
  placeholder?: string
}

interface AdvancedFilterProps {
  filters: FilterDef[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  onSearchChange?: (text: string) => void
  searchValue?: string
  placeholder?: string
}

export function AdvancedFilter({
  filters,
  values,
  onChange,
  onSearchChange,
  searchValue,
  placeholder = 'Tìm kiếm...',
}: AdvancedFilterProps) {
  const [expanded, setExpanded] = useState(false)

  const activeFiltersCount = Object.keys(values).filter((k) => values[k]).length

  const handleFilterChange = (key: string, val: any) => {
    const newValues = { ...values }
    if (val === '' || val === null || val === undefined) {
      delete newValues[key]
    } else {
      newValues[key] = val
    }
    onChange(newValues)
  }

  const clearAll = () => {
    onChange({})
    if (onSearchChange) onSearchChange('')
  }

  return (
    <div className="advanced-filter" style={{ marginBottom: 16 }}>
      {/* Top Bar: Search + Quick Filters + Toggle */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        {/* Search Box */}
        {onSearchChange && (
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              style={{ paddingLeft: 36, width: '100%' }}
            />
            <Search
              size={18}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
          </div>
        )}

        {/* Primary Filters (Always Visible - First 2) */}
        {filters.slice(0, 2).map((f) => (
          <div key={f.key} style={{ minWidth: 150 }}>
            <select
              value={values[f.key] || ''}
              onChange={(e) => handleFilterChange(f.key, e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">{f.label}</option>
              {f.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Toggle Advanced */}
        {filters.length > 2 && (
          <button
            className={`btn ${expanded ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setExpanded(!expanded)}
            style={{ gap: 6 }}
          >
            <Filter size={16} />
            Bộ lọc
            {activeFiltersCount > 0 && <span className="badge badge-sm badge-white">{activeFiltersCount}</span>}
          </button>
        )}
        
        {activeFiltersCount > 0 && (
           <button className="btn btn-ghost text-danger" onClick={clearAll} style={{ fontSize: 13 }}>
             <X size={14} /> Xóa lọc
           </button>
        )}
      </div>

      {/* Expanded Panel */}
      {expanded && filters.length > 2 && (
        <div
          className="filter-panel"
          style={{
            marginTop: 12,
            padding: 16,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {filters.slice(2).map((f) => (
             <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {f.label}
                </label>
                {f.type === 'select' || f.type === 'status' ? (
                   <select
                     value={values[f.key] || ''}
                     onChange={(e) => handleFilterChange(f.key, e.target.value)}
                     style={{ width: '100%' }}
                   >
                     <option value="">Tất cả</option>
                     {f.options?.map((opt) => (
                       <option key={opt.value} value={opt.value}>
                         {opt.label}
                       </option>
                     ))}
                   </select>
                ) : f.type === 'date-range' ? (
                   <div className="row" style={{ gap: 8 }}>
                      <input 
                        type="date" 
                        value={values[`${f.key}_from`] || ''}
                        onChange={(e) => handleFilterChange(`${f.key}_from`, e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                      <input 
                        type="date" 
                        value={values[`${f.key}_to`] || ''}
                        onChange={(e) => handleFilterChange(`${f.key}_to`, e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                   </div>
                ) : (
                  <input
                    value={values[f.key] || ''}
                    onChange={(e) => handleFilterChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
             </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Pagination(props: {
  page: number
  pageSize: number
  totalItems: number
  onChangePage: (page: number) => void
  onChangePageSize?: (size: number) => void
  pageSizeOptions?: number[]
}) {
  const totalPages = Math.max(1, Math.ceil(props.totalItems / props.pageSize))
  const page = Math.max(1, Math.min(totalPages, props.page))

  const pageSizeOptions = (props.pageSizeOptions ?? [10, 20, 50, 100]).filter((n) => n > 0)

  return (
    <div className="row row-between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        Trang {page}/{totalPages} • {props.totalItems} dòng
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {props.onChangePageSize ? (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Mỗi trang</span>
            <select
              value={props.pageSize}
              onChange={(e) => props.onChangePageSize?.(Number(e.target.value) || props.pageSize)}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <button className="btn btn-small" onClick={() => props.onChangePage(1)} disabled={page <= 1}>
          « Đầu
        </button>
        <button className="btn btn-small" onClick={() => props.onChangePage(page - 1)} disabled={page <= 1}>
          ‹ Trước
        </button>
        <button className="btn btn-small" onClick={() => props.onChangePage(page + 1)} disabled={page >= totalPages}>
          Sau ›
        </button>
        <button className="btn btn-small" onClick={() => props.onChangePage(totalPages)} disabled={page >= totalPages}>
          Cuối »
        </button>
      </div>
    </div>
  )
}


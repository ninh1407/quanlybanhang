import { FileText, Download, Filter, Search } from 'lucide-react'

export function DocumentCenterPage() {

  const docs = [
    { id: 'PO-2023-001', type: 'Purchase Order', date: '2023-10-25', status: 'Approved', size: '1.2 MB' },
    { id: 'INV-2023-882', type: 'Invoice', date: '2023-10-24', status: 'Paid', size: '0.8 MB' },
    { id: 'DN-2023-156', type: 'Delivery Note', date: '2023-10-24', status: 'Shipped', size: '0.5 MB' },
    { id: 'CTR-2023-099', type: 'Contract', date: '2023-10-20', status: 'Active', size: '4.5 MB' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Tài liệu (Document Center)</h1>
          <div className="breadcrumbs">
            <span>Hệ thống</span>
            <span className="separator">/</span>
            <span className="current">Tài liệu</span>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">
            <FileText size={16} />
            Upload tài liệu
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Tìm kiếm tài liệu..." />
          </div>
          <div className="actions">
            <button className="btn btn-secondary">
              <Filter size={16} />
              Lọc
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Mã tài liệu</th>
              <th>Loại</th>
              <th>Ngày tạo</th>
              <th>Trạng thái</th>
              <th>Kích thước</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 500 }}>{d.id}</td>
                <td>
                  <span className="badge">{d.type}</span>
                </td>
                <td>{d.date}</td>
                <td>
                  <span className={`status-badge status-${d.status.toLowerCase()}`}>
                    {d.status}
                  </span>
                </td>
                <td>{d.size}</td>
                <td>
                  <button className="btn btn-small btn-secondary" title="Tải xuống">
                    <Download size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          Đây là module lưu trữ tập trung các chứng từ, hóa đơn, hợp đồng của hệ thống.
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo, useRef } from 'react'
import { FileText, Download, Search, Upload, Trash2 } from 'lucide-react'
import { useAppState, useAppDispatch } from '../state/Store'
import { useAuth } from '../auth/auth'
import { newId } from '../lib/id'
import { nowIso } from '../lib/date'
import type { Document, DocumentType } from '../domain/types'
import { useDialogs } from '../ui-kit/Dialogs'

export function DocumentCenterPage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const dialogs = useDialogs()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all')

  const documents = useMemo(() => {
    return state.documents
      .filter(d => d.status === 'active')
      .filter(d => filterType === 'all' || d.type === filterType)
      .filter(d => !searchTerm || d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.code.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [state.documents, searchTerm, filterType])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // In a real app, we would upload to S3/Blob storage.
    // Here we will just simulate it by reading as DataURL (base64)
    // Warning: Large files will crash local storage. Limit size.
    
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        await dialogs.alert({ message: 'File quá lớn (>2MB). Vui lòng chọn file nhỏ hơn.' })
        return
    }

    const reader = new FileReader()
    reader.onload = async () => {
        const url = reader.result as string
        const typeStr = file.name.split('.').pop()?.toUpperCase() || 'OTHER'
        let docType: DocumentType = 'Other'
        if (['PDF'].includes(typeStr)) docType = 'Contract' // Guessing logic
        
        const doc: Document = {
            id: newId('doc'),
            code: `DOC-${nowIso().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`,
            name: file.name,
            type: docType,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            url,
            status: 'active',
            createdAt: nowIso(),
            createdByUserId: user?.id || 'unknown'
        }
        
        dispatch({ type: 'documents/upsert', document: doc })
        await dialogs.alert({ message: 'Upload thành công!' })
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (doc: Document) => {
      const ok = await dialogs.confirm({ message: `Xóa tài liệu ${doc.name}?`, dangerous: true })
      if (ok) {
          dispatch({ type: 'documents/delete', id: doc.id })
      }
  }

  const handleDownload = (doc: Document) => {
      const link = document.createElement('a')
      link.href = doc.url
      link.download = doc.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
  }

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
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
          />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Upload tài liệu
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input 
                placeholder="Tìm kiếm tài liệu..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="actions">
            <select 
                className="select" 
                value={filterType} 
                onChange={e => setFilterType(e.target.value as any)}
                style={{ height: 36, borderColor: '#ddd', borderRadius: 6 }}
            >
                <option value="all">Tất cả loại</option>
                <option value="Contract">Hợp đồng</option>
                <option value="Invoice">Hóa đơn</option>
                <option value="PO">Đơn mua hàng</option>
                <option value="DeliveryNote">Phiếu giao hàng</option>
                <option value="Other">Khác</option>
            </select>
          </div>
        </div>

        {documents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                <p>Chưa có tài liệu nào. Hãy upload tài liệu mới.</p>
            </div>
        ) : (
            <table className="table">
            <thead>
                <tr>
                <th>Mã tài liệu</th>
                <th>Tên file</th>
                <th>Loại</th>
                <th>Ngày tạo</th>
                <th>Kích thước</th>
                <th>Người tạo</th>
                <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                {documents.map((d) => (
                <tr key={d.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{d.code}</td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>
                        <span className="badge">{d.type}</span>
                    </td>
                    <td>{d.createdAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>{d.size}</td>
                    <td>{state.users.find(u => u.id === d.createdByUserId)?.fullName || d.createdByUserId}</td>
                    <td>
                        <div className="row" style={{ gap: 8 }}>
                            <button className="btn btn-small btn-secondary" title="Tải xuống" onClick={() => handleDownload(d)}>
                                <Download size={14} />
                            </button>
                            <button className="btn btn-small btn-danger" title="Xóa" onClick={() => handleDelete(d)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        )}
        
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, borderTop: '1px solid #eee' }}>
          Đây là module lưu trữ tập trung các chứng từ, hóa đơn, hợp đồng của hệ thống.
        </div>
      </div>
    </div>
  )
}

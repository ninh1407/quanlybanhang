import { useMemo, useState } from 'react'
import { useAppState } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { File, Folder, Download, Trash2, Upload, FileText, Image as ImageIcon, Search } from 'lucide-react'
import { formatDateTime } from '../lib/date'
import { useDialogs } from '../ui-kit/Dialogs'

export function DocumentCenterPage() {
  const state = useAppState()
  const [activeFolder, setActiveFolder] = useState('all')
  const [query, setQuery] = useState('')
  const dialogs = useDialogs()

  const folders = [
      { id: 'all', name: 'Tất cả tài liệu' },
      { id: 'contracts', name: 'Hợp đồng' },
      { id: 'invoices', name: 'Hóa đơn' },
      { id: 'po', name: 'Đơn mua hàng (PO)' },
      { id: 'policies', name: 'Chính sách' },
  ]

  const filteredDocs = useMemo(() => {
      // Mock documents if state.documents is empty or just use what's there
      // Let's assume we use state.documents. 
      // If none, we can show empty state or some mock data for UI demo if user wants "Upgrade"
      
      let docs = state.documents || []
      
      // Filter by folder (mock logic: if document type matches or just all for now)
      if (activeFolder !== 'all') {
          // In real app, filter by folder/category
      }

      if (query) {
          const lower = query.toLowerCase()
          docs = docs.filter(d => d.name.toLowerCase().includes(lower))
      }
      
      return docs
  }, [state.documents, activeFolder, query])

  function handleUpload() {
      dialogs.alert({ message: 'Tính năng Upload đang phát triển' })
  }

  function getFileIcon(type: string) {
      if (type.includes('image')) return <ImageIcon size={32} color="var(--purple-600)" />
      if (type.includes('pdf')) return <FileText size={32} color="var(--danger)" />
      return <File size={32} color="var(--primary-600)" />
  }

  return (
    <div className="page">
      <PageHeader 
        title="Trung tâm tài liệu" 
        subtitle="Quản lý hợp đồng, hóa đơn và tài liệu nội bộ"
        actions={
            <button className="btn btn-primary" onClick={handleUpload}>
                <Upload size={16} />
                Tải lên
            </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
          {/* Sidebar */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Thư mục</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {folders.map(f => (
                      <button 
                        key={f.id}
                        onClick={() => setActiveFolder(f.id)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12, 
                            padding: '12px 16px', 
                            background: activeFolder === f.id ? 'var(--primary-50)' : 'transparent',
                            color: activeFolder === f.id ? 'var(--primary-700)' : 'var(--text-main)',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontWeight: activeFolder === f.id ? 600 : 400
                        }}
                      >
                          <Folder size={18} fill={activeFolder === f.id ? 'currentColor' : 'none'} />
                          {f.name}
                      </button>
                  ))}
              </div>
          </div>

          {/* Main Content */}
          <div className="card" style={{ minHeight: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {folders.find(f => f.id === activeFolder)?.name} 
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>({filteredDocs.length} file)</span>
                  </div>
                  <div style={{ position: 'relative', width: 240 }}>
                      <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                      <input 
                        placeholder="Tìm tài liệu..." 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ paddingLeft: 36, width: '100%' }}
                      />
                  </div>
              </div>

              {filteredDocs.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
                      {filteredDocs.map(doc => (
                          <div 
                            key={doc.id} 
                            style={{ 
                                border: '1px solid var(--border-color)', 
                                borderRadius: 12, 
                                padding: 16, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                textAlign: 'center',
                                transition: 'all 0.2s',
                                cursor: 'pointer',
                                background: 'var(--bg-surface)'
                            }}
                            className="hover:shadow-md hover:border-primary-300"
                          >
                              <div style={{ marginBottom: 12 }}>
                                  {getFileIcon(doc.type || '')}
                              </div>
                              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {doc.name}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                  {(Number(doc.size) / 1024).toFixed(1)} KB • {formatDateTime(doc.createdAt).split(' ')[0]}
                              </div>
                              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                                  <button className="btn btn-small btn-ghost" title="Tải xuống">
                                      <Download size={14} />
                                  </button>
                                  <button className="btn btn-small btn-ghost text-danger" title="Xóa">
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Folder size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                      <div>Thư mục trống</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>Chưa có tài liệu nào trong thư mục này</div>
                  </div>
              )}
          </div>
      </div>
    </div>
  )
}

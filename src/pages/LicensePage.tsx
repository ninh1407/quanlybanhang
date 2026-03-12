import { PageHeader } from '../ui-kit/PageHeader'
import { Calendar, CheckCircle, Award, Server } from 'lucide-react'

export function LicensePage() {
  return (
    <div className="page">
      <PageHeader title="Thông tin bản quyền" subtitle="Quản lý gói dịch vụ và gia hạn" />

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--primary-200)', boxShadow: '0 10px 30px rgba(37, 99, 235, 0.1)' }}>
              <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', padding: 32, color: 'white', textAlign: 'center' }}>
                  <Award size={48} style={{ marginBottom: 16, opacity: 0.9 }} />
                  <h2 style={{ margin: 0, fontSize: 24 }}>Enterprise License</h2>
                  <div style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>Phiên bản cao cấp dành cho chuỗi cửa hàng</div>
              </div>
              
              <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                      <div style={{ padding: 16, background: 'var(--bg-subtle)', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
                              <Calendar size={16} /> Ngày hết hạn
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>28/03/2026</div>
                      </div>
                      <div style={{ padding: 16, background: 'var(--success-50)', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success-700)', fontSize: 13, marginBottom: 4 }}>
                              <CheckCircle size={16} /> Trạng thái
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-700)' }}>Đang hoạt động</div>
                      </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>Tính năng bao gồm:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                              <CheckCircle size={16} color="var(--success)" /> Đa chi nhánh
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                              <CheckCircle size={16} color="var(--success)" /> Không giới hạn người dùng
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                              <CheckCircle size={16} color="var(--success)" /> API tích hợp
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                              <CheckCircle size={16} color="var(--success)" /> Hỗ trợ 24/7
                          </div>
                      </div>
                  </div>

                  <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          <Server size={14} />
                          Server: Asia-Pacific (VN)
                      </div>
                      <button className="btn btn-primary">Gia hạn ngay</button>
                  </div>
              </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
              Cần nâng cấp gói? <a href="#" style={{ color: 'var(--primary-600)', fontWeight: 500 }}>Liên hệ kinh doanh</a>
          </div>
      </div>
    </div>
  )
}

export function ComingSoonPage(props: { title: string; module: string }) {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, marginBottom: 16 }}>🚀 {props.title}</h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto' }}>
          Module <strong>{props.module}</strong> đang được phát triển và sẽ sớm ra mắt trong phiên bản Enterprise tiếp theo.
        </p>
        <div style={{ marginTop: 32, padding: 20, background: 'var(--neutral-100)', borderRadius: 12, display: 'inline-block' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Tính năng dự kiến:</div>
          <ul style={{ textAlign: 'left', paddingLeft: 20, margin: 0 }}>
            <li>Quản lý quy trình nghiệp vụ chuyên sâu</li>
            <li>Báo cáo & Phân tích nâng cao</li>
            <li>Tích hợp tự động hóa</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

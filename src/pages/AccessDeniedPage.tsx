import { PageHeader } from '../ui-kit/PageHeader'

export function AccessDeniedPage() {
  return (
    <div className="page">
      <PageHeader title="Không đủ quyền" />
      <div className="card">
        <div>Bạn không có quyền truy cập chức năng này.</div>
      </div>
    </div>
  )
}

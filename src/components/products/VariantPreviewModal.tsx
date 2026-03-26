import { Trash2 } from 'lucide-react'
import { Modal } from '../../ui-kit/Modal'

export type GeneratorVariantPreview = {
  key: string
  color: string
  size: string
  material?: string
  volume?: string
  capacity?: string
  power?: string
  skuCode: string
}

export function VariantPreviewModal(props: {
  open: boolean
  onClose: () => void
  rows: GeneratorVariantPreview[]
  removed: Set<string>
  onToggleRemoved: (key: string) => void
  onChangeSkuCode: (key: string, skuCode: string) => void
  existingSkuCodes: Set<string>
  extraField: '' | 'material' | 'volume' | 'capacity' | 'power'
  defaultPrice: number
  defaultActive: boolean
  onRegenerateSkuCodes: () => void
  onApply: () => void
}) {
  const {
    open,
    onClose,
    rows,
    removed,
    onToggleRemoved,
    onChangeSkuCode,
    existingSkuCodes,
    extraField,
    defaultPrice,
    defaultActive,
    onRegenerateSkuCodes,
    onApply,
  } = props

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xem trước biến thể sẽ tạo"
      width={900}
      footer={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={onApply}>
            Áp dụng tạo
          </button>
        </>
      }
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="badge badge-neutral">Sẽ tạo: {rows.filter((p) => !removed.has(p.key)).length} biến thể</div>
        <button type="button" className="btn" onClick={onRegenerateSkuCodes}>
          Tạo lại skuCode
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 56 }}></th>
              <th>Tổ hợp</th>
              <th style={{ width: 260 }}>skuCode</th>
              <th style={{ width: 120 }} className="text-right">Giá</th>
              <th style={{ width: 120 }} className="text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const isRemoved = removed.has(p.key)
              const dup = existingSkuCodes.has(p.skuCode.trim().toUpperCase())
              const parts = [p.color, p.size]
              if (extraField) {
                const v = (p as any)[extraField] as string
                if (v) parts.push(v)
              }
              const variantLabel = parts.filter(Boolean).join(' / ') || 'DEFAULT'
              return (
                <tr key={p.key} style={{ opacity: isRemoved ? 0.5 : 1 }}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => onToggleRemoved(p.key)}
                      title={isRemoved ? 'Khôi phục' : 'Loại khỏi danh sách'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800 }}>{variantLabel}</div>
                    {dup && <div className="text-danger" style={{ fontSize: 12 }}>Trùng skuCode trong hệ thống</div>}
                  </td>
                  <td>
                    <input
                      value={p.skuCode}
                      onChange={(e) => onChangeSkuCode(p.key, e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </td>
                  <td className="text-right">{defaultPrice}</td>
                  <td className="text-right">
                    <span className={`badge ${defaultActive ? 'badge-success' : 'badge-neutral'}`}>{defaultActive ? 'Đang bán' : 'Ngưng'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}


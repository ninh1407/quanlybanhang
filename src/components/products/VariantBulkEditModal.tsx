import { Filter } from 'lucide-react'
import { Modal } from '../../ui-kit/Modal'

type BulkField = 'price' | 'cost' | 'unit' | 'active' | 'color' | 'size' | 'material' | 'volume' | 'capacity' | 'power'

export function VariantBulkEditModal(props: {
  open: boolean
  onClose: () => void
  selectedCount: number
  field: BulkField
  onChangeField: (f: BulkField) => void
  valueText: string
  onChangeValueText: (v: string) => void
  activeValue: '1' | '0'
  onChangeActiveValue: (v: '1' | '0') => void
  onApply: () => void
}) {
  const {
    open,
    onClose,
    selectedCount,
    field,
    onChangeField,
    valueText,
    onChangeValueText,
    activeValue,
    onChangeActiveValue,
    onApply,
  } = props

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sửa hàng loạt"
      footer={
        <>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={onApply}>
            Áp dụng
          </button>
        </>
      }
    >
      <div className="text-muted" style={{ marginBottom: 12 }}>
        Đang chọn: <b>{selectedCount}</b> biến thể
      </div>
      <div className="grid-form" style={{ gridTemplateColumns: '200px 1fr', gap: 12 }}>
        <div className="field">
          <label>Trường cần sửa</label>
          <select value={field} onChange={(e) => onChangeField(e.target.value as BulkField)}>
            <option value="price">Giá bán</option>
            <option value="cost">Giá vốn</option>
            <option value="unit">Đơn vị</option>
            <option value="active">Trạng thái</option>
            <option value="color">Màu</option>
            <option value="size">Size</option>
            <option value="material">Material</option>
            <option value="volume">Volume</option>
            <option value="capacity">Capacity</option>
            <option value="power">Power</option>
          </select>
        </div>
        <div className="field">
          <label>Giá trị</label>
          {field === 'active' ? (
            <select value={activeValue} onChange={(e) => onChangeActiveValue(e.target.value as '1' | '0')}>
              <option value="1">Đang bán</option>
              <option value="0">Ngưng bán</option>
            </select>
          ) : (
            <input
              value={valueText}
              onChange={(e) => onChangeValueText(e.target.value)}
              placeholder={field === 'unit' ? 'VD: cái' : field === 'price' || field === 'cost' ? 'VD: 100000' : 'Nhập giá trị'}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12, background: 'var(--bg-subtle)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <Filter size={16} />
          <div className="text-muted" style={{ fontSize: 12 }}>
            Lưu ý: thay đổi giá/vốn có thể yêu cầu nhập lý do khi lưu.
          </div>
        </div>
      </div>
    </Modal>
  )
}


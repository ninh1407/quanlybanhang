import type { SkuCodeField, SkuCodeSeparator, SkuCodeTemplate } from './skuCode'
import type { VariantDefaults } from './types'

export function VariantSkuDefaultsPanel(props: {
  internalCode: string
  template: SkuCodeTemplate
  onChangeTemplate: (next: SkuCodeTemplate) => void
  defaults: VariantDefaults
  onChangeDefaults: (next: VariantDefaults) => void
}) {
  const { internalCode, template, onChangeTemplate, defaults, onChangeDefaults } = props

  return (
    <div className="card" style={{ padding: 12, marginTop: 12, background: 'var(--bg-subtle)' }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>3) Tự sinh skuCode</div>
      <div className="grid-form" style={{ gridTemplateColumns: '1fr 140px 1fr', gap: 12 }}>
        <div className="field">
          <label>Prefix</label>
          <input value={template.prefix} onChange={(e) => onChangeTemplate({ ...template, prefix: e.target.value })} placeholder={internalCode} />
        </div>
        <div className="field">
          <label>Ngăn cách</label>
          <select value={template.separator} onChange={(e) => onChangeTemplate({ ...template, separator: e.target.value as SkuCodeSeparator })}>
            <option value="-">-</option>
            <option value="_">_</option>
            <option value="">Không</option>
          </select>
        </div>
        <div className="field">
          <label>Thứ tự</label>
          <select
            value={template.order.join(',')}
            onChange={(e) => {
              const v = e.target.value
              const order: SkuCodeField[] = v.split(',').filter(Boolean) as any
              onChangeTemplate({ ...template, order })
            }}
          >
            <option value="prefix,color,size">Prefix - Màu - Size</option>
            <option value="prefix,size,color">Prefix - Size - Màu</option>
            <option value="prefix,color,size,capacity">Prefix - Màu - Size - Capacity</option>
            <option value="prefix,color,size,volume">Prefix - Màu - Size - Volume</option>
            <option value="prefix,color,size,power">Prefix - Màu - Size - Power</option>
            <option value="prefix,color,size,material">Prefix - Màu - Size - Material</option>
          </select>
        </div>
      </div>

      <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
        <div className="field">
          <label>Giá bán mặc định</label>
          <input type="number" value={defaults.price} onChange={(e) => onChangeDefaults({ ...defaults, price: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Giá vốn mặc định</label>
          <input type="number" value={defaults.cost} onChange={(e) => onChangeDefaults({ ...defaults, cost: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Đơn vị</label>
          <input value={defaults.unit} onChange={(e) => onChangeDefaults({ ...defaults, unit: e.target.value })} />
        </div>
        <div className="field">
          <label>Trạng thái</label>
          <select value={defaults.active ? '1' : '0'} onChange={(e) => onChangeDefaults({ ...defaults, active: e.target.value === '1' })}>
            <option value="1">Đang bán</option>
            <option value="0">Ngưng bán</option>
          </select>
        </div>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-secondary)' }}>Nâng cao (tuỳ chọn)</summary>
        <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div className="field">
            <label>Material</label>
            <input value={defaults.material || ''} onChange={(e) => onChangeDefaults({ ...defaults, material: e.target.value })} />
          </div>
          <div className="field">
            <label>Volume</label>
            <input value={defaults.volume || ''} onChange={(e) => onChangeDefaults({ ...defaults, volume: e.target.value })} />
          </div>
          <div className="field">
            <label>Capacity</label>
            <input value={defaults.capacity || ''} onChange={(e) => onChangeDefaults({ ...defaults, capacity: e.target.value })} />
          </div>
          <div className="field">
            <label>Power</label>
            <input value={defaults.power || ''} onChange={(e) => onChangeDefaults({ ...defaults, power: e.target.value })} />
          </div>
        </div>
      </details>
    </div>
  )
}


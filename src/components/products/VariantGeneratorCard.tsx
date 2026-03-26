import { useMemo, useState } from 'react'
import { CopyPlus, Sparkles } from 'lucide-react'
import { buildSkuCode, parseVariantValues, type SkuCodeField, type SkuCodeTemplate } from './skuCode'
import type { SkuDraft, VariantSetupMode, VariantDefaults } from './types'
import { VariantPreviewModal, type GeneratorVariantPreview } from './VariantPreviewModal'
import { VariantSkuDefaultsPanel } from './VariantSkuDefaultsPanel'

function uniqueByKey<T>(items: T[], getKey: (it: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  items.forEach((it) => {
    const k = getKey(it)
    if (seen.has(k)) return
    seen.add(k)
    out.push(it)
  })
  return out
}

function buildDefaultTemplate(prefix: string): SkuCodeTemplate {
  return { prefix: prefix || 'SP', separator: '-', order: ['prefix', 'color', 'size'] }
}

export function VariantGeneratorCard(props: {
  mode: VariantSetupMode
  internalCode: string
  defaults: VariantDefaults
  onChangeDefaults: (next: VariantDefaults) => void
  template: SkuCodeTemplate
  onChangeTemplate: (next: SkuCodeTemplate) => void
  existingSkuCodes: Set<string>
  onAddDrafts: (drafts: SkuDraft[]) => void
  newId: () => string
  nowIso: () => string
}) {
  const {
    mode,
    internalCode,
    defaults,
    onChangeDefaults,
    template,
    onChangeTemplate,
    existingSkuCodes,
    onAddDrafts,
    newId,
    nowIso,
  } = props

  const [colorsInput, setColorsInput] = useState('')
  const [sizesInput, setSizesInput] = useState('')
  const [extraField, setExtraField] = useState<Exclude<SkuCodeField, 'prefix' | 'color' | 'size'> | ''>('')
  const [extraValuesInput, setExtraValuesInput] = useState('')

  const colors = useMemo(() => parseVariantValues(colorsInput), [colorsInput])
  const sizes = useMemo(() => parseVariantValues(sizesInput), [sizesInput])
  const extras = useMemo(() => parseVariantValues(extraValuesInput), [extraValuesInput])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState<GeneratorVariantPreview[]>([])
  const [previewRemoved, setPreviewRemoved] = useState<Set<string>>(() => new Set())

  const canGenerate = mode === 'multi'

  const effectiveTemplate = useMemo(() => {
    if (!template.prefix.trim()) return { ...template, prefix: internalCode || template.prefix }
    return template
  }, [template, internalCode])

  function regeneratePreview(next: GeneratorVariantPreview[]) {
    const regen = next.map((v) => ({
      ...v,
      skuCode:
        buildSkuCode(effectiveTemplate, {
          color: v.color,
          size: v.size,
          material: v.material,
          volume: v.volume,
          capacity: v.capacity,
          power: v.power,
        }) || `${buildSkuCode(buildDefaultTemplate(internalCode), {})}-DEFAULT`,
    }))
    setPreview(regen)
  }

  function handleOpenPreview() {
    const c = colors.length ? colors : ['']
    const s = sizes.length ? sizes : ['']
    const e = extraField ? (extras.length ? extras : ['']) : ['']

    const raw = c.flatMap((color) =>
      s.flatMap((size) =>
        e.map((val) => {
          const base: GeneratorVariantPreview = {
            key: `${color}__${size}__${extraField ? val : ''}`,
            color,
            size,
            skuCode: '',
          }
          if (!extraField) return base
          return { ...base, [extraField]: val }
        }),
      ),
    )

    const next = uniqueByKey(raw, (x) => x.key)
    const withCode = next.map((v) => ({
      ...v,
      skuCode:
        buildSkuCode(effectiveTemplate, {
          color: v.color,
          size: v.size,
          material: v.material,
          volume: v.volume,
          capacity: v.capacity,
          power: v.power,
        }) || `${buildSkuCode(buildDefaultTemplate(internalCode), {})}-DEFAULT`,
    }))

    setPreviewRemoved(new Set())
    setPreview(withCode)
    setPreviewOpen(true)
  }

  function handleApplyPreview() {
    const kept = preview.filter((p) => !previewRemoved.has(p.key))
    const drafts: SkuDraft[] = kept.map((p) => {
      const draft: SkuDraft = {
        id: newId(),
        productId: '',
        createdAt: nowIso(),
        skuCode: p.skuCode,
        color: p.color,
        size: p.size,
        material: p.material || defaults.material || '',
        volume: p.volume || defaults.volume || '',
        capacity: p.capacity || defaults.capacity || '',
        power: p.power || defaults.power || '',
        unit: defaults.unit || 'cái',
        cost: Number(defaults.cost) || 0,
        price: Number(defaults.price) || 0,
        active: Boolean(defaults.active),
        kind: 'single',
        components: [],
        _isNew: true,
      }
      return draft
    })

    onAddDrafts(drafts)
    setPreviewOpen(false)
  }

  if (!canGenerate) return null

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
          <Sparkles size={16} /> 2) Sinh biến thể
        </div>
        <div className="badge badge-neutral">Preview trước khi tạo</div>
      </div>

      <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>Danh sách màu (mỗi dòng hoặc phân tách , ; |)</label>
          <textarea value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} rows={3} placeholder="VD: Đen, Trắng, Đỏ" />
        </div>
        <div className="field">
          <label>Danh sách size/phiên bản</label>
          <textarea value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} rows={3} placeholder="VD: S, M, L" />
        </div>
      </div>

      <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div className="field">
          <label>Thuộc tính khác (tuỳ chọn)</label>
          <select value={extraField} onChange={(e) => setExtraField(e.target.value as any)}>
            <option value="">-- Không dùng --</option>
            <option value="material">Material</option>
            <option value="volume">Volume</option>
            <option value="capacity">Capacity</option>
            <option value="power">Power</option>
          </select>
        </div>
        <div className="field">
          <label>Giá trị thuộc tính khác</label>
          <textarea
            value={extraValuesInput}
            onChange={(e) => setExtraValuesInput(e.target.value)}
            rows={3}
            placeholder={extraField ? 'VD: 2L, 3L' : 'Chọn thuộc tính khác để nhập'}
            disabled={!extraField}
          />
        </div>
      </div>

      <VariantSkuDefaultsPanel
        internalCode={internalCode}
        template={template}
        onChangeTemplate={onChangeTemplate}
        defaults={defaults}
        onChangeDefaults={onChangeDefaults}
      />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Dự kiến tạo: <b>{Math.max(colors.length || 1, 1) * Math.max(sizes.length || 1, 1) * (extraField ? Math.max(extras.length || 1, 1) : 1)}</b> biến thể
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOpenPreview}>
          <CopyPlus size={16} /> Tạo danh sách xem trước
        </button>
      </div>

      <VariantPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        rows={preview}
        removed={previewRemoved}
        onToggleRemoved={(key) => {
          setPreviewRemoved((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })
        }}
        onChangeSkuCode={(key, skuCode) => {
          setPreview((prev) => prev.map((x) => (x.key === key ? { ...x, skuCode } : x)))
        }}
        existingSkuCodes={existingSkuCodes}
        extraField={extraField}
        defaultPrice={defaults.price}
        defaultActive={defaults.active}
        onRegenerateSkuCodes={() => regeneratePreview(preview)}
        onApply={handleApplyPreview}
      />
    </div>
  )
}


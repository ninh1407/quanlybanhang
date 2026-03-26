import { useEffect, useMemo, useState } from 'react'
import { Grid3X3, List, Tag } from 'lucide-react'
import { buildSkuCode, type SkuCodeTemplate } from './skuCode'
import type { SkuDraft, SkuDraftErrors, VariantDefaults, VariantSetupMode } from './types'
import { VariantGeneratorCard } from './VariantGeneratorCard'
import { VariantMatrixCard } from './VariantMatrixCard'
import { VariantTableCard } from './VariantTableCard'
import { Modal } from '../../ui-kit/Modal'

function defaultTemplate(internalCode: string): SkuCodeTemplate {
  return { prefix: internalCode || 'SP', separator: '-', order: ['prefix', 'color', 'size'] }
}

function defaultDefaults(): VariantDefaults {
  return { price: 0, cost: 0, unit: 'cái', active: true, material: '', volume: '', capacity: '', power: '' }
}

function statusBadge(active: boolean, qty: number): { cls: string; label: string } {
  if (!active) return { cls: 'badge-neutral', label: 'Ngưng' }
  if (qty === 0) return { cls: 'badge-danger', label: 'Hết hàng' }
  if (qty <= 5) return { cls: 'badge-warning', label: 'Tồn thấp' }
  return { cls: 'badge-success', label: 'Đang bán' }
}

export function ProductVariantsEditor(props: {
  mode: VariantSetupMode
  onChangeMode: (m: VariantSetupMode) => void
  internalCode: string
  drafts: SkuDraft[]
  onSetDrafts: (next: SkuDraft[]) => void
  qtyBySkuId: Map<string, number>
  errors: SkuDraftErrors
  allSkuCodes: Set<string>
  newId: () => string
  nowIso: () => string
  onOpenExistingSku: (skuId: string) => void
}) {
  const {
    mode,
    onChangeMode,
    internalCode,
    drafts,
    onSetDrafts,
    qtyBySkuId,
    errors,
    allSkuCodes,
    newId,
    nowIso,
    onOpenExistingSku,
  } = props

  const [tab, setTab] = useState<'list' | 'matrix'>('list')
  const [template, setTemplate] = useState<SkuCodeTemplate>(() => defaultTemplate(internalCode))
  const [defaults, setDefaults] = useState<VariantDefaults>(() => defaultDefaults())
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSkuId, setDetailSkuId] = useState<string | null>(null)

  useEffect(() => {
    setTemplate((prev) => ({ ...prev, prefix: prev.prefix || internalCode || 'SP' }))
  }, [internalCode])

  const existingSkuCodes = useMemo(() => {
    const next = new Set(allSkuCodes)
    drafts.forEach((d) => next.delete((d.skuCode || '').trim().toUpperCase()))
    return next
  }, [allSkuCodes, drafts])

  const liveErrors = useMemo<SkuDraftErrors>(() => {
    const errs: SkuDraftErrors = {}
    const codeToIds = new Map<string, string[]>()
    drafts.forEach((d) => {
      const code = (d.skuCode || '').trim().toUpperCase()
      if (!code) {
        errs[d.id] = ['Thiếu skuCode']
        return
      }
      const ids = codeToIds.get(code) || []
      ids.push(d.id)
      codeToIds.set(code, ids)
    })

    codeToIds.forEach((ids, code) => {
      if (ids.length <= 1) return
      ids.forEach((id) => {
        errs[id] = [...(errs[id] || []), `Trùng skuCode (${code}) trong danh sách`] 
      })
    })

    drafts.forEach((d) => {
      const code = (d.skuCode || '').trim().toUpperCase()
      if (code && existingSkuCodes.has(code)) {
        errs[d.id] = [...(errs[d.id] || []), 'skuCode đã tồn tại trong hệ thống']
      }
      const price = Number(d.price) || 0
      const cost = Number(d.cost) || 0
      if (price < 0) errs[d.id] = [...(errs[d.id] || []), 'Giá bán không được âm']
      if (cost < 0) errs[d.id] = [...(errs[d.id] || []), 'Giá vốn không được âm']
    })

    return errs
  }, [drafts, existingSkuCodes])

  const mergedErrors = useMemo<SkuDraftErrors>(() => {
    const merged: SkuDraftErrors = {}
    const keys = new Set([...Object.keys(errors), ...Object.keys(liveErrors)])
    keys.forEach((id) => {
      const all = [...(liveErrors[id] || []), ...(errors[id] || [])]
      const uniq: string[] = []
      const seen = new Set<string>()
      all.forEach((m) => {
        if (!m) return
        if (seen.has(m)) return
        seen.add(m)
        uniq.push(m)
      })
      if (uniq.length) merged[id] = uniq
    })
    return merged
  }, [errors, liveErrors])

  function patchDraft(id: string, patch: Partial<SkuDraft>) {
    onSetDrafts(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function addDrafts(nextDrafts: SkuDraft[]) {
    const existingCodes = new Set(drafts.map((d) => (d.skuCode || '').trim().toUpperCase()))
    const filtered = nextDrafts.filter((d) => {
      const code = (d.skuCode || '').trim().toUpperCase()
      if (!code) return true
      if (existingCodes.has(code)) return false
      existingCodes.add(code)
      return true
    })
    onSetDrafts([...drafts, ...filtered])
  }

  function applyBulk(ids: string[], patch: Partial<SkuDraft>) {
    const idSet = new Set(ids)
    onSetDrafts(drafts.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d)))
  }

  function regenerateSkuCodesFor(ids: string[]) {
    const idSet = new Set(ids)
    onSetDrafts(
      drafts.map((d) => {
        if (!idSet.has(d.id)) return d
        const code =
          buildSkuCode(template, {
            color: d.color,
            size: d.size,
            material: d.material,
            volume: d.volume,
            capacity: d.capacity,
            power: d.power,
          }) || `${(internalCode || 'SP').trim().toUpperCase()}-DEFAULT`
        return { ...d, skuCode: code }
      }),
    )
  }

  function ensureSingleDraft() {
    if (drafts.length) return
    onSetDrafts([
      {
        id: newId(),
        productId: '',
        createdAt: nowIso(),
        skuCode: `${(internalCode || 'SP').trim().toUpperCase()}-DEFAULT`,
        color: '',
        size: '',
        material: defaults.material || '',
        volume: defaults.volume || '',
        capacity: defaults.capacity || '',
        power: defaults.power || '',
        unit: defaults.unit || 'cái',
        cost: Number(defaults.cost) || 0,
        price: Number(defaults.price) || 0,
        active: Boolean(defaults.active),
        kind: 'single',
        components: [],
        _isNew: true,
      },
    ])
  }

  useEffect(() => {
    if (mode === 'single') ensureSingleDraft()
  }, [mode])

  const detailSku = useMemo(() => drafts.find((d) => d.id === detailSkuId) || null, [drafts, detailSkuId])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900 }}>
            <Tag size={16} /> 1) Cấu hình biến thể
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className={mode === 'single' ? 'btn btn-primary' : 'btn'} onClick={() => onChangeMode('single')}>
            1 SKU mặc định
          </button>
          <button type="button" className={mode === 'multi' ? 'btn btn-primary' : 'btn'} onClick={() => onChangeMode('multi')}>
            Sinh nhiều biến thể
          </button>
          <div className="text-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
            Dành cho người không kỹ thuật: nhập Màu/Size một lần → xem trước → tạo hàng loạt.
          </div>
        </div>
      </div>

      {mode === 'multi' && (
        <VariantGeneratorCard
          mode={mode}
          internalCode={internalCode}
          defaults={defaults}
          onChangeDefaults={setDefaults}
          template={template}
          onChangeTemplate={setTemplate}
          existingSkuCodes={existingSkuCodes}
          onAddDrafts={addDrafts}
          newId={newId}
          nowIso={nowIso}
        />
      )}

      <div className="tabs" style={{ marginTop: 4 }}>
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <List size={14} /> Danh sách
        </button>
        <button className={`tab ${tab === 'matrix' ? 'active' : ''}`} onClick={() => setTab('matrix')}>
          <Grid3X3 size={14} /> Matrix tồn
        </button>
      </div>

      {tab === 'list' ? (
        <VariantTableCard
          drafts={drafts}
          onChangeDraft={patchDraft}
          qtyBySkuId={qtyBySkuId}
          errors={mergedErrors}
          onOpenSku={(id) => {
            const d = drafts.find((x) => x.id === id) || null
            if (!d) return
            if (d._isNew) {
              setDetailSkuId(id)
              setDetailOpen(true)
              return
            }
            onOpenExistingSku(id)
          }}
          onBulkApply={applyBulk}
          onRegenerateSkuCodesFor={regenerateSkuCodesFor}
        />
      ) : (
        <VariantMatrixCard
          drafts={drafts}
          qtyBySkuId={qtyBySkuId}
          onOpenSku={(id) => {
            const d = drafts.find((x) => x.id === id) || null
            if (!d) return
            if (d._isNew) {
              setDetailSkuId(id)
              setDetailOpen(true)
              return
            }
            onOpenExistingSku(id)
          }}
        />
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chỉnh nhanh biến thể"
        footer={
          <>
            <button className="btn" onClick={() => setDetailOpen(false)}>Đóng</button>
            <button className="btn btn-primary" onClick={() => setDetailOpen(false)}>OK</button>
          </>
        }
      >
        {!detailSku ? (
          <div className="text-muted">Không tìm thấy biến thể.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ padding: 12, background: 'var(--bg-subtle)' }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>{detailSku.skuCode}</div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                {(() => {
                  const qty = qtyBySkuId.get(detailSku.id) ?? 0
                  const s = statusBadge(detailSku.active, qty)
                  return <span className={`badge ${s.cls}`}>{s.label}</span>
                })()}
                <span className="text-muted" style={{ fontSize: 12 }}>Tồn: {qtyBySkuId.get(detailSku.id) ?? 0}</span>
              </div>
            </div>

            <div className="grid-form" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Material</label>
                <input value={detailSku.material || ''} onChange={(e) => patchDraft(detailSku.id, { material: e.target.value })} />
              </div>
              <div className="field">
                <label>Volume</label>
                <input value={detailSku.volume || ''} onChange={(e) => patchDraft(detailSku.id, { volume: e.target.value })} />
              </div>
              <div className="field">
                <label>Capacity</label>
                <input value={detailSku.capacity || ''} onChange={(e) => patchDraft(detailSku.id, { capacity: e.target.value })} />
              </div>
              <div className="field">
                <label>Power</label>
                <input value={detailSku.power || ''} onChange={(e) => patchDraft(detailSku.id, { power: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


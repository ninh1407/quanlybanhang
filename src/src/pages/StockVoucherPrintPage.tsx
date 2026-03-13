import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useSettings } from '../settings/useSettings'
import { useAppState } from '../state/Store'

function money(n: number): string {
  const v = Math.round(Number(n) || 0)
  return v.toLocaleString('vi-VN')
}

export function StockVoucherPrintPage() {
  const { id } = useParams()
  const state = useAppState()
  const { settings } = useSettings()

  const voucher = useMemo(() => state.stockVouchers.find((v) => v.id === id) ?? null, [id, state.stockVouchers])
  const locationsById = useMemo(() => new Map(state.locations.map((l) => [l.id, l])), [state.locations])
  const skusById = useMemo(() => new Map(state.skus.map((s) => [s.id, s])), [state.skus])
  const productsById = useMemo(() => new Map(state.products.map((p) => [p.id, p.name])), [state.products])

  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 50)
    return () => window.clearTimeout(t)
  }, [])

  if (!voucher) return <div style={{ padding: 24 }}>Không tìm thấy phiếu.</div>

  const from = voucher.fromLocationId ? locationsById.get(voucher.fromLocationId) ?? null : null
  const to = voucher.toLocationId ? locationsById.get(voucher.toLocationId) ?? null : null

  const title = voucher.type === 'in' ? 'PHIẾU NHẬP KHO' : voucher.type === 'out' ? 'PHIẾU XUẤT KHO' : 'PHIẾU ĐIỀU CHUYỂN'

  return (
    <div style={{ padding: 24, color: '#111' }}>
      <style>
        {`@media print {
  @page { size: A5 landscape; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 10mm; }
  .no-print { display: none !important; }
}
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #333; padding: 6px 8px; font-size: 12px; }
th { background: #f2f2f2; text-align: left; }
`}
      </style>

      <div className="no-print" style={{ marginBottom: 12 }}>
        <button onClick={() => window.print()}>In / Lưu PDF</button>
      </div>

      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{settings.companyName || 'Công ty'}</div>
        <div style={{ fontSize: 12, color: '#444' }}>Ngày in: {new Date().toISOString().slice(0, 19).replace('T', ' ')}</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
        <div style={{ marginTop: 4, fontFamily: 'monospace' }}>{voucher.code}</div>
      </div>

      <div style={{ display: 'grid', gap: 6, marginBottom: 12, fontSize: 12 }}>
        <div>Ngày tạo: {voucher.createdAt.slice(0, 19).replace('T', ' ')}</div>
        {from ? <div>Kho xuất: {from.code} - {from.name}</div> : null}
        {to ? <div>Kho nhập: {to.code} - {to.name}</div> : null}
        {voucher.note ? <div>Ghi chú: {voucher.note}</div> : null}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Hàng hóa</th>
            <th style={{ width: 90 }}>Số lượng</th>
            <th style={{ width: 110 }}>Giá nhập</th>
            <th style={{ width: 140 }}>Thành tiền</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {voucher.lines.map((l, idx) => {
            const sku = skusById.get(l.skuId) ?? null
            const productName = sku ? productsById.get(sku.productId) ?? sku.productId : l.skuId
            const attrs = sku ? [sku.color.trim(), sku.size.trim()].filter(Boolean).join(' / ') : ''
            const label = `${productName}${attrs ? ` - ${attrs}` : ''}${sku ? ` (${sku.skuCode})` : ''}`
            const qty = Number(l.qty) || 0
            const unitCost = l.unitCost == null ? 0 : Number(l.unitCost) || 0
            const amount = qty * unitCost
            return (
              <tr key={`${l.skuId}-${idx}`}>
                <td>{idx + 1}</td>
                <td>{label}</td>
                <td style={{ textAlign: 'right' }}>{qty}</td>
                <td style={{ textAlign: 'right' }}>{voucher.type === 'out' ? '' : money(unitCost)}</td>
                <td style={{ textAlign: 'right' }}>{voucher.type === 'out' ? '' : money(amount)}</td>
                <td>{l.note}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginTop: 18 }}>
        <div style={{ textAlign: 'center', fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>Người lập</div>
          <div style={{ height: 70 }} />
          <div>________________</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>Thủ kho</div>
          <div style={{ height: 70 }} />
          <div>________________</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>Kế toán</div>
          <div style={{ height: 70 }} />
          <div>________________</div>
        </div>
      </div>
    </div>
  )
}


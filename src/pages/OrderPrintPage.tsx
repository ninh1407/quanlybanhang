import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useSettings } from '../settings/useSettings'
import { useAppState } from '../state/Store'
import { formatVnd } from '../../shared/lib/money'

export function OrderPrintPage() {
  const { id } = useParams()
  const state = useAppState()
  const { settings } = useSettings()

  const order = useMemo(() => state.orders.find((o) => o.id === id), [id, state.orders])
  const customer = useMemo(() => (order?.customerId ? state.customers.find((c) => c.id === order.customerId) : null), [order, state.customers])
  
  const productsById = useMemo(() => new Map(state.products.map((p: any) => [p.id, p])), [state.products])
  const skusById = useMemo(() => new Map(state.skus.map(s => [s.id, s])), [state.skus])

  useEffect(() => {
    if (order) {
        document.title = `Hóa đơn ${order.code}`
        const t = window.setTimeout(() => window.print(), 500)
        return () => window.clearTimeout(t)
    }
  }, [order])

  if (!order) return <div style={{ padding: 24 }}>Không tìm thấy đơn hàng.</div>

  const subTotal = order.subTotalOverride ?? order.items.reduce((sum, i) => sum + i.qty * i.price, 0)
  const total = subTotal + (order.shippingFee || 0) - (order.discountAmount || 0) + (order.vatAmount || 0) + (order.otherFees || 0)

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#000', maxWidth: 800, margin: '0 auto' }}>
      <style>
        {`
          @media print {
            @page { size: A4; margin: 0; }
            body { margin: 0; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            .page-container { padding: 40px; }
          }
          .page-container { background: white; min-height: 100vh; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: 600; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: 600; }
        `}
      </style>

      <div className="no-print" style={{ marginBottom: 20, textAlign: 'right' }}>
        <button 
            onClick={() => window.print()} 
            style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
            In Hóa Đơn
        </button>
      </div>

      <div className="page-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
            <div>
                <h1 style={{ margin: '0 0 8px 0', fontSize: 24, textTransform: 'uppercase' }}>{settings.companyName || 'CỬA HÀNG NAM PHƯƠNG'}</h1>
                <div style={{ color: '#555', fontSize: 14, lineHeight: 1.5 }}>
                    <div>Địa chỉ: {settings.address || 'Chưa cập nhật'}</div>
                    <div>Điện thoại: {settings.phone || 'Chưa cập nhật'}</div>
                    {settings.taxCode && <div>Mã số thuế: {settings.taxCode}</div>}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: '0 0 8px 0', color: '#007bff' }}>HÓA ĐƠN BÁN HÀNG</h2>
                <div style={{ fontSize: 14, color: '#555' }}>
                    <div>Mã hóa đơn: <span className="bold">{order.code}</span></div>
                    <div>Ngày: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</div>
                </div>
            </div>
        </div>

        {/* Customer Info */}
        <div style={{ marginBottom: 32, padding: '16px', background: '#f8f9fa', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>KHÁCH HÀNG</div>
                    <div className="bold" style={{ fontSize: 16 }}>{customer ? customer.name : 'Khách lẻ'}</div>
                    {customer && (
                        <div style={{ fontSize: 14, marginTop: 4 }}>
                            <div>SĐT: {customer.phone}</div>
                            <div>ĐC: {customer.address}</div>
                        </div>
                    )}
                </div>
                <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>GIAO HÀNG ĐẾN</div>
                    <div style={{ fontSize: 14 }}>
                        {order.fulfillmentLocationId ? (
                             // Logic to show warehouse/location if needed, but usually delivery address
                             // If internal order, maybe different.
                             // For now, assume customer address or specific delivery address if we had it.
                             customer?.address || 'Tại cửa hàng'
                        ) : (
                            customer?.address || 'Tại cửa hàng'
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Items Table */}
        <table>
            <thead>
                <tr>
                    <th style={{ width: 40 }}>STT</th>
                    <th>Sản phẩm</th>
                    <th className="text-center" style={{ width: 80 }}>ĐVT</th>
                    <th className="text-center" style={{ width: 80 }}>SL</th>
                    <th className="text-right" style={{ width: 120 }}>Đơn giá</th>
                    <th className="text-right" style={{ width: 120 }}>Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                {order.items.map((item, index) => {
                    const sku = skusById.get(item.skuId)
                    const product = sku ? productsById.get(sku.productId) : null
                    const name = product ? product.name : 'Sản phẩm'
                    const variant = sku ? [sku.color, sku.size].filter(Boolean).join(' - ') : ''
                    const fullName = variant ? `${name} (${variant})` : name
                    
                    return (
                        <tr key={index}>
                            <td className="text-center">{index + 1}</td>
                            <td>
                                <div className="bold">{fullName}</div>
                                {sku && <div style={{ fontSize: 12, color: '#666' }}>{sku.skuCode}</div>}
                            </td>
                            <td className="text-center">{sku?.unit || 'Cái'}</td>
                            <td className="text-center">{item.qty}</td>
                            <td className="text-right">{formatVnd(item.price)}</td>
                            <td className="text-right">{formatVnd(item.qty * item.price)}</td>
                        </tr>
                    )
                })}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={5} className="text-right bold">Tổng tiền hàng</td>
                    <td className="text-right">{formatVnd(subTotal)}</td>
                </tr>
                {order.shippingFee > 0 && (
                    <tr>
                        <td colSpan={5} className="text-right">Phí vận chuyển</td>
                        <td className="text-right">{formatVnd(order.shippingFee)}</td>
                    </tr>
                )}
                {order.discountAmount > 0 && (
                    <tr>
                        <td colSpan={5} className="text-right">Chiết khấu</td>
                        <td className="text-right">-{formatVnd(order.discountAmount)}</td>
                    </tr>
                )}
                 {/* VAT, Other fees if applicable */}
                 <tr style={{ fontSize: 16 }}>
                    <td colSpan={5} className="text-right bold">TỔNG CỘNG</td>
                    <td className="text-right bold" style={{ color: '#007bff' }}>{formatVnd(total)}</td>
                </tr>
            </tfoot>
        </table>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60, textAlign: 'center' }}>
            <div style={{ width: '30%' }}>
                <div className="bold">Người mua hàng</div>
                <div style={{ fontSize: 12, fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
            </div>
            <div style={{ width: '30%' }}>
                <div className="bold">Người bán hàng</div>
                <div style={{ fontSize: 12, fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
            </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 80, fontSize: 12, color: '#888' }}>
            Cảm ơn quý khách đã mua hàng!
        </div>
      </div>
    </div>
  )
}

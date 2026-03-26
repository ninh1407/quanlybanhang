import { Order, Customer, User } from '../../shared/types/domain'
import { formatNumber } from '../../shared/lib/money'

export function printOrder(
  order: Order, 
  items: Array<{ name: string; unit: string; qty: number; price: number; total: number }>,
  customer: Customer | null,
  user: User | null
) {
  const date = new Date(order.createdAt)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  // Calculate total amount
  const itemsTotal = items.reduce((acc, item) => acc + item.total, 0)
  const totalAmount = itemsTotal + (order.shippingFee || 0)
  const totalQty = items.reduce((acc, item) => acc + item.qty, 0)

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu Xuất Kho - ${order.code}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.3; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
        .date { font-style: italic; margin-bottom: 15px; text-align: center; }
        .info-row { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
        th, td { border: 1px solid black; padding: 5px; vertical-align: middle; }
        th { text-align: center; font-weight: bold; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
        .sig-block { flex: 1; }
        .sig-title { font-weight: bold; margin-bottom: 5px; }
        .sig-note { font-style: italic; font-size: 11pt; }
        @media print {
          @page { size: A4; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">PHIẾU XUẤT KHO</div>
        <div class="date">Ngày ${day} tháng ${month} năm ${year}</div>
      </div>

      <div class="info-row">
        Họ và tên người nhận hàng: <b>${customer ? customer.name : 'Khách lẻ'}</b> ${customer && customer.phone ? `- SĐT : ${customer.phone}` : ''}
      </div>
      <div class="info-row">
        Địa chỉ nhận hàng : ${customer ? customer.address || '' : ''} ${order.note ? `(${order.note})` : ''}
      </div>
      <div class="info-row">
        SDT: ${customer ? customer.phone : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px">STT</th>
            <th>Tên, nhãn hiệu, quy cách,<br>phẩm chất vật tư, dụng cụ,...</th>
            <th style="width: 80px">Đơn vị<br>tính</th>
            <th style="width: 60px">Số lượng</th>
            <th style="width: 100px">Đơn giá</th>
            <th style="width: 120px">Thành tiền</th>
            <th style="width: 100px">ghi chú</th>
          </tr>
          <tr>
            <td class="center">(1)</td>
            <td class="center">(2)</td>
            <td class="center">(4)</td>
            <td class="center">(5)</td>
            <td class="center">(6)</td>
            <td class="center">(7)</td>
            <td class="center"></td>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td class="center">${index + 1}</td>
              <td>${item.name}</td>
              <td class="center">${item.unit}</td>
              <td class="center">${item.qty}</td>
              <td class="right">${formatNumber(item.price)}</td>
              <td class="right">${formatNumber(item.total)}</td>
              <td></td>
            </tr>
          `).join('')}
          
          ${order.shippingFee > 0 ? `
            <tr>
              <td class="center">${items.length + 1}</td>
              <td>Phí vận chuyển</td>
              <td class="center"></td>
              <td class="center">1</td>
              <td class="right">${formatNumber(order.shippingFee)}</td>
              <td class="right">${formatNumber(order.shippingFee)}</td>
              <td></td>
            </tr>
          ` : ''}

          <!-- Empty rows filler if needed -->
          <tr>
             <td class="center">${items.length + (order.shippingFee > 0 ? 2 : 1)}</td>
             <td></td>
             <td></td>
             <td></td>
             <td></td>
             <td></td>
             <td></td>
          </tr>

          <tr class="bold">
            <td colspan="3" class="center">Tổng cộng</td>
            <td class="center">${totalQty + (order.shippingFee > 0 ? 1 : 0)}</td>
            <td></td>
            <td class="right">${formatNumber(totalAmount)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-block">
          <div class="sig-title">Người lập phiếu</div>
          <div class="sig-note">(Ký, họ tên)</div>
          <div style="margin-top: 80px">${user ? user.fullName : ''}</div>
        </div>
        <div class="sig-block">
          <div class="sig-title">Người giao hàng</div>
          <div class="sig-note">(Ký, họ tên)</div>
        </div>
        <div class="sig-block">
          <div class="sig-title">Người nhận hàng</div>
          <div class="sig-note">(Ký, họ tên)</div>
        </div>
      </div>
    </body>
    </html>
  `

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    // w.setTimeout(() => w.print(), 500)
  }
}

import type { OrderStatus, Role } from './types'

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Nháp',
  confirmed: 'Xác nhận',
  paid: 'Đã thanh toán',
  picking: 'Đang lấy hàng',
  packed: 'Đã lấy hàng',
  ready_to_ship: 'Đã đóng gói',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  returned: 'Hoàn',
  cancelled: 'Hủy',
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ['draft', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'paid', 'picking', 'packed', 'cancelled'],
  paid: ['paid', 'picking', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'returned'],
  picking: ['picking', 'packed', 'cancelled'],
  packed: ['packed', 'ready_to_ship', 'shipped', 'delivered', 'returned'],
  ready_to_ship: ['ready_to_ship', 'shipped', 'delivered', 'returned'],
  shipped: ['shipped', 'delivered', 'returned'],
  delivered: ['delivered', 'returned'],
  returned: ['returned'],
  cancelled: ['cancelled'],
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from]?.includes(to) ?? false
}

export function getAllowedNextOrderStatuses(current: OrderStatus): OrderStatus[] {
  return transitions[current] ?? [current]
}

export function canChangeOrderStatus(role: Role): boolean {
  return role === 'admin' || role === 'staff'
}


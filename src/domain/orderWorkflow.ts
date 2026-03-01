import type { OrderStatus, Role } from './types'

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Nháp',
  confirmed: 'Xác nhận',
  paid: 'Đã thanh toán',
  packed: 'Đóng gói',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  returned: 'Hoàn',
  cancelled: 'Hủy',
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ['draft', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'paid', 'packed', 'cancelled'],
  paid: ['paid', 'packed', 'shipped', 'delivered', 'returned'],
  packed: ['packed', 'shipped', 'delivered', 'returned'],
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


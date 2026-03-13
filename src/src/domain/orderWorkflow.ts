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
  pending_cancel: 'Chờ hủy',
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ['draft', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'paid', 'picking', 'packed', 'cancelled', 'pending_cancel'],
  paid: ['paid', 'picking', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'returned', 'pending_cancel'],
  picking: ['picking', 'packed', 'cancelled', 'pending_cancel'],
  packed: ['packed', 'ready_to_ship', 'shipped', 'delivered', 'returned', 'pending_cancel'],
  ready_to_ship: ['ready_to_ship', 'shipped', 'delivered', 'returned', 'pending_cancel'],
  shipped: ['shipped', 'delivered', 'returned', 'pending_cancel'],
  delivered: ['delivered', 'returned', 'pending_cancel'],
  returned: ['returned'],
  cancelled: ['cancelled'],
  pending_cancel: ['pending_cancel', 'cancelled', 'confirmed'],
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


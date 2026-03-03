import type { Permission, Role } from './types'

type PermissionAction = 'read' | 'write'

type PermissionGroup = {
  moduleKey: string
  moduleLabel: string
  actions: {
    code: Permission
    action: PermissionAction
    label: string
    detail: string
  }[]
}

const moduleOrder = ['dashboard', 'products', 'orders', 'inventory', 'finance', 'customers', 'staff']

const moduleLabels: Record<string, string> = {
  dashboard: 'Tổng quan',
  products: 'Sản phẩm',
  orders: 'Đơn hàng',
  inventory: 'Kho',
  finance: 'Tài chính',
  customers: 'Khách hàng',
  staff: 'Nhân sự',
}

const actionLabels: Record<PermissionAction, { label: string; detail: string }> = {
  read: { label: 'Xem', detail: 'Xem/Tra cứu' },
  write: { label: 'Quản lý', detail: 'Thêm/Sửa/Xóa/Cập nhật' },
}

function parsePermission(p: Permission): { moduleKey: string; action: PermissionAction } {
  const [moduleKey, actionRaw] = p.split(':')
  const action = (actionRaw === 'write' ? 'write' : 'read') as PermissionAction
  return { moduleKey, action }
}

export function groupPermissions(perms: Permission[]): PermissionGroup[] {
  const m = new Map<string, PermissionGroup>()
  perms.forEach((code) => {
    const parsed = parsePermission(code)
    const moduleLabel = moduleLabels[parsed.moduleKey] ?? parsed.moduleKey
    const g = m.get(parsed.moduleKey) ?? { moduleKey: parsed.moduleKey, moduleLabel, actions: [] }
    const meta = actionLabels[parsed.action]
    g.actions.push({ code, action: parsed.action, label: meta.label, detail: meta.detail })
    m.set(parsed.moduleKey, g)
  })

  const list = Array.from(m.values())
  list.forEach((g) => {
    g.actions.sort((a, b) => {
      const ra = a.action === 'read' ? 0 : 1
      const rb = b.action === 'read' ? 0 : 1
      if (ra !== rb) return ra - rb
      return a.code.localeCompare(b.code)
    })
  })

  list.sort((a, b) => {
    const ia = moduleOrder.indexOf(a.moduleKey)
    const ib = moduleOrder.indexOf(b.moduleKey)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    return a.moduleKey.localeCompare(b.moduleKey)
  })
  return list
}

export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'dashboard:read',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'finance:read',
    'finance:write',
    'customers:read',
    'customers:write',
    'staff:read',
    'staff:write',
  ],
  manager: [
    'dashboard:read',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'finance:read',
    'finance:write',
    'customers:read',
    'customers:write',
    'staff:read',
  ],
  region_manager: [
    'dashboard:read',
    'products:read',
    'orders:read',
    'inventory:read',
    'inventory:write',
    'finance:read',
    'customers:read',
    'staff:read',
  ],
  staff: [
    'dashboard:read',
    'products:read',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'customers:read',
    'customers:write',
  ],
  accountant: [
    'dashboard:read',
    'products:read',
    'orders:read',
    'inventory:read',
    'finance:read',
    'finance:write',
    'customers:read',
  ]
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission)
}

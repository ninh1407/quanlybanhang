import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { RequirePermission } from '../auth/RequirePermission'
import { useAuth } from '../auth/auth'
import { useTheme } from '../ui-kit/ThemeProvider'
import { UpdateManager } from '../ui-kit/UpdateManager'
import { ErrorBoundary } from './ErrorBoundary'
import {
  LayoutDashboard,
  Package,
  Layers,
  Truck,
  FileText,
  Users,
  Box,
  MapPin,
  ClipboardList,
  Component,
  DollarSign,
  UserCog,
  Key,
  LogOut,
  ChevronDown,
  ChevronRight,
  User,
  Store,
  Moon,
  Sun,
  Search,
  Plus,
  RefreshCw,
  Settings,
  Bell
} from 'lucide-react'
import { useNotifications } from '../notifications/useNotifications'
import { useAppState } from '../state/Store'

function NavItem(props: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
    >
      {props.icon && <span style={{ marginRight: 10 }}>{props.icon}</span>}
      {props.label}
    </NavLink>
  )
}

function NavGroup(props: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="nav-group">
      <button type="button" className="nav-group-title" onClick={props.onToggle}>
        <span>{props.title}</span>
        <span className="nav-group-caret">
          {props.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {props.open ? <div className="nav-group-items">{props.children}</div> : null}
    </div>
  )
}

function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Nhân sự'
  return role
}

export function AdminLayout() {
  const { user, logout, can } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const nav = useNavigate()
  const { unreadCount } = useNotifications()
  const state = useAppState()
  const currentLocation = useMemo(() => {
    const id = state.currentLocationId
    if (!id) return null
    return state.locations.find((l) => l.id === id) ?? null
  }, [state.currentLocationId, state.locations])
  const groupInitial = useMemo(() => {
    const map: Record<string, boolean> = { products: true, sales: true, inventory: true, finance: true, staff: true }
    try {
      const raw = localStorage.getItem('nav_groups_v1')
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>
        Object.keys(map).forEach((k) => {
          const v = o[k]
          if (typeof v === 'boolean') map[k] = v
        })
      }
    } catch {
      void 0
    }
    return map
  }, [])
  const [groups, setGroups] = useState(groupInitial)
  const [quickOpen, setQuickOpen] = useState(false)
  function toggleGroup(key: keyof typeof groups) {
    const next = { ...groups, [key]: !groups[key] }
    setGroups(next)
    try {
      localStorage.setItem('nav_groups_v1', JSON.stringify(next))
    } catch {
      void 0
    }
  }

  const quickActions = useMemo(() => {
    const actions: { key: string; label: string; to: string; show: boolean; icon: React.ReactNode }[] = [
      { key: 'order', label: 'Tạo đơn hàng', to: '/orders', show: can('orders:write'), icon: <FileText size={16} /> },
      { key: 'customer', label: 'Thêm khách hàng', to: '/customers', show: can('customers:write'), icon: <Users size={16} /> },
      { key: 'product', label: 'Thêm sản phẩm', to: '/products', show: can('products:write'), icon: <Package size={16} /> },
      { key: 'stockCount', label: 'Tạo phiếu kiểm kho', to: '/stock-counts', show: can('inventory:write'), icon: <ClipboardList size={16} /> },
    ]
    return actions.filter((a) => a.show)
  }, [can])

  useEffect(() => {
    if (!quickOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [quickOpen])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-title">
          <Store size={24} style={{ marginRight: 10, color: 'var(--primary-400)' }} />
          Quản lý gia dụng
        </div>
        <nav className="nav">
          <RequirePermission permission="dashboard:read">
            <NavItem to="/dashboard" label="Tổng quan" icon={<LayoutDashboard size={18} />} />
          </RequirePermission>

          {can('products:read') ? (
            <NavGroup title="Sản phẩm" open={groups.products} onToggle={() => toggleGroup('products')}>
              <RequirePermission permission="products:read">
                <NavItem to="/products" label="Danh sách sản phẩm" icon={<Package size={18} />} />
              </RequirePermission>
              <RequirePermission permission="products:read">
                <NavItem to="/categories" label="Danh mục" icon={<Layers size={18} />} />
              </RequirePermission>
              <RequirePermission permission="products:read">
                <NavItem to="/suppliers" label="Thương hiệu" icon={<Truck size={18} />} />
              </RequirePermission>
            </NavGroup>
          ) : null}

          {can('orders:read') || can('customers:read') ? (
            <NavGroup title="Bán hàng" open={groups.sales} onToggle={() => toggleGroup('sales')}>
              <RequirePermission permission="orders:read">
            <NavItem to="/orders" label="Đơn hàng" icon={<FileText size={18} />} />
          </RequirePermission>
              <RequirePermission permission="customers:read">
                <NavItem to="/customers" label="Khách hàng" icon={<Users size={18} />} />
              </RequirePermission>
            </NavGroup>
          ) : null}

          {can('inventory:read') ? (
            <NavGroup title="Kho" open={groups.inventory} onToggle={() => toggleGroup('inventory')}>
              <RequirePermission permission="inventory:read">
                <NavItem to="/inventory" label="Tồn kho" icon={<Box size={18} />} />
              </RequirePermission>
              <RequirePermission permission="inventory:read">
                <NavItem to="/stock-vouchers" label="Phiếu kho" icon={<FileText size={18} />} />
              </RequirePermission>
              {user?.role === 'admin' ? (
                <RequirePermission permission="inventory:read">
                  <NavItem to="/locations" label="Vị trí kho" icon={<MapPin size={18} />} />
                </RequirePermission>
              ) : null}
              <RequirePermission permission="inventory:read">
                <NavItem to="/stock-counts" label="Kiểm kho" icon={<ClipboardList size={18} />} />
              </RequirePermission>
              <RequirePermission permission="inventory:read">
                <NavItem to="/materials" label="Vật tư" icon={<Component size={18} />} />
              </RequirePermission>
            </NavGroup>
          ) : null}

          {can('finance:read') ? (
            <NavGroup title="Tài chính" open={groups.finance} onToggle={() => toggleGroup('finance')}>
              <RequirePermission permission="finance:read">
                <NavItem to="/finance/overview" label="Tổng quan" icon={<DollarSign size={18} />} />
              </RequirePermission>
              <RequirePermission permission="finance:read">
                <NavItem to="/finance/cashflow" label="Dòng tiền" icon={<DollarSign size={18} />} />
              </RequirePermission>
              <RequirePermission permission="finance:read">
                <NavItem to="/finance/debts" label="Công nợ" icon={<DollarSign size={18} />} />
              </RequirePermission>
            </NavGroup>
          ) : null}

          {can('staff:read') ? (
            <NavGroup title="Nhân sự" open={groups.staff} onToggle={() => toggleGroup('staff')}>
              <RequirePermission permission="staff:read">
                <NavItem to="/staff" label="Phân quyền" icon={<UserCog size={18} />} />
              </RequirePermission>
              <RequirePermission permission="staff:read">
                <NavItem to="/audit" label="Nhật ký" icon={<FileText size={18} />} />
              </RequirePermission>
              <RequirePermission permission="staff:read">
                <NavItem to="/settings" label="Cấu hình" icon={<Settings size={18} />} />
              </RequirePermission>
            </NavGroup>
          ) : null}

          <NavItem to="/license" label="Bản quyền" icon={<Key size={18} />} />
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
             <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
               <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
               <input 
                 placeholder="Tìm kiếm SKU, Đơn hàng, Khách hàng..." 
                 style={{ 
                   paddingLeft: 36, 
                   background: 'var(--neutral-100)', 
                   border: 'none',
                   width: '100%'
                 }} 
               />
             </div>
          </div>
          <div className="topbar-right" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {currentLocation ? (
              <button
                className="btn btn-small"
                onClick={() => nav('/select-warehouse', { state: { from: window.location.hash.replace('#', '') || '/' } })}
                title="Đổi kho"
              >
                <MapPin size={16} />
                {currentLocation.code}
              </button>
            ) : null}
            <button
              onClick={() => nav('/notifications')}
              className="btn btn-small"
              title="Thông báo"
              style={{ position: 'relative', overflow: 'visible' }}
            >
              <Bell size={16} />
              {unreadCount > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    background: 'var(--danger)',
                    color: 'white',
                    borderRadius: 999,
                    padding: '2px 6px',
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => {
                if (!window.desktop) return
                window.dispatchEvent(new Event('app:update:open'))
              }}
              className="btn btn-small"
              title="Kiểm tra cập nhật"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={toggleTheme} 
              className="btn btn-small" 
              style={{ borderRadius: '50%', width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Chuyển chế độ Sáng/Tối"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            {user ? (
              <>
                <div className="user-chip">
                  <User size={16} />
                  {user.fullName} ({roleLabel(user.role)})
                </div>
                <button className="btn" onClick={logout}>
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </>
            ) : null}
          </div>
        </header>
        <div className="content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
        
        {/* Quick Action FAB */}
        {quickActions.length ? (
          <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 100 }}>
            {quickOpen ? (
              <div
                style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 99 }}
                onClick={() => setQuickOpen(false)}
              />
            ) : null}

            {quickOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 72,
                  width: 240,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-lg)',
                  padding: 8,
                  zIndex: 101,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 10px' }}>Tạo nhanh</div>
                {quickActions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQuickOpen(false)
                      nav(a.to)
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      border: 'none',
                      background: 'transparent',
                      padding: '10px 12px',
                    }}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setQuickOpen((v) => !v)}
              style={{
                borderRadius: '50%',
                width: 56,
                height: 56,
                padding: 0,
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Tạo nhanh"
            >
              <Plus size={28} />
            </button>
          </div>
        ) : null}
        <UpdateManager />
      </main>
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Package, ShoppingCart, User, FileText } from 'lucide-react'
import { useStore } from '../state/Store'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { state } = useStore() // Access global state for search

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
        setQuery('')
    }
  }, [open])

  if (!open) return null

  // Search Logic
  const lowerQuery = query.toLowerCase()
  
  // 1. Navigation
  const pages = [
    { name: 'Tổng quan', path: '/', icon: <ArrowRight size={14} /> },
    { name: 'Đơn hàng', path: '/orders', icon: <ShoppingCart size={14} /> },
    { name: 'Kho vận', path: '/inventory', icon: <Package size={14} /> },
    { name: 'Sản phẩm', path: '/products', icon: <Package size={14} /> },
    { name: 'Khách hàng', path: '/customers', icon: <User size={14} /> },
    { name: 'Tài chính', path: '/finance', icon: <FileText size={14} /> },
  ].filter(p => p.name.toLowerCase().includes(lowerQuery))

  // 2. Orders (Top 5 matching)
  const customerMap = new Map(state.customers.map(c => [c.id, c.name]))
  const orders = (state.orders || [])
    .filter(o => {
        const cName = customerMap.get(o.customerId || '') || ''
        return o.code.toLowerCase().includes(lowerQuery) || cName.toLowerCase().includes(lowerQuery)
    })
    .slice(0, 5)
    .map(o => ({
        id: o.id,
        name: `${o.code} - ${customerMap.get(o.customerId || '') || 'Unknown'}`,
        path: `/orders`, // Navigate to orders list for now, as detail page might not exist or be generic
        type: 'Order'
    }))

  // 3. Products (Top 5 matching)
  const products = (state.products || [])
    .filter(p => {
        if (p.name.toLowerCase().includes(lowerQuery)) return true
        const pSkus = state.skus.filter(s => s.productId === p.id)
        return pSkus.some(s => s.skuCode.toLowerCase().includes(lowerQuery))
    })
    .slice(0, 5)
    .map(p => ({
        id: p.id,
        name: p.name,
        path: `/products`, // Navigate to products list
        type: 'Product'
    }))

  const allItems = [...pages, ...orders, ...products]

  const handleSelect = (path: string) => {
      navigate(path)
      setOpen(false)
  }

  return (
    <div 
        style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
        }}
        onClick={() => setOpen(false)}
    >
      <div 
        style={{
            width: '100%',
            maxWidth: 600,
            background: 'var(--bg-surface)',
            borderRadius: 12,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <Search size={20} style={{ color: 'var(--text-muted)', marginRight: 12 }} />
          <input
            ref={inputRef}
            style={{
                flex: 1,
                fontSize: 16,
                outline: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-main)',
                padding: 0,
            }}
            placeholder="Tìm kiếm nhanh (Đơn hàng, SKU, Khách hàng)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: 'var(--text-muted)', 
              background: 'var(--neutral-100)', 
              padding: '2px 6px', 
              borderRadius: 4, 
              border: '1px solid var(--border-color)' 
          }}>ESC</kbd>
        </div>
        
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px 0' }}>
            {pages.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Điều hướng</div>
                    {pages.map((item) => (
                        <div 
                            key={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleSelect(item.path)}
                        >
                            <span style={{ marginRight: 12, color: 'var(--text-muted)' }}>{item.icon}</span>
                            {item.name}
                        </div>
                    ))}
                </div>
            )}

            {orders.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Đơn hàng</div>
                    {orders.map((item) => (
                        <div 
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleSelect(item.path)}
                        >
                            <ShoppingCart size={14} style={{ marginRight: 12, color: 'var(--info)' }} />
                            {item.name}
                        </div>
                    ))}
                </div>
            )}

            {products.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sản phẩm</div>
                    {products.map((item) => (
                        <div 
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: 'var(--text-main)',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleSelect(item.path)}
                        >
                            <Package size={14} style={{ marginRight: 12, color: 'var(--success)' }} />
                            {item.name}
                        </div>
                    ))}
                </div>
            )}
            
            {allItems.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Không tìm thấy kết quả cho "{query}"
                </div>
            )}
        </div>
        
        <div style={{ padding: '8px 16px', background: 'var(--neutral-50)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Sử dụng phím mũi tên để di chuyển, Enter để chọn</span>
            <span>Hệ thống tìm kiếm thông minh</span>
        </div>
      </div>
    </div>
  )
}

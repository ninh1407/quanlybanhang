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
    { name: 'Dashboard', path: '/', icon: <ArrowRight size={14} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingCart size={14} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={14} /> },
    { name: 'Products', path: '/products', icon: <Package size={14} /> },
    { name: 'Customers', path: '/customers', icon: <User size={14} /> },
    { name: 'Finance', path: '/finance', icon: <FileText size={14} /> },
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
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm transition-all" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-100" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 text-lg outline-none placeholder:text-gray-400 bg-transparent dark:text-white"
            placeholder="Type a command or search... (Orders, SKUs, Customers)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">ESC</kbd>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2">
            {pages.length > 0 && (
                <div className="mb-2">
                    <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</div>
                    {pages.map((item) => (
                        <div 
                            key={item.path}
                            className="flex items-center px-4 py-2 mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200 transition-colors"
                            onClick={() => handleSelect(item.path)}
                        >
                            <span className="mr-3 text-gray-400">{item.icon}</span>
                            {item.name}
                        </div>
                    ))}
                </div>
            )}

            {orders.length > 0 && (
                <div className="mb-2">
                    <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Orders</div>
                    {orders.map((item) => (
                        <div 
                            key={item.id}
                            className="flex items-center px-4 py-2 mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200 transition-colors"
                            onClick={() => handleSelect(item.path)}
                        >
                            <ShoppingCart size={14} className="mr-3 text-blue-500" />
                            {item.name}
                        </div>
                    ))}
                </div>
            )}

            {products.length > 0 && (
                <div className="mb-2">
                    <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Products</div>
                    {products.map((item) => (
                        <div 
                            key={item.id}
                            className="flex items-center px-4 py-2 mx-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200 transition-colors"
                            onClick={() => handleSelect(item.path)}
                        >
                            <Package size={14} className="mr-3 text-green-500" />
                            {item.name}
                        </div>
                    ))}
                </div>
            )}
            
            {allItems.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                    No results found for "{query}"
                </div>
            )}
        </div>
        
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>ProTip: Use arrows to navigate, Enter to select</span>
            <span>Powered by Enterprise Search</span>
        </div>
      </div>
    </div>
  )
}

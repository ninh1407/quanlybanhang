import { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number | string
}

export function Drawer({ open, onClose, title, children, footer, width }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <div 
        className={`drawer-overlay ${open ? 'open' : ''}`} 
        onClick={onClose}
      />
      <div 
        className={`drawer ${open ? 'open' : ''}`}
        style={width ? { maxWidth: width } : undefined}
      >
        <div className="drawer-header">
          <div className="drawer-title">{title}</div>
          <button 
            className="btn btn-small" 
            style={{ border: 'none', background: 'transparent', padding: 8 }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

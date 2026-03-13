import { X } from 'lucide-react'
import React, { useEffect } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number | string
}

export function Modal({ open, onClose, title, children, footer, width = 500 }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      window.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 100, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'rgba(0,0,0,0.5)', 
        backdropFilter: 'blur(2px)',
        animation: 'fadeIn 0.2s ease-out'
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          background: 'var(--bg-surface)', 
          borderRadius: 12, 
          width: width, 
          maxWidth: '90vw', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          animation: 'slideUp 0.2s ease-out'
        }} 
        onClick={e => e.stopPropagation()}
      >
         <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {title}
            <button onClick={onClose} className="btn-icon" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
         </div>
         <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            {children}
         </div>
         {footer && <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-subtle)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>{footer}</div>}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

export function PageHeader(props: { title: string; subtitle?: string; actions?: ReactNode; onBack?: () => void }) {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {props.onBack && (
            <button className="btn btn-ghost btn-icon" onClick={props.onBack}>
                <ArrowLeft size={20} />
            </button>
        )}
        <div>
            <div className="page-title">{props.title}</div>
            {props.subtitle ? <div className="page-subtitle">{props.subtitle}</div> : null}
        </div>
      </div>
      {props.actions ? <div className="page-actions">{props.actions}</div> : null}
    </div>
  )
}

import type { ReactNode } from 'react'

export function PageHeader(props: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{props.title}</div>
        {props.subtitle ? <div className="page-subtitle">{props.subtitle}</div> : null}
      </div>
      {props.actions ? <div className="page-actions">{props.actions}</div> : null}
    </div>
  )
}

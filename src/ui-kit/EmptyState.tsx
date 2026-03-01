import type { ReactNode } from 'react'

export function EmptyState(props: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{props.title}</div>
      {props.hint ? <div className="empty-hint">{props.hint}</div> : null}
      {props.action ? <div className="empty-action">{props.action}</div> : null}
    </div>
  )
}

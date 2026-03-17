import type { ReactNode } from 'react'

export function FilterBar(props: { left?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        <div className="filter-bar-left">{props.left ?? props.children}</div>
        {props.right ? <div className="filter-bar-right">{props.right}</div> : null}
      </div>
    </div>
  )
}


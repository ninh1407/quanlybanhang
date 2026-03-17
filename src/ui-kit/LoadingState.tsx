export function LoadingState(props: { title?: string; rows?: number }) {
  const rows = Math.max(1, Math.min(12, props.rows ?? 6))
  return (
    <div className="loading">
      {props.title ? <div className="loading-title">{props.title}</div> : null}
      <div className="loading-body">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="skeleton" />
        ))}
      </div>
    </div>
  )
}


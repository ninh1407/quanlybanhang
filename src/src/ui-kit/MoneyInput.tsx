import type { CSSProperties } from 'react'

export function MoneyInput(props: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  placeholder?: string
  suffix?: string
}) {
  const suffix = props.suffix ?? '₫'
  const raw = Number.isFinite(props.value) && props.value !== 0 ? String(Math.max(0, Math.trunc(props.value))) : ''

  const wrapStyle: CSSProperties = { position: 'relative' }
  const suffixStyle: CSSProperties = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    pointerEvents: 'none',
  }

  return (
    <div style={wrapStyle}>
      <input
        value={raw}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D+/g, '')
          const next = digits ? Number(digits) : 0
          props.onChange(Number.isFinite(next) ? next : 0)
        }}
        onBlur={(e) => {
          const digits = e.currentTarget.value.replace(/\D+/g, '')
          const next = digits ? Number(digits) : 0
          props.onChange(Number.isFinite(next) ? next : 0)
        }}
        inputMode="numeric"
        placeholder={props.placeholder}
        disabled={props.disabled}
        style={{ paddingRight: 40 }}
      />
      <span style={suffixStyle}>{suffix}</span>
    </div>
  )
}


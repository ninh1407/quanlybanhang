import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type ConfirmOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  dangerous?: boolean
}

type AlertOptions = {
  title?: string
  message: string
  okText?: string
}

type PromptOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  placeholder?: string
  initialValue?: string
  required?: boolean
}

type DialogState =
  | null
  | ({ kind: 'confirm' } & Required<Pick<ConfirmOptions, 'message'>> & {
      title: string
      confirmText: string
      cancelText: string
      dangerous: boolean
    })
  | ({ kind: 'alert' } & Required<Pick<AlertOptions, 'message'>> & {
      title: string
      okText: string
    })
  | ({ kind: 'prompt' } & Required<Pick<PromptOptions, 'message'>> & {
      title: string
      confirmText: string
      cancelText: string
      placeholder: string
      initialValue: string
      required: boolean
    })

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  alert: (opts: AlertOptions) => Promise<void>
  prompt: (opts: PromptOptions) => Promise<string | null>
}

const DialogContext = createContext<DialogApi | null>(null)

export function DialogProvider(props: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const resolveRef = useRef<((v: any) => void) | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const close = useCallback((value: unknown) => {
    const r = resolveRef.current
    resolveRef.current = null
    setDialog(null)
    setPromptValue('')
    if (r) r(value)
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions) => {
      const title = opts.title?.trim() ? opts.title.trim() : 'Thông báo'
      const confirmText = opts.confirmText?.trim() ? opts.confirmText.trim() : 'OK'
      const cancelText = opts.cancelText?.trim() ? opts.cancelText.trim() : 'Cancel'
      const dangerous = Boolean(opts.dangerous)
      setDialog({ kind: 'confirm', title, message: opts.message, confirmText, cancelText, dangerous })
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve
      })
    },
    [],
  )

  const alert = useCallback(
    (opts: AlertOptions) => {
      const title = opts.title?.trim() ? opts.title.trim() : 'Thông báo'
      const okText = opts.okText?.trim() ? opts.okText.trim() : 'OK'
      setDialog({ kind: 'alert', title, message: opts.message, okText })
      return new Promise<void>((resolve) => {
        resolveRef.current = resolve
      })
    },
    [],
  )

  const prompt = useCallback(
    (opts: PromptOptions) => {
      const title = opts.title?.trim() ? opts.title.trim() : 'Thông báo'
      const confirmText = opts.confirmText?.trim() ? opts.confirmText.trim() : 'OK'
      const cancelText = opts.cancelText?.trim() ? opts.cancelText.trim() : 'Cancel'
      const placeholder = opts.placeholder ?? ''
      const initialValue = opts.initialValue ?? ''
      const required = Boolean(opts.required)
      setPromptValue(initialValue)
      setDialog({ kind: 'prompt', title, message: opts.message, confirmText, cancelText, placeholder, initialValue, required })
      return new Promise<string | null>((resolve) => {
        resolveRef.current = resolve
      })
    },
    [],
  )

  const api = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt])

  useEffect(() => {
    if (!dialog) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!dialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close(dialog.kind === 'alert' ? undefined : dialog.kind === 'prompt' ? null : false)
        return
      }
      if (e.key === 'Enter') {
        if (dialog.kind === 'prompt') {
          const next = promptValue
          if (dialog.required && !next.trim()) return
          e.preventDefault()
          close(next)
          return
        }
        if (dialog.kind === 'confirm') {
          e.preventDefault()
          close(true)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, dialog, promptValue])

  useEffect(() => {
    if (!dialog) return
    if (dialog.kind !== 'prompt') return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [dialog])

  return (
    <DialogContext.Provider value={api}>
      {props.children}
      {dialog ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 5000,
          }}
          onClick={() => close(dialog.kind === 'alert' ? undefined : dialog.kind === 'prompt' ? null : false)}
        >
          <div
            style={{
              width: 520,
              maxWidth: '95vw',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              padding: 16,
              color: 'var(--text-main)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="row row-between" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{dialog.title}</div>
              <button
                className="btn btn-small"
                onClick={() => close(dialog.kind === 'alert' ? undefined : dialog.kind === 'prompt' ? null : false)}
                style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
                aria-label="Đóng"
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '8px 4px 14px', fontSize: 14 }}>{dialog.message}</div>

            {dialog.kind === 'prompt' ? (
              <div className="field" style={{ marginTop: 6 }}>
                <input
                  ref={(el) => {
                    inputRef.current = el
                  }}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={dialog.placeholder}
                />
              </div>
            ) : null}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              {dialog.kind === 'alert' ? null : (
                <button className="btn" onClick={() => close(dialog.kind === 'prompt' ? null : false)}>
                  {dialog.cancelText}
                </button>
              )}
              <button
                className={dialog.kind === 'confirm' && dialog.dangerous ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => {
                  if (dialog.kind === 'prompt') {
                    const next = promptValue
                    if (dialog.required && !next.trim()) return
                    close(next)
                    return
                  }
                  if (dialog.kind === 'confirm') {
                    close(true)
                    return
                  }
                  close(undefined)
                }}
              >
                {dialog.kind === 'alert' ? dialog.okText : dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  )
}

export function useDialogs(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('DialogProvider is missing')
  return ctx
}

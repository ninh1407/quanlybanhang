import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

// Define the shape of window.desktop for TypeScript
declare global {
  interface Window {
    desktop?: {
      platform: string
      getHwid: () => Promise<string>
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<unknown>
      downloadUpdate: () => Promise<unknown>
      installUpdate: () => Promise<void>
      onUpdateAvailable: (cb: (info: unknown) => void) => void
      onUpdateNotAvailable: (cb: (info: unknown) => void) => void
      onUpdateProgress: (cb: (progress: unknown) => void) => void
      onUpdateDownloaded: (cb: (info: unknown) => void) => void
      onUpdateError: (cb: (err: unknown) => void) => void
    }
  }
}

type UpdateInfo = { version?: string }
type UpdateProgress = { percent?: number }

export function UpdateManager() {
  const hasDesktop = Boolean(window.desktop)
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState('')
  const [show, setShow] = useState(false)

  const normalizeUpdateError = (err: unknown): string => {
    const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err)
    if (/No published versions on GitHub/i.test(msg)) {
      return 'Chưa có bản phát hành (Release) trên GitHub. Hãy tạo Release (Publish, không để Draft) và upload đủ 3 file: Setup.exe, latest.yml, Setup.exe.blockmap.'
    }
    if (/net::ERR_INTERNET_DISCONNECTED/i.test(msg)) return 'Không có kết nối Internet.'
    if (/ETIMEDOUT|timeout/i.test(msg)) return 'Kết nối tới GitHub bị timeout.'
    if (/403|Forbidden/i.test(msg)) return 'Bị chặn quyền truy cập GitHub (403). Nếu repo private cần token.'
    if (/404|Not Found/i.test(msg)) {
      return 'Không tìm thấy bản phát hành (Release) trên GitHub (404). Kiểm tra đúng repo/owner, Release đã Publish và đã upload `latest.yml` + `*.exe` + `*.blockmap`.'
    }
    return msg || 'Lỗi cập nhật'
  }

  const checkForUpdates = useMemo(() => {
    return () => {
      if (!window.desktop) return
      setChecking(true)
      setError('')
      window.desktop.checkForUpdates().catch((err: unknown) => {
        setChecking(false)
        setError(normalizeUpdateError(err))
      })
    }
  }, [])

  useEffect(() => {
    if (!window.desktop) return

    window.desktop.getVersion().then(setVersion)

    window.desktop.onUpdateAvailable((info) => {
      setChecking(false)
      setError('')
      setDownloaded(false)
      setDownloading(false)
      setProgress(0)
      setUpdateAvailable((info && typeof info === 'object' ? (info as UpdateInfo) : {}) as UpdateInfo)
    })

    window.desktop.onUpdateNotAvailable(() => {
      setChecking(false)
      setError('')
      setDownloaded(false)
      setDownloading(false)
      setProgress(0)
      setUpdateAvailable(null)
    })

    window.desktop.onUpdateProgress((prog) => {
      const p = prog && typeof prog === 'object' ? (prog as UpdateProgress) : null
      setProgress(typeof p?.percent === 'number' ? p.percent : 0)
    })

    window.desktop.onUpdateDownloaded(() => {
      setDownloading(false)
      setDownloaded(true)
    })

    window.desktop.onUpdateError((err) => {
      setChecking(false)
      setDownloading(false)
      setError(normalizeUpdateError(err))
    })

    const onOpen = () => {
      setShow(true)
      setError('')
      setDownloaded(false)
      setProgress(0)
      void window.desktop?.getVersion().then(setVersion)
      checkForUpdates()
    }

    window.addEventListener('app:update:open', onOpen)
    return () => window.removeEventListener('app:update:open', onOpen)
  }, [checkForUpdates])

  const startDownload = () => {
    if (!window.desktop) return
    setDownloading(true)
    setError('')
    window.desktop.downloadUpdate()
  }

  const install = () => {
    if (!window.desktop) return
    window.desktop.installUpdate()
  }

  const newVersion = updateAvailable?.version ? String(updateAvailable.version) : '—'

  const statusText = useMemo(() => {
    if (error) return error
    if (checking) return 'Đang kiểm tra cập nhật…'
    if (downloading) return `Đang tải xuống… ${Math.max(0, Math.min(100, progress)).toFixed(0)}%`
    if (downloaded) return 'Đã tải xong. Sẵn sàng cài đặt.'
    if (updateAvailable) return 'Có phiên bản mới'
    return 'Bạn đang dùng phiên bản mới nhất'
  }, [checking, downloaded, downloading, error, progress, updateAvailable])

  const canDownload = Boolean(updateAvailable) && !downloading && !checking && !downloaded
  const canInstall = downloaded && !downloading && !checking

  if (!hasDesktop || !show) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 3000,
      }}
      onClick={() => setShow(false)}
    >
      <div
        style={{
          width: 560,
          maxWidth: '95vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          padding: 20,
          color: 'var(--text-main)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row row-between" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Cập nhật ứng dụng</div>
          <button
            className="btn btn-small"
            onClick={() => setShow(false)}
            style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
            aria-label="Đóng"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 10, columnGap: 16, marginBottom: 18 }}>
          <div style={{ color: 'var(--text-muted)' }}>Phiên bản hiện tại</div>
          <div style={{ textAlign: 'right', fontWeight: 700 }}>{version || '—'}</div>

          <div style={{ color: 'var(--text-muted)' }}>Phiên bản mới</div>
          <div style={{ textAlign: 'right' }}>{newVersion}</div>

          <div style={{ color: 'var(--text-muted)' }}>Trạng thái</div>
          <div style={{ textAlign: 'right' }}>{statusText}</div>
        </div>

        {downloading ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 6, background: 'var(--neutral-200)', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  background: 'var(--primary-600)',
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={checkForUpdates}
            disabled={checking || downloading}
            style={
              checking || downloading
                ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--neutral-100)' }
                : undefined
            }
          >
            <RefreshCw size={16} style={checking ? { animation: 'spin 1s linear infinite' } : undefined} />
            Kiểm tra lại
          </button>

          <button
            className="btn"
            onClick={canInstall ? install : startDownload}
            disabled={!canDownload && !canInstall}
            style={
              !canDownload && !canInstall
                ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--neutral-100)' }
                : undefined
            }
          >
            <Download size={16} />
            {canInstall ? 'Cài đặt' : 'Tải cập nhật'}
          </button>

          <button className="btn" onClick={() => setShow(false)}>
            Đóng
          </button>
        </div>

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}

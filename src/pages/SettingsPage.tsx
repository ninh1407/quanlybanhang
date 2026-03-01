import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useAppState } from '../state/Store'
import { warehouseStorageKey } from '../state/seed'
import { downloadBackupV1, restoreBackupFromFileV1 } from '../state/backup'
import { PageHeader } from '../ui-kit/PageHeader'
import { useSettings } from '../settings/useSettings'
import { useDialogs } from '../ui-kit/Dialogs'

export function SettingsPage() {
  const { can } = useAuth()
  const canWrite = can('staff:write')
  const state = useAppState()
  const { settings, patchSettings, resetSettings } = useSettings()
  const dialogs = useDialogs()

  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const activeLocation = useMemo(() => {
    const id = state.currentLocationId
    if (!id) return null
    return state.locations.find((l) => l.id === id && l.active) ?? null
  }, [state.currentLocationId, state.locations])

  const storageKey = useMemo(() => {
    return activeLocation ? warehouseStorageKey(activeLocation.id) : ''
  }, [activeLocation])

  const locations = useMemo(
    () => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [state.locations],
  )

  return (
    <div className="page">
      <PageHeader title="Cấu hình hệ thống" />

      <div className="card">
        <div className="card-title">Thông tin chung</div>
        <div className="grid-form">
          <div className="field field-span-2">
            <label>Tên công ty</label>
            <input
              value={settings.companyName}
              onChange={(e) => patchSettings({ companyName: e.target.value })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label>% Thuế mặc định</label>
            <input
              type="number"
              value={settings.taxRatePercent}
              onChange={(e) => patchSettings({ taxRatePercent: Number(e.target.value) || 0 })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label>Ngưỡng cảnh báo tồn kho (%)</label>
            <input
              type="number"
              value={settings.lowStockThresholdPercent}
              onChange={(e) => patchSettings({ lowStockThresholdPercent: Number(e.target.value) || 0 })}
              disabled={!canWrite}
            />
          </div>
          <div className="field field-span-2">
            <label>Kho mặc định</label>
            <select
              value={settings.defaultLocationId}
              onChange={(e) => patchSettings({ defaultLocationId: e.target.value })}
              disabled={!canWrite}
            >
              <option value="">(Tự chọn)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} - {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Cập nhật ứng dụng</div>
        <div className="grid-form">
          <div className="field field-span-2">
            <label>
              <input
                type="checkbox"
                checked={settings.updateAutoCheckOnStart}
                onChange={(e) => patchSettings({ updateAutoCheckOnStart: e.target.checked })}
                disabled={!canWrite}
                style={{ marginRight: 8 }}
              />
              Tự kiểm tra cập nhật khi mở app (desktop)
            </label>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={resetSettings} disabled={!canWrite}>
            Đặt lại mặc định
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Backup / Khôi phục dữ liệu</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10 }}>
          Backup schema v1 • Kho hiện tại: {activeLocation ? `${activeLocation.code} - ${activeLocation.name}` : '(chưa chọn)'} • localStorage key: {storageKey || '(n/a)'}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-primary" disabled={!canWrite || !storageKey} onClick={() => downloadBackupV1(storageKey, state)}>
            Tải file backup
          </button>

          <button
            className="btn"
            disabled={!canWrite || isRestoring || !storageKey}
            onClick={() => {
              restoreInputRef.current?.click()
            }}
          >
            Khôi phục từ file
          </button>

          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0] ?? null
              e.currentTarget.value = ''
              if (!f || !storageKey) return
              setIsRestoring(true)
              const ok = await dialogs.confirm({ message: 'Khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?', dangerous: true })
              if (!ok) {
                setIsRestoring(false)
                return
              }
              const res = await restoreBackupFromFileV1(storageKey, f)
              setIsRestoring(false)
              if (!res.ok) {
                await dialogs.alert({ message: res.error })
                return
              }
              await dialogs.alert({ message: 'Đã khôi phục dữ liệu. Ứng dụng sẽ tải lại.' })
              window.location.reload()
            }}
          />
        </div>
      </div>
    </div>
  )
}


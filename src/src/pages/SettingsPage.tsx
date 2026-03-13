import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useAppState } from '../state/Store'
import { warehouseStorageKey } from '../state/seed'
import { downloadBackupV1, restoreBackupFromFileV1 } from '../state/backup'
import { PageHeader } from '../ui-kit/PageHeader'
import { useSettings } from '../settings/useSettings'
import { useDialogs } from '../ui-kit/Dialogs'
import { Settings, Image, Database, HardDrive, Download, RotateCw } from 'lucide-react'

export function SettingsPage() {
  const { can } = useAuth()
  const canWrite = can('staff:write')
  const state = useAppState()
  const { settings, patchSettings, resetSettings } = useSettings()
  const dialogs = useDialogs()

  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'inventory' | 'backup'>('general')

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

  const tabs = [
      { id: 'general', label: 'Chung', icon: <Settings size={18} /> },
      { id: 'branding', label: 'Thương hiệu', icon: <Image size={18} /> },
      { id: 'inventory', label: 'Kho vận', icon: <Database size={18} /> },
      { id: 'backup', label: 'Sao lưu & Cập nhật', icon: <HardDrive size={18} /> },
  ]

  return (
    <div className="page">
      <PageHeader title="Cấu hình hệ thống" />

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
          {/* Tabs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tabs.map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12, 
                            padding: '16px 20px', 
                            background: activeTab === t.id ? 'var(--primary-50)' : 'transparent',
                            color: activeTab === t.id ? 'var(--primary-700)' : 'var(--text-main)',
                            border: 'none',
                            borderLeft: activeTab === t.id ? '4px solid var(--primary-600)' : '4px solid transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontWeight: activeTab === t.id ? 600 : 500,
                            transition: 'all 0.2s'
                        }}
                      >
                          {t.icon}
                          {t.label}
                      </button>
                  ))}
              </div>
          </div>

          {/* Content */}
          <div className="card" style={{ minHeight: 400 }}>
              {activeTab === 'general' && (
                  <div className="grid-form">
                      <div className="card-title" style={{ gridColumn: 'span 2', marginBottom: 16 }}>Cấu hình chung</div>
                      <div className="field field-span-2">
                        <label>Tên hệ thống (Company Name)</label>
                        <input
                          value={settings.companyName}
                          onChange={(e) => patchSettings({ companyName: e.target.value })}
                          disabled={!canWrite}
                          placeholder="Ví dụ: My Company ERP"
                        />
                      </div>
                      <div className="field">
                        <label>Số điện thoại</label>
                        <input
                          value={settings.phone}
                          onChange={(e) => patchSettings({ phone: e.target.value })}
                          disabled={!canWrite}
                          placeholder="0901234567"
                        />
                      </div>
                      <div className="field">
                        <label>Mã số thuế</label>
                        <input
                          value={settings.taxCode}
                          onChange={(e) => patchSettings({ taxCode: e.target.value })}
                          disabled={!canWrite}
                          placeholder="0312345678"
                        />
                      </div>
                      <div className="field field-span-2">
                        <label>Địa chỉ</label>
                        <input
                          value={settings.address}
                          onChange={(e) => patchSettings({ address: e.target.value })}
                          disabled={!canWrite}
                          placeholder="123 Đường ABC, Quận XYZ, TP.HCM"
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
                  </div>
              )}

              {activeTab === 'branding' && (
                  <div className="grid-form">
                      <div className="card-title" style={{ gridColumn: 'span 2', marginBottom: 16 }}>Nhận diện thương hiệu</div>
                      <div className="field field-span-2">
                        <label>Logo URL</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <input
                              value={settings.logoUrl}
                              onChange={(e) => patchSettings({ logoUrl: e.target.value })}
                              disabled={!canWrite}
                              placeholder="https://example.com/logo.png"
                              style={{ flex: 1 }}
                            />
                            <div style={{ width: 40, height: 40, border: '1px solid #ddd', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <Image size={20} color="#ccc" />}
                            </div>
                        </div>
                      </div>
                      <div className="field">
                        <label>Màu chủ đạo (Primary Color)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => patchSettings({ primaryColor: e.target.value })}
                            disabled={!canWrite}
                            style={{ width: 40, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', height: 40 }}
                          />
                          <input
                            value={settings.primaryColor}
                            onChange={(e) => patchSettings({ primaryColor: e.target.value })}
                            disabled={!canWrite}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                      <div className="field field-span-2">
                        <label>Custom Domain (CNAME)</label>
                        <input
                          value={settings.customDomain}
                          onChange={(e) => patchSettings({ customDomain: e.target.value })}
                          disabled={!canWrite}
                          placeholder="erp.mycompany.com"
                        />
                        <div className="hint" style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                          Yêu cầu cấu hình DNS CNAME trỏ về server của chúng tôi.
                        </div>
                      </div>
                  </div>
              )}

              {activeTab === 'inventory' && (
                  <div className="grid-form">
                      <div className="card-title" style={{ gridColumn: 'span 2', marginBottom: 16 }}>Cấu hình kho vận</div>
                      <div className="field">
                        <label>Ngưỡng cảnh báo tồn kho (%)</label>
                        <input
                          type="number"
                          value={settings.lowStockThresholdPercent}
                          onChange={(e) => patchSettings({ lowStockThresholdPercent: Number(e.target.value) || 0 })}
                          disabled={!canWrite}
                        />
                      </div>
                      <div className="field">
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
              )}

              {activeTab === 'backup' && (
                  <div>
                      <div className="card-title" style={{ marginBottom: 16 }}>Sao lưu & Cập nhật</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <div>
                                      <div style={{ fontWeight: 600 }}>Sao lưu dữ liệu (Backup)</div>
                                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                          Backup schema v1 • Kho hiện tại: {activeLocation ? `${activeLocation.code} - ${activeLocation.name}` : '(chưa chọn)'} • localStorage key: {storageKey || '(n/a)'}
                                      </div>
                                  </div>
                                  <button className="btn btn-primary" disabled={!canWrite || !storageKey} onClick={() => downloadBackupV1(storageKey, state)}>
                                      <Download size={16} />
                                      Tải Backup
                                  </button>
                              </div>
                              
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border-color)' }}>
                                  <button
                                      className="btn"
                                      disabled={!canWrite || isRestoring || !storageKey}
                                      onClick={() => {
                                      restoreInputRef.current?.click()
                                      }}
                                  >
                                      Khôi phục từ file
                                  </button>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cảnh báo: Dữ liệu hiện tại sẽ bị ghi đè hoàn toàn.</div>
                              </div>
                          </div>

                          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                  <div style={{ fontWeight: 600 }}>Cập nhật phần mềm</div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                          <input
                                              type="checkbox"
                                              checked={settings.updateAutoCheckOnStart}
                                              onChange={(e) => patchSettings({ updateAutoCheckOnStart: e.target.checked })}
                                              disabled={!canWrite}
                                          />
                                          Tự kiểm tra cập nhật khi mở app (desktop)
                                      </label>
                                  </div>
                              </div>
                              <button className="btn">
                                  <RotateCw size={16} />
                                  Kiểm tra cập nhật
                              </button>
                          </div>
                          
                          <div style={{ marginTop: 24 }}>
                              <button className="btn btn-ghost text-danger" onClick={resetSettings} disabled={!canWrite}>
                                  Đặt lại cài đặt mặc định
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>

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
  )
}


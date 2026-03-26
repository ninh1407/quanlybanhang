import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { accessibleLocations, userCanAccessLocation } from '../../shared/domain/warehouseAccess'
import { loadJson } from '../lib/persist'
import type { AppLocation as Warehouse } from '../../shared/types/domain'
import type { WarehouseState } from '../../shared/types/app'
import { createEmptyWarehouseState, warehouseStorageKey } from '../../shared/state/seed'
import { useStore } from '../state/Store'
import { useDialogs } from '../ui-kit/Dialogs'
import { Store, MapPin, ArrowRight, Search, RefreshCw } from 'lucide-react'

function loadWarehouseState(locationId: string): WarehouseState {
  const raw = loadJson<unknown>(warehouseStorageKey(locationId))
  if (raw && typeof raw === 'object') return raw as WarehouseState
  return createEmptyWarehouseState()
}

export function SelectWarehousePage() {
  const { state, dispatch, refresh } = useStore()
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const pageError = (location.state as { error?: string } | null)?.error ?? ''
  const dialogs = useDialogs()

  const warehouses = useMemo(() => {
    return accessibleLocations(user, state.locations).slice().sort((a: any, b: any) => a.code.localeCompare(b.code))
  }, [state.locations, user])

  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string>(() => {
    const cur = state.currentLocationId
    return cur && warehouses.some((w: any) => w.id === cur) ? cur : ''
  })

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return warehouses
    return warehouses.filter((w) => `${w.code} ${w.name}`.toLowerCase().includes(needle))
  }, [q, warehouses])

  const selected = useMemo(() => warehouses.find((w) => w.id === selectedId) ?? null, [warehouses, selectedId])

  function onEnter() {
    if (!selected) return
    if (!userCanAccessLocation(user, selected.id)) {
      void dialogs.alert({ message: 'Bạn không có quyền truy cập kho này' })
      return
    }
    const warehouse = loadWarehouseState(selected.id)
    dispatch({ type: 'session/switchLocation', locationId: selected.id, warehouse })
    nav(from, { replace: true })
  }

  const title = user ? `Chọn kho để đăng nhập` : 'Chọn kho'

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 12,
              background: 'var(--primary-50)',
              borderRadius: '50%',
              marginBottom: 12,
              color: 'var(--primary-600)',
            }}
          >
            <Store size={34} />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>{title}</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Dữ liệu sẽ được tách theo kho bạn chọn.</p>
        </div>

        {pageError ? (
          <div className="error" style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 12px', borderRadius: 6, fontSize: 13 }}>
            {pageError}
          </div>
        ) : null}

        <div className="field">
          <label>Tìm kho</label>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kho theo tên/mã..." style={{ paddingLeft: 38 }} />
          </div>
        </div>

        <div className="field">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <label style={{ margin: 0 }}>Danh sách kho</label>
            <button 
              className="btn btn-small btn-ghost" 
              onClick={() => refresh()}
              title="Cập nhật danh sách kho"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 12 }}>
            {filtered.length ? (
              filtered.map((w: Warehouse) => {
                const active = w.id === selectedId
                return (
                  <button
                    key={w.id}
                    className="btn"
                    onClick={() => setSelectedId(w.id)}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      borderRadius: 0,
                      padding: '12px 14px',
                      background: active ? 'var(--primary-50)' : 'transparent',
                      color: 'var(--text-main)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={16} style={{ color: active ? 'var(--primary-600)' : 'var(--text-muted)' }} />
                      <span style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800 }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.code}</div>
                      </span>
                    </span>
                    {active ? <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-700)' }}>Đang chọn</span> : null}
                  </button>
                )
              })
            ) : (
              <div style={{ padding: 14, color: 'var(--text-muted)' }}>Bạn chưa được cấp quyền kho nào.</div>
            )}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => logout()}>
            Đăng xuất
          </button>
          <button className="btn btn-primary" onClick={onEnter} disabled={!selectedId}>
            Vào kho
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}


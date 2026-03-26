import { useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import type { AppLocation } from '../../shared/types/domain'
import { nowIso } from '../../shared/lib/date'
import { newId } from '../../shared/lib/id'
import { useStore } from '../state/Store'
import { EmptyState } from '../ui-kit/EmptyState'
import { PageHeader } from '../ui-kit/PageHeader'
import { Menu, Plus } from 'lucide-react'
import { geocode } from '../lib/geo'

// ... (autoLocationCode stays same)
function autoLocationCode(): string {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `LOC-${d}-${rnd}`
}

const emptyForm: Omit<AppLocation, 'id' | 'createdAt'> = {
  code: '',
  name: '',
  province: '',
  lat: 0,
  lng: 0,
  note: '',
  active: true,
}

const VIETNAM_BOUNDS = {
    north: 23.3933,
    south: 8.5633,
    west: 102.1444,
    east: 109.4644
}

// Map component with Google Maps Style (Dark Navy)
function WarehouseMap({ locations }: { locations: AppLocation[] }) {
    const [regionFilter, setRegionFilter] = useState<'all' | 'north' | 'central' | 'south'>('north')

    const pins = useMemo(() => {
        return locations
            .filter(l => l.lat && l.lng)
            .map(l => {
                // Determine Region based on Latitude
                // North: > 19
                // Central: 12 - 19
                // South: < 12
                let region: 'north' | 'central' | 'south' = 'central'
                if ((l.lat || 0) >= 19.0) region = 'north'
                else if ((l.lat || 0) < 12.0) region = 'south'
                
                // Filter Logic
                if (regionFilter !== 'all' && region !== regionFilter) return null

                // Normalize lat/lng to % for visual display
                const top = 100 - ((l.lat! - VIETNAM_BOUNDS.south) / (VIETNAM_BOUNDS.north - VIETNAM_BOUNDS.south)) * 100
                const left = ((l.lng! - VIETNAM_BOUNDS.west) / (VIETNAM_BOUNDS.east - VIETNAM_BOUNDS.west)) * 100
                
                return { ...l, top, left, region }
            })
            .filter((x: any) => x !== null) as (AppLocation & { top: number, left: number, region: 'north' | 'central' | 'south' })[]
    }, [locations, regionFilter])

    return (
        <div style={{ 
            height: 600, 
            background: '#0f172a', // Very Dark Navy (Slate 900)
            borderRadius: 16, 
            position: 'relative', 
            overflow: 'hidden', 
            marginBottom: 24, 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            userSelect: 'none',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Hamburger Menu */}
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 20 }}>
                <div style={{ 
                    background: 'white', 
                    width: 44,
                    height: 44,
                    borderRadius: 12, 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer'
                }}>
                    <Menu size={24} color="#1e293b" strokeWidth={2.5} />
                </div>
            </div>

            {/* Labels */}
            {/* Cities */}
            <div style={{ position: 'absolute', top: '25%', left: '48%', color: '#94a3b8', fontSize: 13, fontWeight: 500, letterSpacing: 0.5 }}>Hà Nội</div>
            <div style={{ position: 'absolute', top: '52%', left: '60%', color: '#94a3b8', fontSize: 13, fontWeight: 500, letterSpacing: 0.5 }}>Đà Nẵng</div>
            <div style={{ position: 'absolute', top: '82%', left: '40%', color: '#94a3b8', fontSize: 11, fontWeight: 500, letterSpacing: 0.5 }}>TP.HCM</div>
            
            {/* Countries (Watermark style) */}
            <div style={{ position: 'absolute', top: '42%', left: '25%', color: 'rgba(148, 163, 184, 0.08)', fontSize: 32, fontWeight: 900, letterSpacing: 2 }}>LÀO</div>
            <div style={{ position: 'absolute', top: '58%', left: '15%', color: 'rgba(148, 163, 184, 0.08)', fontSize: 32, fontWeight: 900, letterSpacing: 2 }}>THÁI LAN</div>
            <div style={{ position: 'absolute', top: '78%', left: '25%', color: 'rgba(148, 163, 184, 0.08)', fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>CAMPUCHIA</div>

            {/* Pins */}
            {pins.map((l) => (
                <div 
                    key={l.id} 
                    style={{ 
                        position: 'absolute', 
                        top: `${l.top}%`, 
                        left: `${l.left}%`,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: '2px solid white',
                        boxShadow: `0 0 0 2px #ef4444, 0 0 15px 4px rgba(239, 68, 68, 0.6)`, // Red glowing effect
                        cursor: 'pointer',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10,
                        transition: 'transform 0.2s'
                    }}
                    title={`${l.name} (${l.lat}, ${l.lng})`}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                >
                    <div style={{ width: 6, height: 6, background: '#ef4444', borderRadius: '50%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                </div>
            ))}
            
            {/* FAB & Action */}
            <div style={{ position: 'absolute', bottom: 80, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16, zIndex: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                        background: 'rgba(30, 41, 59, 0.8)', 
                        padding: '6px 16px', 
                        borderRadius: 20, 
                        color: 'white', 
                        fontSize: 13,
                        fontWeight: 500,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                    }}>
                        Xem
                    </div>
                    <button style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                        border: 'none', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}>
                        <Plus color="white" size={24} />
                    </button>
                </div>
                
                 <button style={{ 
                        width: 64, 
                        height: 64, 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                        border: 'none', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 20px 25px -5px rgba(37, 99, 235, 0.5)',
                        cursor: 'pointer',
                        transform: 'translateY(10px)'
                    }}>
                        <Plus color="white" size={32} strokeWidth={2.5} />
                </button>
            </div>

            {/* Bottom Segmented Control */}
            <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: 64, 
                display: 'flex', 
                background: '#1e293b',
                borderTop: '1px solid #334155'
            }}>
                <button 
                    onClick={() => setRegionFilter('north')}
                    style={{ 
                        flex: 1, 
                        background: regionFilter === 'north' ? '#3b82f6' : 'transparent', 
                        border: 'none', 
                        color: 'white', 
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                >
                    Bắc
                </button>
                <button 
                    onClick={() => setRegionFilter('central')}
                    style={{ 
                        flex: 1, 
                        background: regionFilter === 'central' ? '#3b82f6' : 'transparent', 
                        border: 'none', 
                        color: 'white', 
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderLeft: '1px solid #334155',
                        borderRight: '1px solid #334155'
                    }}
                >
                    Trung
                </button>
                <button 
                    onClick={() => setRegionFilter('south')}
                    style={{ 
                        flex: 1, 
                        background: regionFilter === 'south' ? '#3b82f6' : 'transparent', 
                        border: 'none', 
                        color: 'white', 
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                >
                    Nam
                </button>
            </div>
        </div>
    )
}

export function LocationsPage() {
  const { state, dispatch } = useStore()
  const { can } = useAuth()
  const canWrite = can('inventory:write')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({ ...emptyForm, code: autoLocationCode() }))

  const locations = useMemo(() => {
    return state.locations.slice().sort((a: any, b: any) => a.code.localeCompare(b.code))
  }, [state.locations])

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, code: autoLocationCode(), address: '' })
  }

  function startEdit(l: AppLocation) {
    setEditingId(l.id)
    setForm({ 
        code: l.code, 
        name: l.name, 
        province: l.province ?? '', 
        address: l.address ?? '',
        lat: l.lat ?? 0,
        lng: l.lng ?? 0,
        note: l.note, 
        active: l.active 
    })
  }

  function save() {
    if (!canWrite) return
    if (!form.code.trim() || !form.name.trim()) return
    const existing = editingId ? state.locations.find((l) => l.id === editingId) : undefined
    const location: AppLocation = {
      id: existing?.id ?? newId('loc'),
      createdAt: existing?.createdAt ?? nowIso(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      province: form.province?.trim(),
      address: form.address?.trim(),
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
      note: form.note.trim(),
      active: form.active,
    }
    dispatch({ type: 'locations/upsert', location })
    startCreate()
  }

  const [loadingGeo, setLoadingGeo] = useState(false)
  
  async function handleAutoGeocode() {
    const query = form.address || form.province
    if (!query) return
    setLoadingGeo(true)
    try {
      const res = await geocode(query)
      if (res) {
        setForm(prev => ({ ...prev, lat: res.lat, lng: res.lng }))
      } else {
        alert('Không tìm thấy tọa độ cho địa chỉ này')
      }
    } finally {
      setLoadingGeo(false)
    }
  }

  function remove(id: string) {
    if (!canWrite) return
    dispatch({ type: 'locations/delete', id })
  }

  return (
    <div className="page">
      <PageHeader title="Vị trí kho" />
      
      <WarehouseMap locations={locations} />

      {canWrite ? (
        <div className="card">
          <div className="card-title">{editingId ? 'Sửa vị trí' : 'Thêm vị trí'}</div>
          <div className="grid-form">
            <div className="field">
              <label>Mã</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="field">
              <label>Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Tỉnh/Khu vực</label>
              <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="Ví dụ: Hà Nội, TP.HCM..." />
            </div>
            <div className="field field-span-2">
                <label>Địa chỉ chi tiết</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                        value={form.address || ''} 
                        onChange={(e) => setForm({ ...form, address: e.target.value })} 
                        placeholder="Số nhà, đường, phường/xã..." 
                        style={{ flex: 1 }}
                    />
                    <button 
                        className="btn" 
                        onClick={handleAutoGeocode}
                        disabled={loadingGeo || (!form.address && !form.province)}
                        title="Tự động tìm tọa độ từ địa chỉ"
                    >
                        {loadingGeo ? 'Đang tìm...' : 'Lấy tọa độ'}
                    </button>
                </div>
            </div>
            <div className="field field-span-2" style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <label>Vĩ độ (Latitude)</label>
                    <input type="number" step="0.000001" value={form.lat} onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })} placeholder="VD: 21.0285" />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Kinh độ (Longitude)</label>
                    <input type="number" step="0.000001" value={form.lng} onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })} placeholder="VD: 105.8542" />
                </div>
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                <option value="1">Hoạt động</option>
                <option value="0">Ngưng</option>
              </select>
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={save}>
              Lưu
            </button>
            <button className="btn" onClick={startCreate}>
              Mới
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Danh sách</div>
        {locations.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Khu vực</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td>{l.code}</td>
                    <td>{l.name}</td>
                    <td>{l.province}</td>
                    <td>{l.address}</td>
                    <td>{l.active ? 'Hoạt động' : 'Ngưng'}</td>
                    <td>{l.note}</td>
                    <td className="cell-actions">
                      {canWrite ? (
                        <>
                          <button className="btn btn-small" onClick={() => startEdit(l)}>
                            Sửa
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => remove(l.id)}>
                            Xóa
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Chưa có vị trí kho" hint="Tạo vị trí kho để quản lý tồn theo khu vực." />
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useAppState, useAppDispatch } from '../state/Store'
import { PageHeader } from '../ui-kit/PageHeader'
import { newId } from '../lib/id'
import { nowIso } from '../lib/date'
import { ChannelConfig, ChannelType, SkuMapping, WarehouseRegionMapping, AllocationRule } from '../domain/types'
import { Plus, Trash2, Edit } from 'lucide-react'

export function ChannelIntegrationPage() {
  const [tab, setTab] = useState<'channels' | 'sku' | 'regions' | 'rules'>('channels')
  const state = useAppState()
  const dispatch = useAppDispatch()

  // --- Channels Tab ---
  const [editingChannel, setEditingChannel] = useState<Partial<ChannelConfig> | null>(null)

  const handleSaveChannel = () => {
      if (!editingChannel?.name || !editingChannel?.type) return
      
      const config: ChannelConfig = {
          id: editingChannel.id || newId('chn'),
          type: editingChannel.type,
          name: editingChannel.name,
          apiKey: editingChannel.apiKey,
          shopId: editingChannel.shopId,
          warehouseId: editingChannel.warehouseId,
          active: editingChannel.active ?? true,
          createdAt: editingChannel.createdAt || nowIso()
      }
      dispatch({ type: 'channelConfigs/upsert', config })
      setEditingChannel(null)
  }

  // --- SKU Mapping Tab ---
  const [newMapping, setNewMapping] = useState<Partial<SkuMapping>>({})
  
  const handleAddMapping = () => {
      if (!newMapping.channelId || !newMapping.channelSku || !newMapping.systemSkuId) return
      dispatch({ 
          type: 'skuMappings/upsert', 
          mapping: {
              id: newId('map'),
              channelId: newMapping.channelId,
              channelSku: newMapping.channelSku,
              systemSkuId: newMapping.systemSkuId,
              createdAt: nowIso()
          }
      })
      setNewMapping({})
  }

  // --- Region Mapping Tab ---
  const [newRegionMap, setNewRegionMap] = useState<Partial<WarehouseRegionMapping>>({ provinces: [] })
  const [provinceInput, setProvinceInput] = useState('')

  const handleAddRegionMap = () => {
      if (!newRegionMap.locationId || !newRegionMap.provinces?.length) return
      dispatch({
          type: 'warehouseRegionMappings/upsert',
          mapping: {
              id: newId('reg'),
              locationId: newRegionMap.locationId,
              provinces: newRegionMap.provinces,
              priority: newRegionMap.priority || 1,
              createdAt: nowIso()
          }
      })
      setNewRegionMap({ provinces: [] })
      setProvinceInput('')
  }

  // --- Rules Tab ---
  const [newRule, setNewRule] = useState<Partial<AllocationRule>>({ active: true, priority: 1, type: 'region_match' })

  const handleAddRule = () => {
      if (!newRule.name || !newRule.type) return
      dispatch({
          type: 'allocationRules/upsert',
          rule: {
              id: newId('rul'),
              name: newRule.name,
              type: newRule.type,
              active: newRule.active ?? true,
              priority: newRule.priority || 1,
              config: newRule.config || {}
          }
      })
      setNewRule({ active: true, priority: 1, type: 'region_match' })
  }

  return (
    <div className="page">
      <PageHeader title="Trung tâm tích hợp kênh" subtitle="Quản lý kết nối đa kênh & Điều phối đơn hàng" />

      <div className="tabs">
          <button className={`tab ${tab === 'channels' ? 'active' : ''}`} onClick={() => setTab('channels')}>Cấu hình Kênh</button>
          <button className={`tab ${tab === 'sku' ? 'active' : ''}`} onClick={() => setTab('sku')}>Mapping SKU</button>
          <button className={`tab ${tab === 'regions' ? 'active' : ''}`} onClick={() => setTab('regions')}>Phân vùng kho (Routing)</button>
          <button className={`tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>Luật phân bổ (Smart Allocation)</button>
      </div>

      <div className="tab-content" style={{ marginTop: 20 }}>
          {tab === 'channels' && (
              <div>
                  <div style={{ marginBottom: 16 }}>
                      <button className="btn btn-primary" onClick={() => setEditingChannel({ type: 'shopee', active: true })}>
                          <Plus size={16} /> Thêm Kênh
                      </button>
                  </div>
                  
                  {editingChannel && (
                      <div className="card" style={{ marginBottom: 20 }}>
                          <div className="card-title">{editingChannel.id ? 'Sửa kênh' : 'Thêm kênh mới'}</div>
                          <div className="form-grid">
                              <div className="field">
                                  <label>Loại kênh</label>
                                  <select 
                                      value={editingChannel.type} 
                                      onChange={e => setEditingChannel({...editingChannel, type: e.target.value as ChannelType})}
                                  >
                                      <option value="shopee">Shopee</option>
                                      <option value="lazada">Lazada</option>
                                      <option value="tiktok">TikTok Shop</option>
                                      <option value="web">Website</option>
                                  </select>
                              </div>
                              <div className="field">
                                  <label>Tên hiển thị</label>
                                  <input 
                                      className="input"
                                      value={editingChannel.name || ''} 
                                      onChange={e => setEditingChannel({...editingChannel, name: e.target.value})}
                                      placeholder="VD: Shopee Mall HN"
                                  />
                              </div>
                              <div className="field">
                                  <label>API Key / Token</label>
                                  <input 
                                      className="input"
                                      value={editingChannel.apiKey || ''} 
                                      onChange={e => setEditingChannel({...editingChannel, apiKey: e.target.value})}
                                      type="password"
                                  />
                              </div>
                              <div className="field">
                                  <label>Shop ID</label>
                                  <input 
                                      className="input"
                                      value={editingChannel.shopId || ''} 
                                      onChange={e => setEditingChannel({...editingChannel, shopId: e.target.value})}
                                  />
                              </div>
                              <div className="field">
                                  <label>Kho mặc định (nếu có)</label>
                                  <select 
                                      value={editingChannel.warehouseId || ''} 
                                      onChange={e => setEditingChannel({...editingChannel, warehouseId: e.target.value})}
                                  >
                                      <option value="">-- Tự động điều phối --</option>
                                      {state.locations.filter(l => l.active).map(l => (
                                          <option key={l.id} value={l.id}>{l.name}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                          <div className="actions" style={{ marginTop: 16 }}>
                              <button className="btn btn-primary" onClick={handleSaveChannel}>Lưu cấu hình</button>
                              <button className="btn btn-secondary" onClick={() => setEditingChannel(null)}>Hủy</button>
                          </div>
                      </div>
                  )}

                  <table className="table">
                      <thead>
                          <tr>
                              <th>Kênh</th>
                              <th>Tên</th>
                              <th>Shop ID</th>
                              <th>Kho mặc định</th>
                              <th>Trạng thái</th>
                              <th>Hành động</th>
                          </tr>
                      </thead>
                      <tbody>
                          {state.channelConfigs.map(c => (
                              <tr key={c.id}>
                                  <td><span className={`badge badge-${c.type}`}>{c.type.toUpperCase()}</span></td>
                                  <td>{c.name}</td>
                                  <td>{c.shopId}</td>
                                  <td>{state.locations.find(l => l.id === c.warehouseId)?.name || 'Auto'}</td>
                                  <td>{c.active ? 'Đang kết nối' : 'Ngắt kết nối'}</td>
                                  <td>
                                      <button className="btn-icon" onClick={() => setEditingChannel(c)}><Edit size={16} /></button>
                                      <button className="btn-icon text-danger" onClick={() => dispatch({ type: 'channelConfigs/delete', id: c.id })}><Trash2 size={16} /></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}

          {tab === 'sku' && (
              <div>
                  <div className="card" style={{ marginBottom: 20 }}>
                      <div className="card-title">Thêm Mapping Mới</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                          <div className="field" style={{ flex: 1 }}>
                              <label>Kênh bán</label>
                              <select 
                                  value={newMapping.channelId || ''}
                                  onChange={e => setNewMapping({...newMapping, channelId: e.target.value})}
                              >
                                  <option value="">Chọn kênh...</option>
                                  {state.channelConfigs.map(c => (
                                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                  ))}
                              </select>
                          </div>
                          <div className="field" style={{ flex: 1 }}>
                              <label>Mã SKU trên Kênh</label>
                              <input 
                                  className="input"
                                  placeholder="VD: SP001-SHOPEE"
                                  value={newMapping.channelSku || ''}
                                  onChange={e => setNewMapping({...newMapping, channelSku: e.target.value})}
                              />
                          </div>
                          <div className="field" style={{ flex: 1 }}>
                              <label>SKU Hệ thống</label>
                              <select 
                                  value={newMapping.systemSkuId || ''}
                                  onChange={e => setNewMapping({...newMapping, systemSkuId: e.target.value})}
                              >
                                  <option value="">Chọn SKU...</option>
                                  {state.skus.map(s => (
                                      <option key={s.id} value={s.id}>{s.skuCode} - {state.products.find(p => p.id === s.productId)?.name}</option>
                                  ))}
                              </select>
                          </div>
                          <button className="btn btn-primary" onClick={handleAddMapping} style={{ marginBottom: 16 }}>Thêm</button>
                      </div>
                  </div>

                  <table className="table">
                      <thead>
                          <tr>
                              <th>Kênh</th>
                              <th>Mã Kênh (Channel SKU)</th>
                              <th>Mã Hệ thống (System SKU)</th>
                              <th>Sản phẩm</th>
                              <th></th>
                          </tr>
                      </thead>
                      <tbody>
                          {state.skuMappings.map(m => {
                              const channel = state.channelConfigs.find(c => c.id === m.channelId)
                              const sku = state.skus.find(s => s.id === m.systemSkuId)
                              const product = state.products.find(p => p.id === sku?.productId)
                              return (
                                  <tr key={m.id}>
                                      <td>{channel?.name}</td>
                                      <td>{m.channelSku}</td>
                                      <td>{sku?.skuCode}</td>
                                      <td>{product?.name}</td>
                                      <td>
                                          <button className="btn-icon text-danger" onClick={() => dispatch({ type: 'skuMappings/delete', id: m.id })}>
                                              <Trash2 size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
          )}

          {tab === 'regions' && (
              <div>
                   <div className="card" style={{ marginBottom: 20 }}>
                      <div className="card-title">Cấu hình Vùng Phục Vụ (Routing)</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div className="field" style={{ flex: 1 }}>
                              <label>Kho hàng</label>
                              <select 
                                  value={newRegionMap.locationId || ''}
                                  onChange={e => setNewRegionMap({...newRegionMap, locationId: e.target.value})}
                              >
                                  <option value="">Chọn kho...</option>
                                  {state.locations.filter(l => l.active).map(l => (
                                      <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="field" style={{ flex: 2 }}>
                              <label>Tỉnh/Thành phố (Nhập tên và Enter)</label>
                              <input 
                                  className="input"
                                  placeholder="VD: Hà Nội, Hồ Chí Minh..."
                                  value={provinceInput}
                                  onChange={e => setProvinceInput(e.target.value)}
                                  onKeyDown={e => {
                                      if (e.key === 'Enter' && provinceInput.trim()) {
                                          setNewRegionMap({
                                              ...newRegionMap,
                                              provinces: [...(newRegionMap.provinces || []), provinceInput.trim()]
                                          })
                                          setProvinceInput('')
                                      }
                                  }}
                              />
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                  {newRegionMap.provinces?.map(p => (
                                      <span key={p} className="badge badge-gray" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {p}
                                          <XIcon size={12} style={{ cursor: 'pointer' }} onClick={() => setNewRegionMap({...newRegionMap, provinces: newRegionMap.provinces?.filter(x => x !== p)})} />
                                      </span>
                                  ))}
                              </div>
                          </div>
                          <div className="field" style={{ width: 100 }}>
                              <label>Độ ưu tiên</label>
                              <input 
                                  type="number" 
                                  className="input" 
                                  value={newRegionMap.priority || 1} 
                                  onChange={e => setNewRegionMap({...newRegionMap, priority: Number(e.target.value)})}
                              />
                          </div>
                          <button className="btn btn-primary" onClick={handleAddRegionMap} style={{ marginTop: 24 }}>Thêm</button>
                      </div>
                  </div>

                  <table className="table">
                      <thead>
                          <tr>
                              <th>Kho</th>
                              <th>Khu vực phục vụ</th>
                              <th>Ưu tiên</th>
                              <th></th>
                          </tr>
                      </thead>
                      <tbody>
                          {state.warehouseRegionMappings.map(m => (
                              <tr key={m.id}>
                                  <td>{state.locations.find(l => l.id === m.locationId)?.name}</td>
                                  <td>{m.provinces.join(', ')}</td>
                                  <td>{m.priority}</td>
                                  <td>
                                      <button className="btn-icon text-danger" onClick={() => dispatch({ type: 'warehouseRegionMappings/delete', id: m.id })}>
                                          <Trash2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
          {tab === 'rules' && (
              <div>
                  <div className="card" style={{ marginBottom: 20 }}>
                      <div className="card-title">Thêm Luật Phân Bổ Mới</div>
                      <div className="grid-form">
                          <div className="field">
                              <label>Tên luật</label>
                              <input 
                                  className="input" 
                                  value={newRule.name || ''} 
                                  onChange={e => setNewRule({...newRule, name: e.target.value})}
                                  placeholder="VD: Ưu tiên kho gần khách"
                              />
                          </div>
                          <div className="field">
                              <label>Loại luật</label>
                              <select 
                                  value={newRule.type} 
                                  onChange={e => setNewRule({...newRule, type: e.target.value as any})}
                              >
                                  <option value="region_match">Ưu tiên theo Vùng (Routing)</option>
                                  <option value="central_warehouse">Ưu tiên Kho Trung Tâm</option>
                                  <option value="stock_level">Ưu tiên Tồn Nhiều (Load Balancing)</option>
                                  <option value="store_online_restriction">Chặn Kho Chi Nhánh bán Online</option>
                              </select>
                          </div>
                          <div className="field">
                              <label>Độ ưu tiên (1 = Cao nhất)</label>
                              <input 
                                  type="number" 
                                  className="input" 
                                  value={newRule.priority} 
                                  onChange={e => setNewRule({...newRule, priority: Number(e.target.value)})}
                              />
                          </div>
                          
                          {newRule.type === 'central_warehouse' && (
                              <div className="field">
                                  <label>Chọn Kho Trung Tâm</label>
                                  <select 
                                      value={newRule.config?.centralWarehouseId || ''}
                                      onChange={e => setNewRule({
                                          ...newRule, 
                                          config: { ...newRule.config, centralWarehouseId: e.target.value }
                                      })}
                                  >
                                      <option value="">Chọn kho...</option>
                                      {state.locations.filter(l => l.active).map(l => (
                                          <option key={l.id} value={l.id}>{l.name}</option>
                                      ))}
                                  </select>
                              </div>
                          )}

                          {newRule.type === 'store_online_restriction' && (
                              <div className="field">
                                  <label>Cho phép Chi nhánh bán Online?</label>
                                  <select 
                                      value={newRule.config?.allowBranchOnlineSales ? 'true' : 'false'}
                                      onChange={e => setNewRule({
                                          ...newRule, 
                                          config: { ...newRule.config, allowBranchOnlineSales: e.target.value === 'true' }
                                      })}
                                  >
                                      <option value="false">Không (Chỉ Kho Trung Tâm)</option>
                                      <option value="true">Có (Cho phép tất cả)</option>
                                  </select>
                              </div>
                          )}
                          
                          {newRule.type === 'store_online_restriction' && !newRule.config?.allowBranchOnlineSales && (
                               <div className="field">
                                  <label>Kho được phép bán (Kho Trung Tâm)</label>
                                  <select 
                                      value={newRule.config?.centralWarehouseId || ''}
                                      onChange={e => setNewRule({
                                          ...newRule, 
                                          config: { ...newRule.config, centralWarehouseId: e.target.value }
                                      })}
                                  >
                                      <option value="">Chọn kho...</option>
                                      {state.locations.filter(l => l.active).map(l => (
                                          <option key={l.id} value={l.id}>{l.name}</option>
                                      ))}
                                  </select>
                              </div>
                          )}
                      </div>
                      <button className="btn btn-primary" onClick={handleAddRule} style={{ marginTop: 16 }}>Thêm Luật</button>
                  </div>

                  <table className="table">
                      <thead>
                          <tr>
                              <th>Tên luật</th>
                              <th>Loại</th>
                              <th>Độ ưu tiên</th>
                              <th>Trạng thái</th>
                              <th>Cấu hình</th>
                              <th></th>
                          </tr>
                      </thead>
                      <tbody>
                          {state.allocationRules.sort((a, b) => a.priority - b.priority).map(r => (
                              <tr key={r.id}>
                                  <td>{r.name}</td>
                                  <td>{r.type}</td>
                                  <td>{r.priority}</td>
                                  <td>
                                      <span className={`badge badge-${r.active ? 'success' : 'neutral'}`}>
                                          {r.active ? 'Active' : 'Inactive'}
                                      </span>
                                  </td>
                                  <td>
                                      {r.type === 'central_warehouse' && `Kho: ${state.locations.find(l => l.id === r.config.centralWarehouseId)?.name}`}
                                      {r.type === 'store_online_restriction' && `Cho phép chi nhánh: ${r.config.allowBranchOnlineSales ? 'Có' : 'Không'}`}
                                  </td>
                                  <td>
                                      <button className="btn-icon text-danger" onClick={() => dispatch({ type: 'allocationRules/delete', id: r.id })}>
                                          <Trash2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
    </div>
  )
}

function XIcon({ size, style, onClick }: any) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={style}
            onClick={onClick}
        >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    )
}

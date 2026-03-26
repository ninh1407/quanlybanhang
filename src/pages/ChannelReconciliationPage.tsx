import { useState, useRef } from 'react'
import { PageHeader } from '../ui-kit/PageHeader'
import { Upload, CheckCircle } from 'lucide-react'
import { read, utils } from 'xlsx'
import { useStore } from '../state/Store'
import { formatVnd } from '../../shared/lib/money'

type ReconciliationStatus = 'matched' | 'missing_in_system' | 'missing_in_file' | 'amount_mismatch'

interface ReconciliationResult {
    id: string
    orderCode: string
    channel: string
    systemAmount: number
    fileAmount: number
    status: ReconciliationStatus
    diff: number
    note?: string
}

export function ChannelReconciliationPage() {
    const { state } = useStore()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [channel, setChannel] = useState('shopee')
    const [results, setResults] = useState<ReconciliationResult[]>([])
    const [processed, setProcessed] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setProcessed(false)
            setResults([])
        }
    }

    const processFile = async () => {
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const data = e.target?.result
            const workbook = read(data, { type: 'binary' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const jsonData = utils.sheet_to_json(sheet)
            
            compareData(jsonData)
        }
        reader.readAsBinaryString(file)
    }

    const compareData = (fileData: any[]) => {
        // 1. Identify key columns from file (Simple heuristic)
        // Shopee often uses "Mã đơn hàng", "Tổng tiền"
        // Lazada: "Order Number", "Amount"
        // TikTok: "Order ID", "Order Amount"
        
        let idKey = ''
        let amountKey = ''
        
        const firstRow = fileData[0] || {}
        const keys = Object.keys(firstRow)
        
        // Auto-detect columns
        idKey = keys.find(k => /mã đơn|order id|order number|mã vận đơn/i.test(k)) || keys[0]
        amountKey = keys.find(k => /tổng tiền|amount|price|thành tiền|total/i.test(k)) || keys[1]

        const fileMap = new Map<string, number>()
        fileData.forEach(row => {
            const code = String(row[idKey]).trim()
            const amount = Number(String(row[amountKey]).replace(/[^0-9.-]+/g, ''))
            if (code) fileMap.set(code, amount)
        })

        // 2. Get System Orders for this channel
        const systemOrders = state.orders.filter(o => 
            o.source === channel || 
            (channel === 'shopee' && o.platformOrderId) // Loose matching
        )

        const newResults: ReconciliationResult[] = []

        // 3. Match System -> File
        systemOrders.forEach(order => {
            // Try matching by platformOrderId first, then code, then trackingCode
            const key = order.platformOrderId || order.code || order.trackingCode
            const fileAmount = fileMap.get(key)

            // System total calculation
            const systemAmount = (order.items || []).reduce((s: any, i: any) => s + i.price * i.qty, 0) + (order.shippingFee || 0) - (order.discountAmount || 0) + (order.vatAmount || 0) + (order.otherFees || 0)

            if (fileAmount !== undefined) {
                // Found
                const diff = Math.abs(systemAmount - fileAmount)
                if (diff < 100) { // Tolerance
                    newResults.push({
                        id: order.id,
                        orderCode: order.code,
                        channel,
                        systemAmount,
                        fileAmount,
                        status: 'matched',
                        diff: 0
                    })
                } else {
                    newResults.push({
                        id: order.id,
                        orderCode: order.code,
                        channel,
                        systemAmount,
                        fileAmount,
                        status: 'amount_mismatch',
                        diff: fileAmount - systemAmount
                    })
                }
                fileMap.delete(key) // Remove to find "missing in system"
            } else {
                newResults.push({
                    id: order.id,
                    orderCode: order.code,
                    channel,
                    systemAmount,
                    fileAmount: 0,
                    status: 'missing_in_file',
                    diff: 0
                })
            }
        })

        // 4. Remaining in File -> Missing in System
        fileMap.forEach((amount, code) => {
            newResults.push({
                id: `missing-${code}`,
                orderCode: code,
                channel,
                systemAmount: 0,
                fileAmount: amount,
                status: 'missing_in_system',
                diff: 0,
                note: 'Đơn hàng có trên sàn nhưng chưa có trên hệ thống'
            })
        })

        setResults(newResults)
        setProcessed(true)
    }

    const stats = {
        total: results.length,
        matched: results.filter(r => r.status === 'matched').length,
        mismatch: results.filter(r => r.status === 'amount_mismatch').length,
        missingSystem: results.filter(r => r.status === 'missing_in_system').length,
        missingFile: results.filter(r => r.status === 'missing_in_file').length,
    }

    const filteredResults = filterStatus === 'all' 
        ? results 
        : results.filter(r => r.status === filterStatus)

    return (
        <div className="page">
            <PageHeader 
                title="Đối soát đơn hàng" 
                subtitle="Đối chiếu dữ liệu đơn hàng từ sàn TMĐT và hệ thống"
            />
            
            <div className="page-content">
                <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>1. Chọn kênh bán hàng</label>
                            <select 
                                className="input" 
                                value={channel} 
                                onChange={(e) => setChannel(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="shopee">Shopee</option>
                                <option value="tiktok">TikTok Shop</option>
                                <option value="lazada">Lazada</option>
                                <option value="tiki">Tiki</option>
                            </select>
                        </div>
                        
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>2. Tải lên file đối soát (Excel/CSV)</label>
                            <div 
                                style={{ 
                                    border: '2px dashed var(--border-color)', 
                                    borderRadius: 8, 
                                    padding: '10px 16px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    cursor: 'pointer',
                                    background: '#f8fafc'
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={20} style={{ marginRight: 12, color: 'var(--text-muted)' }} />
                                {file ? (
                                    <span style={{ fontWeight: 500 }}>{file.name}</span>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>Click để chọn file...</span>
                                )}
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            disabled={!file}
                            onClick={processFile}
                            style={{ height: 42 }}
                        >
                            <CheckCircle size={18} />
                            Tiến hành đối soát
                        </button>
                    </div>
                </div>

                {processed && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
                            <StatusCard 
                                label="Tổng đơn" 
                                count={stats.total} 
                                color="gray" 
                                active={filterStatus === 'all'}
                                onClick={() => setFilterStatus('all')}
                            />
                            <StatusCard 
                                label="Khớp hoàn toàn" 
                                count={stats.matched} 
                                color="green" 
                                active={filterStatus === 'matched'}
                                onClick={() => setFilterStatus('matched')}
                            />
                            <StatusCard 
                                label="Lệch tiền" 
                                count={stats.mismatch} 
                                color="orange" 
                                active={filterStatus === 'amount_mismatch'}
                                onClick={() => setFilterStatus('amount_mismatch')}
                            />
                            <StatusCard 
                                label="Thiếu trên hệ thống" 
                                count={stats.missingSystem} 
                                color="red" 
                                active={filterStatus === 'missing_in_system'}
                                onClick={() => setFilterStatus('missing_in_system')}
                            />
                            <StatusCard 
                                label="Thiếu trên sàn" 
                                count={stats.missingFile} 
                                color="purple" 
                                active={filterStatus === 'missing_in_file'}
                                onClick={() => setFilterStatus('missing_in_file')}
                            />
                        </div>

                        <div className="card">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Mã đơn hàng</th>
                                        <th>Trạng thái</th>
                                        <th style={{ textAlign: 'right' }}>Tiền hệ thống</th>
                                        <th style={{ textAlign: 'right' }}>Tiền đối soát</th>
                                        <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResults.map((r, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{r.orderCode}</td>
                                            <td><StatusBadge status={r.status} /></td>
                                            <td style={{ textAlign: 'right' }}>{formatVnd(r.systemAmount)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatVnd(r.fileAmount)}</td>
                                            <td style={{ textAlign: 'right', color: r.diff !== 0 ? 'red' : 'inherit', fontWeight: r.diff !== 0 ? 700 : 400 }}>
                                                {r.diff !== 0 ? formatVnd(r.diff) : '-'}
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.note || '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredResults.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Không có dữ liệu</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function StatusCard({ label, count, color, active, onClick }: any) {
    const colorMap: any = {
        gray: { border: '#e2e8f0', bg: '#f8fafc', text: '#64748b' },
        green: { border: '#bbf7d0', bg: '#f0fdf4', text: '#16a34a' },
        orange: { border: '#fed7aa', bg: '#fff7ed', text: '#ea580c' },
        red: { border: '#fecaca', bg: '#fef2f2', text: '#dc2626' },
        purple: { border: '#e9d5ff', bg: '#faf5ff', text: '#9333ea' },
    }
    const theme = colorMap[color]

    return (
        <div 
            className="card" 
            onClick={onClick}
            style={{ 
                padding: 16, 
                cursor: 'pointer',
                border: active ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
                background: active ? theme.bg : 'var(--bg-surface)',
                transition: 'all 0.2s'
            }}
        >
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>{count}</div>
        </div>
    )
}

function StatusBadge({ status }: { status: ReconciliationStatus }) {
    const map: Record<ReconciliationStatus, { label: string; color: string; bg: string }> = {
        matched: { label: 'Khớp', color: '#16a34a', bg: '#f0fdf4' },
        amount_mismatch: { label: 'Lệch tiền', color: '#ea580c', bg: '#fff7ed' },
        missing_in_system: { label: 'Thiếu trên HT', color: '#dc2626', bg: '#fef2f2' },
        missing_in_file: { label: 'Thiếu trên sàn', color: '#9333ea', bg: '#faf5ff' },
    }
    const theme = map[status]
    return (
        <span style={{ 
            fontSize: 12, 
            fontWeight: 500, 
            padding: '2px 8px', 
            borderRadius: 99, 
            color: theme.color, 
            background: theme.bg 
        }}>
            {theme.label}
        </span>
    )
}

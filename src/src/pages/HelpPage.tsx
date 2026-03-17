import { useState, useMemo } from 'react'
import { 
  BookOpen, 
  Search, 
  Box, 
  ShoppingCart, 
  Users, 
  HelpCircle,
  Info,
  Truck,
  DollarSign,
  Globe,
  UserCog,
  FileText,
  ClipboardList,
  Target,
  BarChart2,
  Settings,
  Bell,
  Activity
} from 'lucide-react'
import { useAuth } from '../auth/auth'

export function HelpPage() {
  const { can } = useAuth()
  const [activeSection, setActiveSection] = useState('intro')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeVideo, setActiveVideo] = useState<{ title: string; url: string } | null>(null)

  const videos = useMemo(() => {
    return [
      {
        title: 'Tổng quan hệ thống',
        meta: '05:20 • Giới thiệu các module chính',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      {
        title: 'Quy trình bán hàng',
        meta: '08:15 • Tạo đơn, thanh toán, giao hàng',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      {
        title: 'Kiểm kho & Cân bằng',
        meta: '06:45 • Kiểm kê và xử lý lệch kho',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ]
  }, [])

  const openExternal = (url: string) => {
    const anyWin = window as any
    if (anyWin?.desktop?.openExternal) {
      anyWin.desktop.openExternal(url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const toEmbedUrl = (url: string) => {
    const u = url.trim()
    if (!u) return null
    const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
    if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`
    if (u.endsWith('.mp4') || u.endsWith('.webm')) return u
    return u
  }

  const allSections = [
    { id: 'intro', title: 'Giới thiệu chung', icon: <BookOpen size={18} />, permission: null },
    { id: 'sales', title: 'Bán hàng (Sales)', icon: <ShoppingCart size={18} />, permission: 'orders:read' },
    { id: 'warehouse', title: 'Kho vận (Warehouse)', icon: <Truck size={18} />, permission: 'inventory:read' },
    { id: 'purchasing', title: 'Mua hàng (Purchasing)', icon: <Box size={18} />, permission: 'products:read' },
    { id: 'finance', title: 'Tài chính (Finance)', icon: <DollarSign size={18} />, permission: 'finance:read' },
    { id: 'channels', title: 'Đa kênh (Channels)', icon: <Globe size={18} />, permission: 'orders:write' },
    { id: 'analytics', title: 'Báo cáo (Analytics)', icon: <BarChart2 size={18} />, permission: 'dashboard:read' },
    { id: 'system', title: 'Hệ thống (System)', icon: <Settings size={18} />, permission: 'staff:read' },
    { id: 'troubleshoot', title: 'Xử lý sự cố', icon: <HelpCircle size={18} />, permission: null },
  ]

  const sections = useMemo(() => {
    return allSections.filter(s => !s.permission || can(s.permission as any))
  }, [can])

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const embedUrl = activeVideo ? toEmbedUrl(activeVideo.url) : null

  // Styles
  const styles = {
    container: { display: 'flex', height: '100%', background: '#fff', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    sidebar: { width: 280, background: '#F8F9FA', borderRight: '1px solid #E9ECEF', display: 'flex', flexDirection: 'column' as const, flexShrink: 0 },
    sidebarHeader: { padding: '24px 20px', background: '#fff', borderBottom: '1px solid #E9ECEF' },
    logoArea: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
    logoIcon: { width: 32, height: 32, borderRadius: 8, background: '#007AFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 },
    subtitle: { fontSize: 13, color: '#8E8E93', margin: 0, paddingLeft: 44 },
    searchBox: { marginTop: 20, position: 'relative' as const },
    searchIcon: { position: 'absolute' as const, left: 12, top: 10, color: '#8E8E93' },
    searchInput: { width: '100%', padding: '10px 12px 10px 36px', fontSize: 14, background: '#F2F2F7', border: 'none', borderRadius: 10, outline: 'none' },
    nav: { flex: 1, overflowY: 'auto' as const, padding: '16px 12px' },
    navLabel: { fontSize: 11, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase' as const, padding: '0 12px', marginBottom: 8, letterSpacing: 0.5 },
    navItem: (active: boolean) => ({
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
      color: active ? '#007AFF' : '#3A3A3C',
      background: active ? '#E5F1FF' : 'transparent',
      cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left' as const, transition: 'all 0.2s', marginBottom: 2
    }),
    content: { flex: 1, overflowY: 'auto' as const, background: '#fff', padding: '40px 60px', scrollBehavior: 'smooth' as const },
    hero: { marginBottom: 60 },
    badge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#E5F1FF', color: '#007AFF', fontSize: 12, fontWeight: 600, marginBottom: 20 },
    h1: { fontSize: 36, fontWeight: 800, color: '#1C1C1E', margin: '0 0 16px 0', lineHeight: 1.2 },
    lead: { fontSize: 18, color: '#636366', lineHeight: 1.6, maxWidth: 700 },
    section: { marginBottom: 80, scrollMarginTop: 40 },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #E5E5EA' },
    sectionIcon: (color: string, bg: string) => ({ width: 48, height: 48, borderRadius: 12, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    h2: { fontSize: 24, fontWeight: 700, color: '#1C1C1E', margin: 0 },
    h2Sub: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
    card: { background: '#fff', border: '1px solid #E5E5EA', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 24 },
    cardHeader: { padding: '16px 24px', background: '#F9F9F9', borderBottom: '1px solid #E5E5EA', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#636366' },
    cardBody: { padding: 24 },
    step: { display: 'flex', gap: 16, marginBottom: 24 },
    stepNum: { width: 28, height: 28, borderRadius: 14, background: '#E5F1FF', color: '#007AFF', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    stepTitle: { fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: '0 0 4px 0' },
    stepDesc: { fontSize: 14, color: '#636366', lineHeight: 1.5, margin: 0 },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 },
    featureCard: { padding: 20, borderRadius: 12, background: '#F9F9F9', border: '1px solid #E5E5EA' },
    featureTitle: { fontSize: 16, fontWeight: 600, color: '#1C1C1E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
    featureText: { fontSize: 13, color: '#636366', lineHeight: 1.5 },
    ul: { paddingLeft: 20, margin: '8px 0 0 0', fontSize: 13, color: '#636366', lineHeight: 1.6 },
    subModuleTitle: { fontSize: 14, fontWeight: 700, color: '#007AFF', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    footer: { marginTop: 60, padding: 40, background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)', borderRadius: 20, color: '#fff', textAlign: 'center' as const },
    contactBtn: { display: 'inline-block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, margin: '0 8px' },
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}><BookOpen size={18} /></div>
            <h2 style={styles.title}>Trung tâm hỗ trợ</h2>
          </div>
          <p style={styles.subtitle}>Hướng dẫn sử dụng chi tiết</p>
          <div style={styles.searchBox}>
            <Search size={14} style={styles.searchIcon} />
            <input 
              style={styles.searchInput} 
              placeholder="Tìm kiếm tính năng..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.nav}>
          <div style={styles.navLabel}>Mục lục</div>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              style={styles.navItem(activeSection === section.id)}
            >
              {section.icon}
              {section.title}
            </button>
          ))}
        </div>
        
        <div style={{ padding: 20, borderTop: '1px solid #E9ECEF', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#8E8E93' }}>Phiên bản 3.0.8 • 11/03/2026</div>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          
          {/* Hero */}
          <div id="intro" style={styles.hero}>
            <div style={styles.badge}><Info size={14} /> Tài liệu chính thức</div>
            <h1 style={styles.h1}>Hướng dẫn sử dụng <br/><span style={{color: '#007AFF'}}>Điện Máy Xanh</span></h1>
            <p style={styles.lead}>Tài liệu chi tiết từng bước cho mọi tính năng trong hệ thống quản lý bán hàng.</p>
          </div>

          {/* Module: SALES */}
          {can('orders:read') && (
            <section id="sales" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#34C759', '#E6F9EA')}><ShoppingCart size={24} /></div>
                <div><h2 style={styles.h2}>Bán hàng (Sales)</h2><div style={styles.h2Sub}>Nghiệp vụ bán hàng tại quầy và quản lý đơn hàng</div></div>
              </div>
              
              <div style={styles.card}>
                <div style={styles.cardHeader}>Quy trình tạo đơn hàng</div>
                <div style={styles.cardBody}>
                  <div style={styles.step}>
                    <div style={styles.stepNum}>1</div>
                    <div><h4 style={styles.stepTitle}>Tạo đơn mới</h4><p style={styles.stepDesc}>Vào menu <strong>Đơn hàng</strong>, nhấn nút <strong>+ Tạo đơn</strong> hoặc sử dụng phím tắt để mở giao diện POS.</p></div>
                  </div>
                  <div style={styles.step}>
                    <div style={styles.stepNum}>2</div>
                    <div><h4 style={styles.stepTitle}>Chọn khách hàng & Sản phẩm</h4><p style={styles.stepDesc}>Tìm kiếm khách hàng bằng SĐT hoặc Tên. Quét mã vạch sản phẩm hoặc tìm kiếm theo tên/mã SKU.</p></div>
                  </div>
                  <div style={styles.step}>
                    <div style={styles.stepNum}>3</div>
                    <div><h4 style={styles.stepTitle}>Thanh toán & Giao hàng</h4><p style={styles.stepDesc}>Chọn phương thức thanh toán (Tiền mặt, Chuyển khoản, Công nợ). Cập nhật thông tin giao hàng nếu là đơn online.</p></div>
                  </div>
                </div>
              </div>

              <div style={styles.grid2}>
                <div style={styles.featureCard}>
                  <h3 style={styles.featureTitle}><Users size={16}/> Khách hàng</h3>
                  <p style={styles.featureText}>Quản lý thông tin khách hàng, lịch sử mua hàng và công nợ.</p>
                  <ul style={styles.ul}>
                    <li>Tự động tích điểm khi mua hàng.</li>
                    <li>Phân nhóm khách hàng (VIP, Thân thiết).</li>
                  </ul>
                </div>
                <div style={styles.featureCard}>
                   <h3 style={styles.featureTitle}><Box size={16}/> Sản phẩm & Danh mục</h3>
                   <p style={styles.featureText}>Quản lý danh sách hàng hóa kinh doanh.</p>
                   <ul style={styles.ul}>
                     <li>Thiết lập giá vốn, giá bán.</li>
                     <li>Quản lý theo SKU, màu sắc, kích thước.</li>
                   </ul>
                </div>
              </div>
            </section>
          )}

          {/* Module: WAREHOUSE */}
          {can('inventory:read') && (
            <section id="warehouse" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#FF9500', '#FFF5E0')}><Truck size={24} /></div>
                <div><h2 style={styles.h2}>Kho vận (Warehouse)</h2><div style={styles.h2Sub}>Quản trị tồn kho và vận hành kho thông minh</div></div>
              </div>

              <div style={styles.grid2}>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><Activity size={16}/> Control Tower</h3>
                    <p style={styles.featureText}>Trung tâm chỉ huy, giám sát toàn bộ hoạt động kho theo thời gian thực.</p>
                 </div>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><ClipboardList size={16}/> Duyệt yêu cầu</h3>
                    <p style={styles.featureText}>Phê duyệt các phiếu nhập/xuất/điều chuyển từ nhân viên cấp dưới.</p>
                 </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>Nghiệp vụ kho cốt lõi</div>
                <div style={styles.cardBody}>
                   <div style={styles.subModuleTitle}>1. Quản lý Tồn kho & Vị trí</div>
                   <p style={styles.featureText}>Xem báo cáo tồn kho tức thời (Real-time). Quản lý hàng hóa theo Vị trí (Bin/Slot) để tối ưu việc nhặt hàng.</p>
                   
                   <div style={styles.subModuleTitle}>2. Phiếu kho (Nhập/Xuất/Chuyển)</div>
                   <p style={styles.featureText}>Tạo các phiếu biến động kho thủ công hoặc tự động từ đơn hàng. Hỗ trợ quy trình: <strong>Duyệt phiếu</strong> → <strong>Thực hiện</strong> → <strong>Hoàn thành</strong>.</p>

                   <div style={styles.subModuleTitle}>3. Kiểm kho & Cân bằng</div>
                   <p style={styles.featureText}>Thực hiện kiểm kê định kỳ hoặc đột xuất. Hệ thống tự động tính toán chênh lệch và tạo phiếu cân bằng kho.</p>

                   <div style={styles.subModuleTitle}>4. Pick & Pack</div>
                   <p style={styles.featureText}>Quy trình đóng gói hàng hóa chuẩn hóa. Hỗ trợ in phiếu nhặt hàng (Picking List) và phiếu đóng gói (Packing List).</p>
                </div>
              </div>

              <div style={styles.grid2}>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><Target size={16}/> Phân tích rủi ro & Gợi ý nhập hàng</h3>
                    <ul style={styles.ul}>
                      <li>Cảnh báo hàng sắp hết (Low stock).</li>
                      <li>Dự báo nhu cầu nhập hàng dựa trên lịch sử bán.</li>
                    </ul>
                 </div>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><BarChart2 size={16}/> KPIs Kho & Giám sát</h3>
                    <ul style={styles.ul}>
                      <li>Đo lường hiệu suất nhân viên kho.</li>
                      <li>Giám sát tiến độ xử lý đơn hàng (SLA).</li>
                    </ul>
                 </div>
              </div>
            </section>
          )}

          {/* Module: PURCHASING */}
          {can('products:read') && (
            <section id="purchasing" style={styles.section}>
               <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#5856D6', '#E0E0F8')}><Box size={24} /></div>
                <div><h2 style={styles.h2}>Mua hàng (Purchasing)</h2><div style={styles.h2Sub}>Quản lý nhà cung cấp và nhập hàng</div></div>
              </div>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}>Quy trình mua hàng</h3>
                <ol style={{...styles.ul, paddingLeft: 20, listStyleType: 'decimal'}}>
                  <li><strong>Nhà cung cấp:</strong> Quản lý danh sách đối tác cung ứng hàng hóa.</li>
                  <li><strong>Đơn mua hàng (PO):</strong> Lập đơn đặt hàng gửi nhà cung cấp, theo dõi tiến độ giao hàng và công nợ phải trả.</li>
                </ol>
              </div>
            </section>
          )}

          {/* Module: FINANCE */}
          {can('finance:read') && (
             <section id="finance" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#FF2D55', '#FFECEF')}><DollarSign size={24} /></div>
                <div><h2 style={styles.h2}>Tài chính (Finance)</h2><div style={styles.h2Sub}>Quản trị dòng tiền doanh nghiệp</div></div>
              </div>
              <div style={styles.grid3}>
                <div style={styles.featureCard}>
                  <h4 style={styles.featureTitle}>Tổng quan</h4>
                  <p style={styles.featureText}>Báo cáo lãi lỗ (P&L) ước tính theo thời gian thực.</p>
                </div>
                <div style={styles.featureCard}>
                  <h4 style={styles.featureTitle}>Dòng tiền</h4>
                  <p style={styles.featureText}>Quản lý thu chi tiền mặt, ngân hàng. Sổ quỹ chi tiết.</p>
                </div>
                <div style={styles.featureCard}>
                  <h4 style={styles.featureTitle}>Công nợ</h4>
                  <p style={styles.featureText}>Theo dõi công nợ khách hàng (Phải thu) và Nhà cung cấp (Phải trả).</p>
                </div>
              </div>
             </section>
          )}

          {/* Module: CHANNELS */}
          {can('orders:write') && (
            <section id="channels" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#00C7BE', '#E0F8F7')}><Globe size={24} /></div>
                <div><h2 style={styles.h2}>Đa kênh (Channels)</h2><div style={styles.h2Sub}>Kết nối sàn TMĐT và đối soát</div></div>
              </div>
              <div style={styles.card}>
                 <div style={styles.cardBody}>
                    <div style={styles.subModuleTitle}>1. Cấu hình & Kết nối</div>
                    <p style={styles.featureText}>Liên kết tài khoản Shopee, Lazada, TikTok Shop để đồng bộ đơn hàng và tồn kho tự động.</p>
                    <div style={styles.subModuleTitle}>2. Đối soát</div>
                    <p style={styles.featureText}>Tải lên file đối soát từ sàn hoặc đơn vị vận chuyển để khớp số liệu, tìm ra các đơn lệch tiền hoặc mất hàng.</p>
                 </div>
              </div>
            </section>
          )}

          {/* Module: ANALYTICS */}
          {can('dashboard:read') && (
             <section id="analytics" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#FF3B30', '#FFE5E5')}><BarChart2 size={24} /></div>
                <div><h2 style={styles.h2}>Báo cáo (Analytics)</h2><div style={styles.h2Sub}>Phân tích số liệu kinh doanh</div></div>
              </div>
              <div style={styles.grid2}>
                <div style={styles.featureCard}>
                  <h3 style={styles.featureTitle}>Báo cáo bán hàng</h3>
                  <p style={styles.featureText}>Phân tích doanh thu theo thời gian, nhân viên, chi nhánh. Top sản phẩm bán chạy.</p>
                </div>
                <div style={styles.featureCard}>
                  <h3 style={styles.featureTitle}>Báo cáo kho</h3>
                  <p style={styles.featureText}>Giá trị tồn kho, tốc độ luân chuyển hàng hóa (Turnover rate), Tỷ lệ lấp đầy (Fill rate).</p>
                </div>
              </div>
             </section>
          )}

          {/* Module: SYSTEM */}
          {can('staff:read') && (
             <section id="system" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#8E8E93', '#F2F2F7')}><Settings size={24} /></div>
                <div><h2 style={styles.h2}>Hệ thống (System)</h2><div style={styles.h2Sub}>Cấu hình và quản trị</div></div>
              </div>
              <div style={styles.grid2}>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><UserCog size={16}/> Nhân sự & Phân quyền</h3>
                    <p style={styles.featureText}>Quản lý danh sách nhân viên. Phân quyền chi tiết theo chức năng và phạm vi dữ liệu.</p>
                 </div>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><FileText size={16}/> Nhật ký hoạt động</h3>
                    <p style={styles.featureText}>Ghi lại toàn bộ thao tác của người dùng trên hệ thống để tra cứu khi cần thiết.</p>
                 </div>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><BookOpen size={16}/> Tài liệu</h3>
                    <p style={styles.featureText}>Kho lưu trữ quy trình, biểu mẫu, tài liệu hướng dẫn nội bộ.</p>
                 </div>
                 <div style={styles.featureCard}>
                    <h3 style={styles.featureTitle}><Bell size={16}/> Thông báo & Cấu hình</h3>
                    <p style={styles.featureText}>Cài đặt thông tin cửa hàng, mẫu in hóa đơn, cấu hình thông báo hệ thống.</p>
                 </div>
              </div>
             </section>
          )}

          {/* Video Tutorials */}
          <section id="videos" style={styles.section}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionIcon('#FF3B30', '#FFE5E5')}><Activity size={24} /></div>
                <div><h2 style={styles.h2}>Video hướng dẫn</h2><div style={styles.h2Sub}>Học nhanh qua video trực quan</div></div>
              </div>
              <div style={styles.grid3}>
                  {videos.map((v) => (
                    <div key={v.title} style={styles.featureCard}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveVideo({ title: v.title, url: v.url })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setActiveVideo({ title: v.title, url: v.url })
                        }}
                        style={{
                          width: '100%',
                          aspectRatio: '16/9',
                          background: 'linear-gradient(135deg, #0b1220, #000)',
                          borderRadius: 12,
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '1px solid rgba(0,0,0,0.08)',
                        }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '14px solid white', marginLeft: 4 }} />
                        </div>
                      </div>
                      <h4 style={styles.featureTitle}>{v.title}</h4>
                      <p style={styles.featureText}>{v.meta}</p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setActiveVideo({ title: v.title, url: v.url })}
                          style={{
                            border: '1px solid #E5E5EA',
                            background: '#fff',
                            borderRadius: 10,
                            padding: '8px 10px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Xem trong app
                        </button>
                        <button
                          type="button"
                          onClick={() => openExternal(v.url)}
                          style={{
                            border: '1px solid #E5E5EA',
                            background: '#F2F2F7',
                            borderRadius: 10,
                            padding: '8px 10px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Mở trình duyệt
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
          </section>

          {activeVideo ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setActiveVideo(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.55)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                zIndex: 9999,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(980px, 95vw)',
                  borderRadius: 16,
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E5E5EA' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{activeVideo.title}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => openExternal(activeVideo.url)}
                      style={{
                        border: '1px solid #E5E5EA',
                        background: '#F2F2F7',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Mở trình duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVideo(null)}
                      style={{
                        border: '1px solid #E5E5EA',
                        background: '#fff',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
                <div style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}>
                  {embedUrl && (embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm')) ? (
                    <video src={embedUrl} controls autoPlay style={{ width: '100%', height: '100%' }} />
                  ) : embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={activeVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', border: 0 }}
                    />
                  ) : (
                    <div style={{ color: '#fff', padding: 20 }}>Không có link video.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

           {/* Footer */}
           <div style={styles.footer}>
            <h3 style={{ fontSize: 20, margin: '0 0 8px 0' }}>Cần hỗ trợ kỹ thuật?</h3>
            <p style={{ margin: '0 0 24px 0', opacity: 0.8 }}>Vui lòng liên hệ bộ phận IT để được giải đáp</p>
            <div>
              <span style={styles.contactBtn}>0987.654.321</span>
              <span style={styles.contactBtn}>support@dienmayxanh.com</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

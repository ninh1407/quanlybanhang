import { useState } from 'react'
import { 
  BookOpen, 
  Search, 
  Box, 
  ShoppingCart, 
  Users, 
  // BarChart2, 
  // Settings,
  HelpCircle,
  Info,
  // Layers,
  Truck,
  DollarSign,
  // Activity,
  Globe,
  UserCog,
  FileText,
  ClipboardList,
  Target
} from 'lucide-react'

export function HelpPage() {
  const [activeSection, setActiveSection] = useState('intro')
  const [searchTerm, setSearchTerm] = useState('')

  const sections = [
    { id: 'intro', title: 'Giới thiệu chung', icon: <BookOpen size={18} /> },
    { id: 'products', title: 'Sản phẩm', icon: <Box size={18} /> },
    { id: 'sales', title: 'Bán hàng', icon: <ShoppingCart size={18} /> },
    { id: 'omni', title: 'Đa kênh (Omnichannel)', icon: <Globe size={18} /> },
    { id: 'inventory', title: 'Kho hàng & Vận hành', icon: <Truck size={18} /> },
    { id: 'finance', title: 'Tài chính', icon: <DollarSign size={18} /> },
    { id: 'staff', title: 'Nhân sự & Hệ thống', icon: <UserCog size={18} /> },
    { id: 'troubleshoot', title: 'Xử lý sự cố', icon: <HelpCircle size={18} /> },
  ]

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Inline Styles
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
    detailBox: { border: '1px solid #E5E5EA', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    summary: { padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 500, color: '#1C1C1E', background: '#fff' },
    detailContent: { padding: '0 16px 16px 16px', fontSize: 14, color: '#636366', lineHeight: 1.6 },
    footer: { marginTop: 60, padding: 40, background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)', borderRadius: 20, color: '#fff', textAlign: 'center' as const },
    contactBtn: { display: 'inline-block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, margin: '0 8px' },
    ul: { paddingLeft: 20, margin: '8px 0 0 0', fontSize: 13, color: '#636366', lineHeight: 1.6 },
    subModuleTitle: { fontSize: 14, fontWeight: 700, color: '#007AFF', marginBottom: 4, marginTop: 16 }
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
          <div style={{ fontSize: 11, color: '#8E8E93' }}>Phiên bản 2.0.7 • 09/03/2026</div>
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

          {/* Section 1: Sản phẩm */}
          <section id="products" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#007AFF', '#E5F1FF')}><Box size={24} /></div>
              <div><h2 style={styles.h2}>Sản phẩm</h2><div style={styles.h2Sub}>Quản lý danh mục hàng hóa</div></div>
            </div>
            
            <div style={styles.card}>
              <div style={styles.cardHeader}>1. Thêm mới sản phẩm</div>
              <div style={styles.cardBody}>
                <div style={styles.step}>
                  <div style={styles.stepNum}>1</div>
                  <div><h4 style={styles.stepTitle}>Thông tin cơ bản</h4><p style={styles.stepDesc}>Vào <strong>Danh sách sản phẩm</strong> → Bấm <strong>+ Thêm sản phẩm</strong>. Nhập Tên, Mã (bỏ trống để tự sinh), Danh mục.</p></div>
                </div>
                <div style={styles.step}>
                  <div style={styles.stepNum}>2</div>
                  <div><h4 style={styles.stepTitle}>Biến thể (Màu/Size)</h4><p style={styles.stepDesc}>Tại phần "Thuộc tính", chọn Màu sắc, Kích thước. Hệ thống sẽ tạo ra bảng SKU con. Nhập giá bán/giá vốn cho từng dòng.</p></div>
                </div>
                <div style={styles.step}>
                   <div style={styles.stepNum}>3</div>
                   <div><h4 style={styles.stepTitle}>Hình ảnh</h4><p style={styles.stepDesc}>Upload ảnh đại diện và ảnh chi tiết cho từng biến thể để dễ nhận diện khi bán hàng.</p></div>
                </div>
              </div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}><Target size={16}/> Danh mục & Thương hiệu</h3>
                <p style={styles.featureText}>Vào menu con tương ứng để tạo trước khi thêm sản phẩm.</p>
                <ul style={styles.ul}>
                  <li><strong>Thương hiệu:</strong> Hỗ trợ nhập "Xuất xứ thương hiệu" và "Nơi sản xuất".</li>
                  <li><strong>Danh mục:</strong> Phân nhóm hàng hóa (Điện thoại, Tủ lạnh...).</li>
                </ul>
              </div>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}><FileText size={16}/> Nhập/Xuất Excel</h3>
                <p style={styles.featureText}>Dùng khi cần tạo hàng loạt sản phẩm.</p>
                <ul style={styles.ul}>
                  <li>Bấm nút <strong>Export JSON</strong> để lấy mẫu.</li>
                  <li>Nhập dữ liệu và Import lại (liên hệ Admin để được cấp quyền Import).</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Bán hàng */}
          <section id="sales" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#34C759', '#E6F9EA')}><ShoppingCart size={24} /></div>
              <div><h2 style={styles.h2}>Bán hàng</h2><div style={styles.h2Sub}>Xử lý đơn hàng và khách hàng</div></div>
            </div>
            
            <div style={styles.card}>
              <div style={styles.cardHeader}>Quy trình bán hàng tại quầy (POS)</div>
              <div style={styles.cardBody}>
                <div style={styles.step}>
                  <div style={styles.stepNum}>1</div>
                  <div><h4 style={styles.stepTitle}>Chọn hàng</h4><p style={styles.stepDesc}>Quét mã vạch hoặc tìm tên sản phẩm trên thanh tìm kiếm.</p></div>
                </div>
                <div style={styles.step}>
                  <div style={styles.stepNum}>2</div>
                  <div><h4 style={styles.stepTitle}>Chọn khách</h4><p style={styles.stepDesc}>Nhập SĐT khách. Nếu khách mới, bấm nút <strong>+</strong> để tạo nhanh (Chỉ cần Tên & SĐT).</p></div>
                </div>
                <div style={styles.step}>
                  <div style={styles.stepNum}>3</div>
                  <div><h4 style={styles.stepTitle}>Thanh toán</h4><p style={styles.stepDesc}>Nhập số tiền khách đưa. Chọn phương thức (Tiền mặt/Chuyển khoản). Bấm <strong>Thanh toán (F9)</strong> để in hóa đơn.</p></div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Omnichannel */}
          <section id="omni" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#5856D6', '#E0E0F8')}><Globe size={24} /></div>
              <div><h2 style={styles.h2}>Đa kênh (Omnichannel)</h2><div style={styles.h2Sub}>Kết nối sàn TMĐT</div></div>
            </div>
            <div style={styles.featureCard}>
               <h3 style={styles.featureTitle}>Cấu hình & Kết nối</h3>
               <p style={styles.featureText}>Để đồng bộ đơn hàng từ Shopee/Lazada/TikTok:</p>
               <ol style={{...styles.ul, paddingLeft: 20, listStyleType: 'decimal'}}>
                 <li>Vào menu <strong>Đa kênh</strong> → <strong>Cấu hình & Kết nối</strong>.</li>
                 <li>Chọn sàn muốn kết nối → Bấm <strong>Thêm kết nối</strong>.</li>
                 <li>Đăng nhập tài khoản Shop của bạn trên sàn.</li>
                 <li>Hệ thống sẽ tự động tải sản phẩm và đơn hàng về sau 5-10 phút.</li>
                 <li><strong>Liên kết SKU:</strong> Ghép đôi sản phẩm trên sàn với sản phẩm trên phần mềm để trừ kho chính xác.</li>
               </ol>
            </div>
          </section>

          {/* Section 4: Kho (Chi tiết) */}
          <section id="inventory" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#FF9500', '#FFF5E0')}><Truck size={24} /></div>
              <div><h2 style={styles.h2}>Kho hàng & Vận hành</h2><div style={styles.h2Sub}>Nghiệp vụ kho chuyên sâu</div></div>
            </div>
            
            <div style={styles.grid2}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>1. Nhập & Xuất</div>
                <div style={styles.cardBody}>
                  <div style={styles.subModuleTitle}>Nhập hàng (Inbound)</div>
                  <p style={styles.featureText}>Vào <strong>Phiếu kho</strong> → Tạo phiếu Nhập mua. Chọn NCC, nhập số lượng thực tế. Tồn kho tăng khi trạng thái là "Hoàn thành".</p>
                  
                  <div style={styles.subModuleTitle}>Xuất hàng (Outbound)</div>
                  <p style={styles.featureText}>Tự động tạo phiếu xuất khi có đơn bán hàng. Hoặc tạo phiếu Xuất hủy/Xuất khác thủ công.</p>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>2. Kiểm kê & Điều chuyển</div>
                <div style={styles.cardBody}>
                  <div style={styles.subModuleTitle}>Kiểm kho</div>
                  <p style={styles.featureText}>Vào <strong>Kiểm kho</strong> → Tạo phiếu kiểm. Quét mã từng sản phẩm. Hệ thống tự tính lệch và đề xuất cân bằng.</p>
                  
                  <div style={styles.subModuleTitle}>Chuyển kho (DN)</div>
                  <p style={styles.featureText}>Vào <strong>Chuyển kho</strong>. Tạo lệnh chuyển từ Kho A sang Kho B. Kho B phải vào xác nhận "Nhận hàng".</p>
                </div>
              </div>
            </div>

            <div style={styles.grid2}>
               <div style={styles.featureCard}>
                  <h4 style={styles.featureTitle}><Target size={16}/> Control Tower & KPI</h4>
                  <p style={styles.featureText}>Trung tâm giám sát vận hành:</p>
                  <ul style={styles.ul}>
                    <li><strong>Giám sát đơn hàng:</strong> Theo dõi đơn nào đang trễ, chưa đóng gói.</li>
                    <li><strong>KPIs Kho:</strong> Đo lường hiệu suất nhân viên kho (số đơn đóng/giờ, tỷ lệ sai sót).</li>
                    <li><strong>Phân tích rủi ro:</strong> Cảnh báo hàng sắp hết hạn (Date), hàng nằm kho quá lâu (Slow moving).</li>
                  </ul>
               </div>
               <div style={styles.featureCard}>
                  <h4 style={styles.featureTitle}><ClipboardList size={16}/> Tiện ích kho</h4>
                  <ul style={styles.ul}>
                    <li><strong>Gợi ý nhập hàng:</strong> Dựa trên tốc độ bán trung bình 30 ngày để đề xuất số lượng cần nhập.</li>
                    <li><strong>Vị trí kho:</strong> Quản lý sơ đồ Bin/Kệ/Line. Biết chính xác hàng nằm ở ô nào.</li>
                    <li><strong>Pick & Pack:</strong> Quy trình đi nhặt hàng theo sóng (Wave Picking) tối ưu đường đi.</li>
                  </ul>
               </div>
            </div>
          </section>

          {/* Section 5: Tài chính */}
          <section id="finance" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#FF2D55', '#FFECEF')}><DollarSign size={24} /></div>
              <div><h2 style={styles.h2}>Tài chính</h2><div style={styles.h2Sub}>Quản trị dòng tiền</div></div>
            </div>
            <div style={styles.grid3}>
              <div style={styles.featureCard}>
                <h4 style={styles.featureTitle}>Tổng quan (P&L)</h4>
                <p style={styles.featureText}>Xem báo cáo Lãi/Lỗ ước tính. Doanh thu - Giá vốn - Chi phí = Lợi nhuận.</p>
              </div>
              <div style={styles.featureCard}>
                <h4 style={styles.featureTitle}>Dòng tiền</h4>
                <p style={styles.featureText}>Quản lý Sổ quỹ (Tiền mặt/Ngân hàng). Tạo phiếu Thu/Chi thủ công cho các khoản phí ngoài bán hàng (Tiền điện, nước...).</p>
              </div>
              <div style={styles.featureCard}>
                <h4 style={styles.featureTitle}>Công nợ</h4>
                <p style={styles.featureText}><strong>Phải thu:</strong> Khách mua nợ.<br/><strong>Phải trả:</strong> Mua nợ NCC.<br/>Theo dõi hạn thanh toán và lịch sử trả nợ.</p>
              </div>
            </div>
          </section>

          {/* Section 6: Nhân sự */}
          <section id="staff" style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionIcon('#AF52DE', '#F2E6FF')}><Users size={24} /></div>
              <div><h2 style={styles.h2}>Nhân sự & Hệ thống</h2><div style={styles.h2Sub}>Quản trị và phân quyền</div></div>
            </div>
            <div style={styles.featureCard}>
                <h4 style={styles.featureTitle}>Phân quyền chi tiết</h4>
                <p style={styles.featureText}>Vào <strong>Nhân sự</strong> → <strong>Phân quyền</strong>.</p>
                <ul style={styles.ul}>
                  <li>Tạo nhóm quyền (VD: Kho, Kế toán, Sale).</li>
                  <li>Tích chọn các chức năng được phép truy cập.</li>
                  <li><strong>Nhật ký (Audit Log):</strong> Xem lại lịch sử thao tác của nhân viên (Ai đã sửa giá? Ai đã xóa đơn?).</li>
                </ul>
            </div>
          </section>

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

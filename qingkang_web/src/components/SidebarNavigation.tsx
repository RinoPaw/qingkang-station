import {
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  MonitorSmartphone,
  ScanLine,
  UserRound,
} from 'lucide-react'

export type AppPage = 'home' | 'heart' | 'tongue' | 'observation' | 'records' | 'guide' | 'profile'

type SidebarNavigationProps = {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
}

const navItems = [
  { icon: <Home size={20} />, label: '首页', page: 'home' as const },
  { icon: <HeartPulse size={20} />, label: '心率记录', page: 'heart' as const },
  { icon: <ScanLine size={20} />, label: '舌象上传', page: 'tongue' as const },
  { icon: <ClipboardList size={20} />, label: '综合观察卡', page: 'observation' as const },
  { icon: <FileText size={20} />, label: '我的记录', page: 'records' as const },
  { icon: <UserRound size={20} />, label: '个人中心', page: 'profile' as const },
]

export function SidebarNavigation({ activePage, onNavigate }: SidebarNavigationProps) {
  return (
    <aside className="home-sidebar">
      <div className="home-logo">
        <span className="home-logo-mark"></span>
        <div>
          <strong>青康小站</strong>
          <p>QINGKANG STATION</p>
        </div>
      </div>

      <nav className="home-nav" aria-label="页面导航">
        {navItems.map((item) => (
          <button
            className={activePage === item.page ? 'is-active' : ''}
            key={item.label}
            onClick={() => onNavigate(item.page)}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <button className="home-guide-card" onClick={() => onNavigate('guide')} type="button">
        <MonitorSmartphone size={28} />
        <span>
          <strong>公共设备指引</strong>
          <p>查看附近设备与使用指南</p>
        </span>
        <i>→</i>
      </button>

      <p className="home-sidebar-note">青康小站 · 科技守护健康</p>
      <div className="home-campus-ghost" aria-hidden="true"></div>
    </aside>
  )
}

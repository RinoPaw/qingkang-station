import { Bell, Building2, ChevronDown, CircleUserRound, LogOut } from 'lucide-react'
import type { User } from '../types/index'
import type { AppPage } from './SidebarNavigation'

type AppTopbarProps = {
  className?: string
  user: User | null
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

export function AppTopbar({ className = '', user, onLogout, onNavigate }: AppTopbarProps) {
  return (
    <div className={`home-topbar ${className}`.trim()}>
      <div className="home-top-pill" aria-label="通知">
        <Bell size={22} />
        <span></span>
      </div>
      <div className="home-top-pill home-campus" aria-label="学校">
        <Building2 size={20} />
        清华大学
        <ChevronDown size={16} />
      </div>
      <button className="home-user-pill" onClick={user ? onLogout : () => onNavigate('profile')} type="button">
        <span className="home-avatar">
          <CircleUserRound size={28} />
        </span>
        <span>
          <strong>{user?.nickname || '同学'}</strong>
          <small>{user ? '已创建身份' : '待创建身份'}</small>
        </span>
        {user && <LogOut size={16} />}
      </button>
    </div>
  )
}

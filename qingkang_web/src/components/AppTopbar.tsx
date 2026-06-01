import { CircleUserRound, LogOut } from 'lucide-react'
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
      <div className="home-user-pill">
        <span className="home-avatar">
          <CircleUserRound size={28} />
        </span>
        <span>
          <strong>{user?.nickname || '同学'}</strong>
        </span>
        <button
          aria-label={user ? '退出登录' : '创建身份'}
          className="home-user-logout"
          onClick={user ? onLogout : () => onNavigate('profile')}
          type="button"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}

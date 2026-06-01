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
      <button className="home-user-pill" onClick={user ? onLogout : () => onNavigate('profile')} type="button">
        <span className="home-avatar">
          <CircleUserRound size={28} />
        </span>
        <span>
          <strong>{user?.nickname || '同学'}</strong>
        </span>
        {user && <LogOut size={16} />}
      </button>
    </div>
  )
}

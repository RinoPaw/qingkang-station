import type { FormEvent } from 'react'
import {
  CheckCircle2,
  CircleUserRound,
  FileText,
  HeartPulse,
  LogOut,
  ScanLine,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import type { User } from '../types/index'

type ProfilePageProps = {
  busy: string
  error: string
  nickname: string
  notice: string
  user: User | null
  onCreateIdentity: () => void
  onLogout: () => void
  onNavigate: (page: AppPage) => void
  setNickname: (value: string) => void
}

export function ProfilePage({
  busy,
  error,
  nickname,
  notice,
  user,
  onCreateIdentity,
  onLogout,
  onNavigate,
  setNickname,
}: ProfilePageProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onCreateIdentity()
  }

  return (
    <main className="home-shell profile-page-shell">
      <SidebarNavigation activePage="profile" onNavigate={onNavigate} />

      <section className="profile-page-main">
        <AppTopbar className="profile-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="profile-title">
          <div>
            <h1>
              个人中心
              <span>
                <UserRound size={22} />
              </span>
            </h1>
            <p>创建你的校园小站身份，绑定本次记录和后续趋势档案</p>
          </div>
        </header>

        {(error || notice) && (
          <section className={`profile-message ${error ? 'is-error' : 'is-success'}`}>
            {error ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            {error || notice}
          </section>
        )}

        <section className="profile-workspace">
          <section className="profile-main-card">
            <div className="profile-avatar-card">
              <span>
                <CircleUserRound size={44} />
              </span>
              <div>
                <p>当前身份</p>
                <h2>{user?.nickname || '待创建身份'}</h2>
                <strong>{user ? '已可加入测量队列' : '创建后可使用队列与记录功能'}</strong>
              </div>
            </div>

            {!user ? (
              <form className="profile-form" onSubmit={handleSubmit}>
                <label htmlFor="profile-nickname">昵称或学号</label>
                <input
                  id="profile-nickname"
                  placeholder="例如：Rino"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
                <button disabled={busy === 'start'} type="submit">
                  <ShieldCheck size={19} />
                  创建身份
                </button>
              </form>
            ) : (
              <div className="profile-action-grid">
                <button onClick={() => onNavigate('heart')} type="button">
                  <HeartPulse size={19} />
                  去心率记录
                </button>
                <button onClick={() => onNavigate('tongue')} type="button">
                  <ScanLine size={19} />
                  去上传舌象
                </button>
                <button onClick={() => onNavigate('records')} type="button">
                  <FileText size={19} />
                  查看我的记录
                </button>
              </div>
            )}
          </section>

          <aside className="profile-side-card">
            <h2>身份用于什么</h2>
            <div className="profile-purpose-list">
              <p>
                <HeartPulse size={18} />
                绑定心率排队与本次记录
              </p>
              <p>
                <ScanLine size={18} />
                汇总舌象图片与图片质量状态
              </p>
              <p>
                <FileText size={18} />
                沉淀个人趋势档案和观察卡
              </p>
              <p>
                <ShieldCheck size={18} />
                仅用于健康状态观察和科普记录
              </p>
            </div>
            {user && (
              <button className="profile-logout-button" onClick={onLogout} type="button">
                <LogOut size={18} />
                退出当前身份
              </button>
            )}
          </aside>
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

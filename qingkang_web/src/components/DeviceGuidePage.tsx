import {
  Clock3,
  HeartPulse,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Timer,
  UsersRound,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import type { User } from '../types/index'

type DeviceGuidePageProps = {
  deviceHumanState: string
  user: User | null
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

const guideSteps = [
  ['创建身份', '先在个人中心输入昵称或学号，绑定本次记录。'],
  ['加入队列', '公共设备同一时间服务一位同学，请按队列等待。'],
  ['轮到你时测量', '页面提示后再轻放手指，测量中保持稳定。'],
  ['记录完成后离开', '心率记录完成后，可选择补充舌象图片。'],
]

export function DeviceGuidePage({ deviceHumanState, user, onLogout, onNavigate }: DeviceGuidePageProps) {
  return (
    <main className="home-shell guide-page-shell">
      <SidebarNavigation activePage="guide" onNavigate={onNavigate} />

      <section className="guide-page-main">
        <AppTopbar className="guide-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="guide-title">
          <div>
            <h1>
              公共设备指引
              <span>
                <MonitorSmartphone size={22} />
              </span>
            </h1>
            <p>了解排队、测量和设备使用规则，减少现场等待时的困惑</p>
          </div>
          <div className="guide-device-state">
            <Radio size={20} />
            <span>
              <strong>{deviceHumanState}</strong>
              <small>心率设备按队列分配</small>
            </span>
          </div>
        </header>

        <section className="guide-workspace">
          <section className="guide-main-card">
            <div className="guide-device-visual" aria-hidden="true">
              <div className="guide-device-screen">
                <HeartPulse size={34} />
                <span>QK</span>
              </div>
              <i></i>
            </div>
            <div className="guide-main-copy">
              <p>现场使用流程</p>
              <h2>先排队，再测量</h2>
              <span>心率硬件是公共设备，页面会提示是否轮到你。未轮到时不用把手指放上传感器，也不会占用设备。</span>
              <div className="guide-action-row">
                <button onClick={() => onNavigate(user ? 'heart' : 'profile')} type="button">
                  <UsersRound size={19} />
                  {user ? '查看队列' : '先创建身份'}
                </button>
                <button className="is-light" onClick={() => onNavigate('heart')} type="button">
                  <ShieldCheck size={19} />
                  查看心率记录
                </button>
              </div>
            </div>
          </section>

          <aside className="guide-side-card">
            <h2>设备使用提醒</h2>
            <div className="guide-reminder-list">
              <p>
                <Clock3 size={18} />
                每次心率记录约 1 分钟
              </p>
              <p>
                <Timer size={18} />
                轮到你后请尽快开始
              </p>
              <p>
                <HeartPulse size={18} />
                测量中请保持手指轻放
              </p>
              <p>
                <ShieldCheck size={18} />
                记录仅用于状态观察和趋势参考
              </p>
            </div>
          </aside>
        </section>

        <section className="guide-step-card">
          {guideSteps.map(([title, body], index) => (
            <article className="guide-step-item" key={title}>
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

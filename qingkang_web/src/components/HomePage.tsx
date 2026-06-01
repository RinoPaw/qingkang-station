import {
  HeartPulse,
  MonitorSmartphone,
  NotebookTabs,
  ScanLine,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import type { User } from '../types/index'

type HomePageProps = {
  deviceHumanState: string
  user: User | null
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

export function HomePage({ deviceHumanState, user, onLogout, onNavigate }: HomePageProps) {
  const nickname = user?.nickname || '同学'

  return (
    <main className="home-shell">
      <SidebarNavigation activePage="home" onNavigate={onNavigate} />

      <section className="home-main">
        <AppTopbar user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="home-hero">
          <div>
            <h1>
              你好，{nickname}
              <span>叶</span>
            </h1>
            <p>欢迎来到青康小站，关注身心健康，从点滴记录开始</p>
          </div>
        </header>

        <section className="home-feature-grid">
          <article className="home-feature-card heart-card">
            <div className="home-card-head">
              <span className="home-round-icon is-heart">
                <HeartPulse size={34} />
              </span>
              <div>
                <h2>心率记录</h2>
                <em>需前往公共设备</em>
              </div>
            </div>
            <p className="home-card-copy">排队使用设备，快速记录心率数据</p>
            <div className="home-card-body">
              <ul className="home-bullet-list">
                <li>
                  <MonitorSmartphone size={20} />
                  在校公共设备上测量
                </li>
                <li>
                  <UsersRound size={20} />
                  排队系统，公平有序
                </li>
                <li>
                  <HeartPulse size={20} />
                  每次记录约 1 分钟
                </li>
              </ul>
              <div className="device-illustration" aria-hidden="true">
                <div className="device-screen">
                  <HeartPulse size={24} />
                </div>
                <span></span>
              </div>
            </div>
            <p className="home-live-status">当前设备：{deviceHumanState}</p>
            <button className="home-primary-action" onClick={() => onNavigate('heart')} type="button">
              测量心率
              <i>→</i>
            </button>
          </article>

          <article className="home-feature-card tongue-card">
            <div className="home-card-head">
              <span className="home-round-icon is-tongue">
                <ScanLine size={34} />
              </span>
              <div>
                <h2>舌象上传</h2>
                <em>随时可进行</em>
              </div>
            </div>
            <p className="home-card-copy">随时拍摄并上传舌象，AI 辅助形成记录</p>
            <div className="home-card-body">
              <ul className="home-bullet-list is-blue">
                <li>
                  <Smartphone size={20} />
                  居家或宿舍即可完成
                </li>
                <li>
                  <ShieldCheck size={20} />
                  隐私保护，仅作记录
                </li>
                <li>
                  <NotebookTabs size={20} />
                  建立你的舌象档案
                </li>
              </ul>
              <div className="phone-illustration" aria-hidden="true">
                <div className="phone-camera"></div>
                <div className="tongue-preview"></div>
                <div className="scan-corners"></div>
                <div className="phone-shutter"></div>
              </div>
            </div>
            <p className="home-live-status is-blue">无需等待公共设备</p>
            <button className="home-primary-action is-blue" onClick={() => onNavigate('tongue')} type="button">
              上传舌象
              <i>→</i>
            </button>
          </article>
        </section>

        <section className="home-observation-card">
          <div className="home-section-title">
            <div>
              <h2>综合观察卡</h2>
              <p>整合心率与舌象记录，生成你的综合状态观察</p>
            </div>
            <span>记录后生成</span>
          </div>

          <div className="home-observation-empty">
            <div>
              <h3>完成记录后生成健康评分</h3>
              <p>心率记录和舌象图片都可以独立完成，系统会根据已有记录生成观察摘要。</p>
            </div>
            <button onClick={() => onNavigate('observation')} type="button">查看综合观察卡</button>
          </div>
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

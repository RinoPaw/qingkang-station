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
import { formatDemoDateTime } from '../lib/demoDates'
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
          <div className="home-quote">
            <p>「起居有常，茶息有度」</p>
            <span>校园轻健康状态观察</span>
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
            <div className="home-queue-strip">
              <span>设备状态 <strong>{deviceHumanState}</strong></span>
              <span>预计等待 <strong>8 分钟</strong></span>
            </div>
            <button className="home-primary-action" onClick={() => onNavigate('heart')} type="button">
              查看设备与排队
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
            <button className="home-primary-action is-blue" onClick={() => onNavigate('tongue')} type="button">
              立即上传舌象
              <i>→</i>
            </button>
          </article>
        </section>

        <section className="home-observation-card">
          <div className="home-section-title">
            <div>
              <h2>综合观察卡</h2>
              <p>整合心率与舌象记录，生成你的综合健康观察</p>
            </div>
            <span>多维数据 · 综合分析</span>
          </div>

          <div className="home-observation-grid">
            <div className="home-mini-card">
              <h3>最近更新</h3>
              <div className="home-record-line">
                <HeartPulse size={22} />
                <span>
                  <strong>心率记录</strong>
                  {formatDemoDateTime(0, 10, 32)}
                </span>
              </div>
              <div className="home-record-line is-tongue">
                <ScanLine size={22} />
                <span>
                  <strong>舌象记录</strong>
                  {formatDemoDateTime(1, 22, 15)}
                </span>
              </div>
            </div>

            <div className="home-score-card">
              <h3>综合状态</h3>
              <div className="home-score-ring">
                <strong>82</strong>
                <span>趋势参考</span>
              </div>
              <button onClick={() => onNavigate('observation')} type="button">查看详情</button>
            </div>

            <div className="home-chart-card">
              <div className="home-chart-head">
                <h3>趋势概览</h3>
                <span>近 7 天</span>
              </div>
              <div className="home-chart-lines" aria-hidden="true">
                <svg viewBox="0 0 360 150" role="img">
                  <path className="grid-line" d="M0 30H360M0 75H360M0 120H360" />
                  <polyline className="heart-line" points="0,105 60,70 120,82 180,96 240,72 300,66 360,58" />
                  <polyline className="tongue-line" points="0,118 60,88 120,100 180,108 240,92 300,82 360,104" />
                </svg>
              </div>
            </div>

            <div className="home-advice-card">
              <h3>本周观察建议</h3>
              <p>心率整体平稳，继续保持规律作息与适度运动。</p>
              <p>舌象记录建议继续关注饮水、休息与清淡饮食。</p>
              <button onClick={() => onNavigate('observation')} type="button">查看完整建议 →</button>
            </div>
          </div>
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

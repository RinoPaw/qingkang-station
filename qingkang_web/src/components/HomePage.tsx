import { HeartPulse, ScanLine } from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import {
  HeartStationIllustration,
  HomeLeafMark,
  TongueUploadIllustration,
} from './HomeIllustrations'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import type { User } from '../types/index'
import '../styles/home-overrides.css'

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
        <div className="home-head-row">
          <header className="home-hero">
            <div>
              <h1>
                你好，{nickname}
                <span className="home-leaf-mark"><HomeLeafMark /></span>
              </h1>
            </div>
          </header>
          <AppTopbar user={user} onLogout={onLogout} onNavigate={onNavigate} />
        </div>

        <section className="home-feature-grid">
          <article className="home-feature-card heart-card">
            <div className="home-card-head">
              <span className="home-round-icon is-heart">
                <HeartPulse size={34} />
              </span>
              <div>
                <h2>心率记录</h2>
                <em>公共设备</em>
              </div>
            </div>

            <div className="home-card-body is-simple">
              <HeartStationIllustration />
            </div>

            <p className="home-live-status">{deviceHumanState}</p>
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
                <em>拍照上传</em>
              </div>
            </div>

            <div className="home-card-body is-simple">
              <TongueUploadIllustration />
            </div>

            <p className="home-live-status is-blue">无需排队</p>
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
              <p>完成记录后生成健康评分与观察摘要</p>
            </div>
            <span>记录后生成</span>
          </div>

          <div className="home-observation-empty">
            <div>
              <h3>还没有记录</h3>
              <p>完成一次心率记录或舌象上传后，这里会自动汇总。</p>
            </div>
            <button onClick={() => onNavigate('observation')} type="button">查看观察卡</button>
          </div>
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

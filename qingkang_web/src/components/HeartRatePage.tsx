import type { ReactNode } from 'react'
import {
  Clock3,
  HeartPulse,
  LineChart,
  Radio,
  ScanLine,
  ShieldCheck,
  Square,
  TimerReset,
  UsersRound,
  Waves,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import { formatDemoDateTime } from '../lib/demoDates'
import type { HistoryResponse, User } from '../types/index'
import type { StageKey } from '../lib/statusText'

type HeartPageState = 'idle' | 'queued' | 'ready' | 'measuring' | 'unstable' | 'finished' | 'offline'

type HeartRatePageProps = {
  bpm: number | null
  busy: string
  currentStatus: string
  debugPanel: ReactNode
  deviceHumanState: string
  history: HistoryResponse['items']
  peopleAhead: number
  secondsLeft: number | null
  stage: StageKey
  user: User | null
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onLogout: () => void
  onNavigate: (page: AppPage) => void
  onSaveRecord: () => void
}

const sampleRecords = [
  { date: formatDemoDateTime(0, 10, 32), bpm: 78, status: '平稳' },
  { date: formatDemoDateTime(1, 22, 15), bpm: 84, status: '轻微波动' },
  { date: formatDemoDateTime(2, 16, 45), bpm: 72, status: '平稳' },
  { date: formatDemoDateTime(3, 9, 20), bpm: 88, status: '轻微波动' },
  { date: formatDemoDateTime(4, 20, 10), bpm: 75, status: '平稳' },
]

export function HeartRatePage({
  bpm,
  busy,
  currentStatus,
  debugPanel,
  deviceHumanState,
  history,
  peopleAhead,
  secondsLeft,
  stage,
  user,
  onCancel,
  onFinish,
  onJoinQueue,
  onLogout,
  onNavigate,
  onSaveRecord,
}: HeartRatePageProps) {
  const pageState = getHeartPageState(stage, currentStatus, deviceHumanState)
  const records = buildRecentRecords(history)
  const displayBpm = bpm || latestBpm(history) || 78
  const duration = secondsLeft !== null ? formatCountdown(Math.max(60 - secondsLeft, 0)) : pageState === 'finished' ? '00:58' : '00:00'
  const countdown = secondsLeft !== null ? formatCountdown(secondsLeft) : pageState === 'measuring' || pageState === 'unstable' ? '00:35' : '--:--'
  const signal = getSignalCopy(pageState, currentStatus)

  return (
    <main className="home-shell heart-page-shell">
      <SidebarNavigation activePage="heart" onNavigate={onNavigate} />

      <section className="heart-page-main">
        <AppTopbar className="heart-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="heart-page-title">
          <div>
            <h1>
              心率记录
              <span>
                <HeartPulse size={22} />
              </span>
            </h1>
            <p>使用公共设备，记录你的心率状态</p>
          </div>
          <DeviceStatusCard deviceHumanState={deviceHumanState} />
        </header>

        <section className="heart-workspace">
          <HeartMainCard
            bpm={displayBpm}
            busy={busy}
            countdown={countdown}
            peopleAhead={peopleAhead}
            secondsLeft={secondsLeft}
            signal={signal}
            state={pageState}
            onCancel={onCancel}
            onFinish={onFinish}
            onJoinQueue={user ? onJoinQueue : () => onNavigate('profile')}
            onNavigate={onNavigate}
            onSaveRecord={onSaveRecord}
          />

          <aside className="heart-side-stack">
            <RecordSummaryCard bpm={displayBpm} duration={duration} state={pageState} />
            <RecentRecordsCard records={records} onOpenRecords={() => onNavigate('records')} />
          </aside>
        </section>

        <HeartTrendCard records={records} onOpenRecords={() => onNavigate('records')} />

        {pageState === 'finished' && (
          <section className="heart-next-card">
            <div>
              <ScanLine size={22} />
              <span>
                <strong>可选下一步</strong>
                稍后补充舌象图片，让本次记录更完整。
              </span>
            </div>
            <button onClick={() => onNavigate('tongue')} type="button">去上传舌象</button>
          </section>
        )}

        {debugPanel}

        <DisclaimerBar />
      </section>
    </main>
  )
}

function DeviceStatusCard({ deviceHumanState }: { deviceHumanState: string }) {
  const offline = deviceHumanState === '设备离线'
  return (
    <div className={`heart-title-device ${offline ? 'is-offline' : ''}`}>
      <span></span>
      <strong>{offline ? '心率设备暂不可用' : '设备在线'}</strong>
      <p>{offline ? '工作人员连接设备后可继续测量' : '公共设备可排队使用'}</p>
    </div>
  )
}

function HeartMainCard({
  bpm,
  busy,
  countdown,
  peopleAhead,
  secondsLeft,
  signal,
  state,
  onCancel,
  onFinish,
  onJoinQueue,
  onNavigate,
  onSaveRecord,
}: {
  bpm: number
  busy: string
  countdown: string
  peopleAhead: number
  secondsLeft: number | null
  signal: { title: string; body: string; tone: string }
  state: HeartPageState
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onNavigate: (page: AppPage) => void
  onSaveRecord: () => void
}) {
  const copy = getMainCardCopy(state, peopleAhead)
  const showBpm = state === 'measuring' || state === 'unstable' || state === 'finished'

  return (
    <section className={`heart-main-card is-${state}`}>
      <div className="heart-card-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="heart-countdown">
          <span>倒计时</span>
          <strong>{countdown}</strong>
        </div>
      </div>

      {state === 'queued' ? (
        <div className="heart-queue-panel">
          <UsersRound size={42} />
          <strong>前方还有 {peopleAhead} 位同学</strong>
          <p>请保持页面打开，轮到你时再将手指放在传感器上。</p>
        </div>
      ) : state === 'offline' ? (
        <div className="heart-queue-panel is-offline">
          <Radio size={42} />
          <strong>暂时无法开始心率记录</strong>
          <p>工作人员连接设备后，可继续使用公共心率设备。</p>
        </div>
      ) : (
        <div className="heart-live-grid">
          <BpmRing bpm={showBpm ? bpm : null} state={state} />
          <HeartWaveChart state={state} />
        </div>
      )}

      <div className={`signal-status-bar tone-${signal.tone}`}>
        <span>
          <ShieldCheck size={20} />
        </span>
        <div>
          <strong>{signal.title}</strong>
          <p>{signal.body}</p>
        </div>
      </div>

      <div className="heart-action-row">
        <HeartActionButton
          busy={busy}
          secondsLeft={secondsLeft}
          state={state}
          onCancel={onCancel}
          onFinish={onFinish}
          onJoinQueue={onJoinQueue}
          onNavigate={onNavigate}
          onSaveRecord={onSaveRecord}
        />
      </div>
    </section>
  )
}

function BpmRing({ bpm, state }: { bpm: number | null; state: HeartPageState }) {
  const label = state === 'unstable' ? '信号不稳定' : state === 'finished' ? '本次记录' : state === 'ready' ? '等待信号' : '心率平稳'

  return (
    <div className={`bpm-ring state-${state}`}>
      <div className="bpm-ring-inner">
        <strong>{bpm ?? '--'}</strong>
        <span>BPM</span>
        <p>{label}</p>
      </div>
    </div>
  )
}

function HeartWaveChart({ state }: { state: HeartPageState }) {
  const active = state === 'measuring' || state === 'unstable'
  return (
    <div className="heart-wave-panel">
      <svg viewBox="0 0 420 220" role="img" aria-label="心率波形">
        <defs>
          <pattern id="heartGrid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(35, 92, 92, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="420" height="220" fill="url(#heartGrid)" rx="20" />
        <path
          className={active ? 'wave-line is-active' : 'wave-line'}
          d="M10 126 C28 118 36 118 48 126 S68 134 82 126 L94 74 L110 162 L126 126 C140 112 150 112 160 126 S182 138 194 126 L210 88 L226 142 L244 126 C262 112 274 112 286 126 S310 136 324 126 L342 68 L358 164 L374 126 C390 112 400 112 410 126"
        />
      </svg>
      <div className="wave-status-strip">
        <Waves size={18} />
        {active ? '测量中，请保持手指轻放...' : '等待本次心率记录'}
      </div>
    </div>
  )
}

function HeartActionButton({
  busy,
  secondsLeft,
  state,
  onCancel,
  onFinish,
  onJoinQueue,
  onNavigate,
  onSaveRecord,
}: {
  busy: string
  secondsLeft: number | null
  state: HeartPageState
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onNavigate: (page: AppPage) => void
  onSaveRecord: () => void
}) {
  if (state === 'offline') {
    return (
      <button className="heart-main-button" disabled type="button">
        等待设备恢复
      </button>
    )
  }

  if (state === 'queued') {
    return (
      <button className="heart-main-button is-muted" disabled={busy === 'cancel'} onClick={onCancel} type="button">
        <TimerReset size={20} />
        取消排队
      </button>
    )
  }

  if (state === 'ready') {
    return (
      <button className="heart-main-button" disabled type="button">
        <HeartPulse size={20} />
        请轻放手指
      </button>
    )
  }

  if (state === 'measuring' || state === 'unstable') {
    return (
      <button className="heart-main-button" disabled={busy === 'finish' || secondsLeft === 0} onClick={onFinish} type="button">
        <Square size={18} />
        结束测量
      </button>
    )
  }

  if (state === 'finished') {
    return (
      <button className="heart-main-button" onClick={onSaveRecord} type="button">
        <ShieldCheck size={20} />
        保存本次记录
      </button>
    )
  }

  return (
    <div className="heart-button-stack">
      <button className="heart-main-button" disabled={busy === 'queue'} onClick={onJoinQueue} type="button">
        <HeartPulse size={20} />
        加入测量队列
      </button>
      <button className="heart-text-button" onClick={() => onNavigate('guide')} type="button">
        查看公共设备指引
      </button>
    </div>
  )
}

function RecordSummaryCard({ bpm, duration, state }: { bpm: number; duration: string; state: HeartPageState }) {
  const empty = state === 'idle' || state === 'queued' || state === 'ready' || state === 'offline'
  const status = state === 'unstable' ? '信号不稳定' : state === 'measuring' ? '记录中' : state === 'finished' ? '平稳' : '等待记录'

  return (
    <section className="heart-side-card">
      <h2>
        <LineChart size={20} />
        本次记录摘要
      </h2>
      <div className="summary-list">
        <SummaryRow icon={<HeartPulse size={20} />} label="平均心率" value={empty ? '-- BPM' : `${bpm} BPM`} />
        <SummaryRow icon={<Clock3 size={20} />} label="测量时长" value={empty ? '--:--' : duration} />
        <SummaryRow icon={<Waves size={20} />} label="状态评估" value={status} tone={state === 'unstable' ? 'warning' : 'good'} />
      </div>
    </section>
  )
}

function SummaryRow({ icon, label, tone, value }: { icon: ReactNode; label: string; tone?: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{icon}</span>
      <p>{label}</p>
      <strong className={tone ? `tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}

function RecentRecordsCard({
  records,
  onOpenRecords,
}: {
  records: Array<{ date: string; bpm: number; status: string }>
  onOpenRecords: () => void
}) {
  return (
    <section className="heart-side-card recent-card">
      <div className="recent-card-head">
        <h2>最近记录</h2>
        <button onClick={onOpenRecords} type="button">查看全部 〉</button>
      </div>
      <div className="recent-record-list">
        {records.slice(0, 5).map((record) => (
          <div className="recent-record-item" key={`${record.date}-${record.bpm}`}>
            <span className={record.status === '轻微波动' ? 'dot-warning' : 'dot-good'}></span>
            <p>{record.date}</p>
            <strong>{record.bpm} <small>BPM</small></strong>
            <em className={record.status === '轻微波动' ? 'is-warning' : ''}>{record.status}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function HeartTrendCard({
  records,
  onOpenRecords,
}: {
  records: Array<{ date: string; bpm: number; status: string }>
  onOpenRecords: () => void
}) {
  const points = records.slice(0, 7).reverse()
  return (
    <section className="heart-trend-card">
      <div className="trend-head">
        <h2>
          <LineChart size={20} />
          心率趋势
        </h2>
        <button onClick={onOpenRecords} type="button">查看完整记录⌄</button>
      </div>
      <div className="trend-chart">
        <svg viewBox="0 0 920 190" role="img" aria-label="心率趋势图">
          <path className="trend-grid" d="M20 35H900M20 80H900M20 125H900M20 170H900" />
          <path className="trend-reference" d="M20 126H900" />
          <polyline
            className="trend-heart-line"
            points={points.map((point, index) => `${50 + index * (820 / Math.max(points.length - 1, 1))},${170 - (point.bpm - 45) * 1.55}`).join(' ')}
          />
          {points.map((point, index) => (
            <circle
              className="trend-dot"
              cx={50 + index * (820 / Math.max(points.length - 1, 1))}
              cy={170 - (point.bpm - 45) * 1.55}
              key={`${point.date}-${index}`}
              r="5"
            />
          ))}
        </svg>
        <div className="trend-labels">
          {points.map((point) => (
            <span key={point.date}>{point.date.slice(5, 10)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function getHeartPageState(stage: StageKey, currentStatus: string, deviceHumanState: string): HeartPageState {
  if (stage === 'waiting') return 'queued'
  if (deviceHumanState === '设备离线') return 'offline'
  if (stage === 'ready') return 'ready'
  if (currentStatus === 'ADJUST_FINGER') return 'unstable'
  if (stage === 'measuring') return 'measuring'
  if (stage === 'tongue' || stage === 'observation') return 'finished'
  return 'idle'
}

function getMainCardCopy(state: HeartPageState, peopleAhead: number) {
  const copy: Record<HeartPageState, { title: string; description: string }> = {
    idle: {
      title: '开始一次心率记录',
      description: '使用校园公共设备完成一次心率记录，整个过程大约 1 分钟。',
    },
    queued: {
      title: '已加入测量队列',
      description: `前方还有 ${peopleAhead} 位同学，请等待小站呼叫。`,
    },
    ready: {
      title: '轮到你了，请开始测量',
      description: '请将手指轻放在心率传感器上，等待信号稳定。',
    },
    measuring: {
      title: '正在记录心率',
      description: '请保持手指轻放，不要频繁移动。',
    },
    unstable: {
      title: '信号不稳定',
      description: '请轻轻调整手指位置，保持接触稳定。',
    },
    finished: {
      title: '本次心率记录已完成',
      description: '你可以保存本次记录，也可以稍后补充舌象图片。',
    },
    offline: {
      title: '暂时无法开始心率记录',
      description: '工作人员连接设备后，可继续使用公共心率设备。',
    },
  }
  return copy[state]
}

function getSignalCopy(state: HeartPageState, currentStatus: string) {
  if (state === 'unstable' || currentStatus === 'ADJUST_FINGER') {
    return { title: '请调整手指位置', body: '手指不要按压过重，也不要频繁移动。', tone: 'warning' }
  }
  if (state === 'measuring') return { title: '信号稳定', body: '请保持手指轻放，不要移动。', tone: 'good' }
  if (state === 'queued') return { title: '等待轮到你', body: '排队中暂时不需要放置手指。', tone: 'calm' }
  if (state === 'offline') return { title: '设备暂不可用', body: '你仍然可以查看最近记录和趋势参考。', tone: 'calm' }
  if (state === 'finished') return { title: '记录已完成', body: '本次数据已进入记录摘要，可作为趋势参考。', tone: 'good' }
  return { title: '等待开始', body: '点击开始测量后，小站会为你分配公共设备。', tone: 'calm' }
}

function buildRecentRecords(history: HistoryResponse['items']) {
  const records = history
    .filter((item) => item.heart?.bpm)
    .slice(0, 5)
    .map((item) => ({
      date: formatDateTime(item.heart?.created_at || item.session?.created_at),
      bpm: item.heart?.bpm || 0,
      status: (item.heart?.bpm || 0) >= 84 ? '轻微波动' : '平稳',
    }))

  return records.length ? records : sampleRecords
}

function latestBpm(history: HistoryResponse['items']) {
  return history.find((item) => item.heart?.bpm)?.heart?.bpm || null
}

function formatDateTime(timestamp?: number | null) {
  if (!timestamp) return '--'
  const date = new Date(timestamp * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`
}

function formatCountdown(seconds: number) {
  const clean = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(clean / 60)).padStart(2, '0')}:${String(clean % 60).padStart(2, '0')}`
}

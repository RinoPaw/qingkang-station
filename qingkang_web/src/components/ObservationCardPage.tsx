import type { ReactNode } from 'react'
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Coffee,
  HeartPulse,
  Leaf,
  LineChart,
  Loader2,
  Moon,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import { demoWeekLabels, formatDemoDateTime } from '../lib/demoDates'
import type { HistoryResponse, SessionPayload, User } from '../types/index'

type ObservationCardPageProps = {
  bpm: number | null
  currentPayload: SessionPayload | null
  debugPanel: ReactNode
  history: HistoryResponse['items']
  reportState: 'idle' | 'generating' | 'ready'
  user: User | null
  onGenerateReport: () => void
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

type ObservationMetric = {
  label: string
  value: string
  detail: string
}

export function ObservationCardPage({
  bpm,
  currentPayload,
  debugPanel,
  history,
  reportState,
  user,
  onGenerateReport,
  onLogout,
  onNavigate,
}: ObservationCardPageProps) {
  const latestBpm = bpm || latestHeartFromHistory(history) || 82
  const hasHeart = Boolean(bpm || currentPayload?.heart || history.some((item) => item.heart?.bpm))
  const hasTongue = Boolean(currentPayload?.tongue || history.some((item) => item.tongue))
  const hasAnyRecord = hasHeart || hasTongue
  const reportReady = reportState === 'ready'
  const reportGenerating = reportState === 'generating'
  const metrics = buildMetrics(latestBpm, hasHeart, hasTongue)
  const trend = buildTrend(history)
  const observationScore = reportReady ? (hasHeart && hasTongue ? 86 : 72) : 0
  const readyText = reportGenerating
    ? '正在生成观察卡'
    : reportReady
      ? hasHeart && hasTongue
        ? '本次记录已汇总'
        : '单项观察卡已生成'
      : hasAnyRecord
        ? '记录素材待生成'
        : '等待记录素材'

  return (
    <main className="home-shell observation-page-shell">
      <SidebarNavigation activePage="observation" onNavigate={onNavigate} />

      <section className="observation-page-main">
        <AppTopbar className="observation-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="observation-title">
          <div>
            <h1>
              综合观察卡
              <span>
                <BookOpenCheck size={22} />
              </span>
            </h1>
            <p>整合心率记录与舌象图片，形成一次轻量状态观察</p>
          </div>
          <div className="observation-title-note">
            <Sparkles size={20} />
            <span>
              <strong>{readyText}</strong>
              <small>可作为个人趋势参考</small>
            </span>
          </div>
        </header>

        <section className="observation-workspace">
          <section className="observation-main-card">
            <div className="observation-main-head">
              <div>
                <p>本次状态观察</p>
                <h2>{mainTitle(reportState, hasHeart, hasTongue)}</h2>
              </div>
              <span>{reportGenerating ? '生成中' : reportReady ? '仅作自我观察' : '等待生成'}</span>
            </div>

            <div className="observation-hero-grid">
              <div className={`observation-score-ring ${observationScore ? '' : 'is-empty'} ${reportGenerating ? 'is-generating' : ''}`}>
                <strong>{observationScore || '--'}</strong>
                <span>观察指数</span>
                <small>{scoreCaption(reportState, hasHeart, hasTongue)}</small>
              </div>

              <div className="observation-summary-copy">
                <strong>{summaryCopy(reportState, hasHeart, hasTongue)}</strong>
                <p>
                  {reportReady
                    ? '系统会优先查看本次心率记录、舌象图片质量和最近趋势，再生成茶息、呼吸放松与作息提醒。'
                    : '心率记录和舌象图片可按任意顺序补充；两项都齐时会自动生成，只有一项时可手动生成单项观察卡。'}
                </p>
                <div className="observation-action-row">
                  {!reportReady && hasAnyRecord && (
                    <button disabled={reportGenerating} onClick={onGenerateReport} type="button">
                      {reportGenerating ? <Loader2 size={18} /> : <Sparkles size={18} />}
                      {reportGenerating ? '生成中...' : '生成观察卡'}
                    </button>
                  )}
                  {(!hasHeart || reportReady) && (
                    <button className={reportReady ? '' : 'is-light'} onClick={() => onNavigate('heart')} type="button">
                      <HeartPulse size={18} />
                      {hasHeart ? '查看心率' : '补充心率'}
                    </button>
                  )}
                  {(!hasTongue || reportReady) && (
                    <button className="is-light" onClick={() => onNavigate('tongue')} type="button">
                      <ScanLine size={18} />
                      {hasTongue ? '查看舌象' : '上传舌象'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="observation-metric-grid">
              {metrics.map((metric) => (
                <article className="observation-metric-card" key={metric.label}>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <span>{metric.detail}</span>
                </article>
              ))}
            </div>
          </section>

          <aside className="observation-side-stack">
            <ObservationAdviceCard reportState={reportState} />
            <ObservationDataCard hasHeart={hasHeart} hasTongue={hasTongue} latestBpm={latestBpm} reportState={reportState} />
          </aside>
        </section>

        <section className="observation-bottom-grid">
          <ObservationTrendCard trend={trend} />
          <ObservationTimelineCard onOpenRecords={() => onNavigate('records')} />
        </section>

        {debugPanel}

        <DisclaimerBar />
      </section>
    </main>
  )
}

function ObservationAdviceCard({ reportState }: { reportState: 'idle' | 'generating' | 'ready' }) {
  if (reportState !== 'ready') {
    return (
      <section className="observation-side-card">
        <h2>
          <Sparkles size={20} />
          观察卡状态
        </h2>
        <div className="observation-advice-list">
          <article className="observation-advice-item">
            <span>{reportState === 'generating' ? <Loader2 size={22} /> : <ClipboardIcon />}</span>
            <div>
              <strong>{reportState === 'generating' ? '正在生成观察卡' : '等待手动生成'}</strong>
              <p>{reportState === 'generating' ? '小站正在整理本次记录素材，请稍等片刻。' : '已有单项记录时，可以手动生成观察卡；两项都齐时会自动生成。'}</p>
            </div>
          </article>
        </div>
      </section>
    )
  }

  const advice = [
    {
      icon: <Coffee size={22} />,
      title: '茶息建议',
      body: '午后可选择清淡茶饮或温水补充，配合短暂离屏休息。',
    },
    {
      icon: <Wind size={22} />,
      title: '呼吸放松建议',
      body: '学习间隙进行 2 分钟慢呼吸，帮助记录时保持稳定状态。',
    },
    {
      icon: <Moon size={22} />,
      title: '作息提醒',
      body: '若连续多次出现波动，建议优先回看睡眠、饮水和学习压力。',
    },
  ]

  return (
    <section className="observation-side-card">
      <h2>
        <Leaf size={20} />
        本次轻建议
      </h2>
      <div className="observation-advice-list">
        {advice.map((item) => (
          <article className="observation-advice-item" key={item.title}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ObservationDataCard({
  hasHeart,
  hasTongue,
  latestBpm,
  reportState,
}: {
  hasHeart: boolean
  hasTongue: boolean
  latestBpm: number
  reportState: 'idle' | 'generating' | 'ready'
}) {
  return (
    <section className="observation-side-card observation-data-card">
      <h2>
        <ShieldCheck size={20} />
        记录完整度
      </h2>
      <div className="observation-data-row">
        <span className={hasHeart ? 'is-done' : ''}>{hasHeart ? <CheckCircle2 size={18} /> : <HeartPulse size={18} />}</span>
        <p>心率记录</p>
        <strong>{hasHeart ? `${latestBpm} BPM` : '待补充'}</strong>
      </div>
      <div className="observation-data-row">
        <span className={hasTongue ? 'is-done' : ''}>{hasTongue ? <CheckCircle2 size={18} /> : <ScanLine size={18} />}</span>
        <p>舌象图片</p>
        <strong>{hasTongue ? '已记录' : '待上传'}</strong>
      </div>
      <div className="observation-data-row">
        <span className={hasHeart || hasTongue ? 'is-done' : ''}>
          <CalendarClock size={18} />
        </span>
        <p>观察卡</p>
        <strong>{reportState === 'ready' ? '已生成' : reportState === 'generating' ? '生成中' : '待生成'}</strong>
      </div>
    </section>
  )
}

function ClipboardIcon() {
  return <BookOpenCheck size={22} />
}

function ObservationTrendCard({ trend }: { trend: Array<{ date: string; bpm: number }> }) {
  const points = trend.map((point, index) => `${44 + index * (480 / Math.max(trend.length - 1, 1))},${160 - (point.bpm - 55) * 2}`)

  return (
    <section className="observation-trend-card">
      <div className="observation-card-head">
        <h2>
          <LineChart size={20} />
          心率趋势参考
        </h2>
        <span>近 7 次</span>
      </div>
      <svg viewBox="0 0 580 190" role="img" aria-label="心率趋势参考">
        <path className="observation-grid-line" d="M30 38H552M30 82H552M30 126H552M30 170H552" />
        <path className="observation-reference-line" d="M30 126H552" />
        <polyline className="observation-trend-line" points={points.join(' ')} />
        {trend.map((point, index) => (
          <circle
            className="observation-trend-dot"
            cx={44 + index * (480 / Math.max(trend.length - 1, 1))}
            cy={160 - (point.bpm - 55) * 2}
            key={`${point.date}-${index}`}
            r="5"
          />
        ))}
      </svg>
      <div className="observation-trend-labels">
        {trend.map((point) => (
          <span key={point.date}>{point.date}</span>
        ))}
      </div>
    </section>
  )
}

function ObservationTimelineCard({ onOpenRecords }: { onOpenRecords: () => void }) {
  const observationLogs = buildObservationLogs()

  return (
    <section className="observation-timeline-card">
      <div className="observation-card-head">
        <h2>最近观察记录</h2>
        <button onClick={onOpenRecords} type="button">查看全部 〉</button>
      </div>
      <div className="observation-log-list">
        {observationLogs.map((item) => (
          <article className="observation-log-item" key={item.date}>
            <span></span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.date}</p>
            </div>
            <em>{item.tag}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

function buildMetrics(latestBpm: number, hasHeart: boolean, hasTongue: boolean): ObservationMetric[] {
  return [
    {
      label: '心率记录',
      value: hasHeart ? `${latestBpm} BPM` : '待补充',
      detail: hasHeart ? '较近期记录保持平稳' : '前往公共设备完成一次记录',
    },
    {
      label: '舌象图片',
      value: hasTongue ? '已记录' : '待上传',
      detail: hasTongue ? '图片质量已进入本次观察' : '可单独上传舌象图片',
    },
    {
      label: '趋势档案',
      value: hasHeart || hasTongue ? '已更新' : '待生成',
      detail: hasHeart || hasTongue ? '用于后续长期趋势参考' : '完成记录后自动沉淀',
    },
  ]
}

function mainTitle(reportState: 'idle' | 'generating' | 'ready', hasHeart: boolean, hasTongue: boolean) {
  if (reportState === 'generating') return '正在生成观察卡'
  if (reportState === 'ready') return hasHeart && hasTongue ? '双模态观察卡已生成' : '单项观察卡已生成'
  if (hasHeart || hasTongue) return '记录素材已就绪'
  return '先补充一次记录'
}

function scoreCaption(reportState: 'idle' | 'generating' | 'ready', hasHeart: boolean, hasTongue: boolean) {
  if (reportState === 'generating') return '生成中'
  if (reportState !== 'ready') return hasHeart || hasTongue ? '待生成' : '等待记录'
  return hasHeart && hasTongue ? '资料较完整' : '单项参考'
}

function summaryCopy(reportState: 'idle' | 'generating' | 'ready', hasHeart: boolean, hasTongue: boolean) {
  if (reportState === 'generating') return '正在整理本次记录素材，请稍等片刻。'
  if (reportState !== 'ready') {
    if (hasHeart && hasTongue) return '心率与舌象图片已齐，观察卡会自动生成。'
    if (hasHeart) return '已有心率记录，可手动生成观察卡，也可继续补充舌象图片。'
    if (hasTongue) return '已有舌象图片，可手动生成观察卡，也可继续补充心率记录。'
    return '先完成心率记录或上传舌象图片，再生成本次观察卡。'
  }
  if (hasHeart && hasTongue) return '本次心率与舌象图片已汇总，可查看轻量观察建议。'
  if (hasHeart) return '已基于心率记录生成观察卡，补充舌象图片后内容会更完整。'
  if (hasTongue) return '已基于舌象图片生成观察卡，补充心率记录后可形成双模态参考。'
  return '先完成心率记录或上传舌象图片，再生成本次观察卡。'
}

function latestHeartFromHistory(history: HistoryResponse['items']) {
  return history.find((item) => item.heart?.bpm)?.heart?.bpm || null
}

function buildTrend(history: HistoryResponse['items']) {
  const items = history
    .filter((item) => item.heart?.bpm)
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      date: item.heart?.created_at ? formatMonthDay(item.heart.created_at) : '--',
      bpm: item.heart?.bpm || 0,
    }))

  return items.length >= 2 ? items : buildFallbackHeartTrend()
}

function buildFallbackHeartTrend() {
  return demoWeekLabels().map((date, index) => ({
    date,
    bpm: [82, 79, 86, 76, 90, 74, 84][index],
  }))
}

function buildObservationLogs() {
  return [
    { date: formatDemoDateTime(0, 10, 32), title: '心率与舌象已汇总', tag: '观察卡' },
    { date: formatDemoDateTime(1, 22, 15), title: '舌象图片已记录', tag: '图片记录' },
    { date: formatDemoDateTime(2, 16, 45), title: '心率趋势已更新', tag: '趋势参考' },
  ]
}

function formatMonthDay(timestamp: number) {
  const date = new Date(timestamp * 1000)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

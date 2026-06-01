import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FileText,
  HeartPulse,
  Leaf,
  LineChart,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import { demoWeekLabels, formatDemoDateTime } from '../lib/demoDates'
import type { HistoryResponse, SessionPayload, User } from '../types/index'

type RecordsPageProps = {
  history: HistoryResponse['items']
  user: User | null
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

type RecordItem = {
  id: string
  time: string
  title: string
  kind: 'combined' | 'heart' | 'tongue'
  heartText: string
  tongueText: string
  note: string
}

export function RecordsPage({ history, user, onLogout, onNavigate }: RecordsPageProps) {
  const records = buildRecords(history)
  const visibleRecords = records.length ? records : buildFallbackRecords()
  const heartCount = visibleRecords.filter((item) => item.heartText !== '待补充').length
  const tongueCount = visibleRecords.filter((item) => item.tongueText !== '待上传').length
  const combinedCount = visibleRecords.filter((item) => item.kind === 'combined').length
  const trend = buildRecordsTrend(history)

  return (
    <main className="home-shell records-page-shell">
      <SidebarNavigation activePage="records" onNavigate={onNavigate} />

      <section className="records-page-main">
        <AppTopbar className="records-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="records-title">
          <div>
            <h1>
              我的记录
              <span>
                <FileText size={22} />
              </span>
            </h1>
            <p>回看每一次心率记录、舌象图片和综合观察卡</p>
          </div>
          <button className="records-title-action" onClick={() => onNavigate('observation')} type="button">
            <BookOpenCheck size={19} />
            查看观察卡
          </button>
        </header>

        <section className="records-summary-grid">
          <SummaryTile icon={<CalendarDays size={22} />} label="累计记录" value={`${visibleRecords.length} 次`} />
          <SummaryTile icon={<HeartPulse size={22} />} label="心率记录" value={`${heartCount} 次`} />
          <SummaryTile icon={<ScanLine size={22} />} label="舌象图片" value={`${tongueCount} 张`} />
          <SummaryTile icon={<BookOpenCheck size={22} />} label="观察卡" value={`${combinedCount} 张`} />
        </section>

        <section className="records-workspace">
          <section className="records-timeline-card">
            <div className="records-card-head">
              <h2>
                <Clock3 size={20} />
                最近记录时间轴
              </h2>
              <span>按时间更新</span>
            </div>

            <div className="records-timeline-list">
              {visibleRecords.map((item) => (
                <article className={`records-timeline-item is-${item.kind}`} key={item.id}>
                  <span className="records-timeline-dot">{recordIcon(item.kind)}</span>
                  <div className="records-timeline-body">
                    <p>{item.time}</p>
                    <h3>{item.title}</h3>
                    <div className="records-data-strip">
                      <span>
                        <HeartPulse size={16} />
                        {item.heartText}
                      </span>
                      <span>
                        <ScanLine size={16} />
                        {item.tongueText}
                      </span>
                    </div>
                    <strong>{item.note}</strong>
                  </div>
                  <button onClick={() => onNavigate(item.kind === 'tongue' ? 'tongue' : item.kind === 'heart' ? 'heart' : 'observation')} type="button">
                    查看
                  </button>
                </article>
              ))}
            </div>
          </section>

          <aside className="records-side-stack">
            <section className="records-side-card">
              <h2>
                <ShieldCheck size={20} />
                个人档案摘要
              </h2>
              <div className="records-profile-card">
                <span>
                  <CircleUserRound size={28} />
                </span>
                <div>
                  <strong>{user?.nickname || '同学'}</strong>
                  <p>{user ? '已创建身份' : '待创建身份'}</p>
                </div>
              </div>
              <div className="records-profile-list">
                <p>
                  <CheckCircle2 size={17} />
                  记录用于个人趋势参考
                </p>
                <p>
                  <Sparkles size={17} />
                  心率与舌象可分别补充
                </p>
                <p>
                  <Leaf size={17} />
                  建议以茶息和作息提醒为主
                </p>
              </div>
            </section>

            <section className="records-side-card">
              <h2>
                <LineChart size={20} />
                本周节奏
              </h2>
              <div className="records-week-grid">
                {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
                  <span className={index === 1 || index === 4 || index === 6 ? 'is-filled' : ''} key={day}>
                    {day}
                  </span>
                ))}
              </div>
              <p className="records-week-note">建议保持每周 2-3 次轻量记录，观察变化即可。</p>
            </section>
          </aside>
        </section>

        <section className="records-trend-card">
          <div className="records-card-head">
            <h2>
              <LineChart size={20} />
              长期心率趋势
            </h2>
            <span>趋势参考</span>
          </div>
          <svg viewBox="0 0 860 190" role="img" aria-label="长期心率趋势">
            <path className="records-grid-line" d="M28 34H832M28 78H832M28 122H832M28 166H832" />
            <path className="records-reference-line" d="M28 122H832" />
            <polyline className="records-heart-line" points={trend.map((point, index) => `${52 + index * (744 / Math.max(trend.length - 1, 1))},${166 - (point.bpm - 55) * 2}`).join(' ')} />
            {trend.map((point, index) => (
              <circle
                className="records-trend-dot"
                cx={52 + index * (744 / Math.max(trend.length - 1, 1))}
                cy={166 - (point.bpm - 55) * 2}
                key={`${point.date}-${index}`}
                r="5"
              />
            ))}
          </svg>
          <div className="records-trend-labels">
            {trend.map((point) => (
              <span key={point.date}>{point.date}</span>
            ))}
          </div>
        </section>

        <DisclaimerBar />
      </section>
    </main>
  )
}

function SummaryTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="records-summary-tile">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}

function recordIcon(kind: RecordItem['kind']) {
  if (kind === 'combined') return <BookOpenCheck size={20} />
  if (kind === 'tongue') return <ScanLine size={20} />
  return <HeartPulse size={20} />
}

function buildRecords(history: HistoryResponse['items']): RecordItem[] {
  return history.filter((item) => item.heart?.bpm || item.tongue).slice(0, 8).map((item, index) => {
    const hasHeart = Boolean(item.heart?.bpm)
    const hasTongue = Boolean(item.tongue)
    const kind: RecordItem['kind'] = hasHeart && hasTongue ? 'combined' : hasTongue ? 'tongue' : 'heart'
    const title = hasHeart && hasTongue ? '心率与舌象已汇总' : hasTongue ? '舌象图片已记录' : '心率记录已完成'
    const time = formatRecordTime(item.heart?.created_at || item.tongue?.created_at || item.session?.created_at)

    return {
      id: `${time}-${index}`,
      time,
      title,
      kind,
      heartText: hasHeart ? `${item.heart?.bpm} BPM` : '待补充',
      tongueText: hasTongue ? imageQualityText(item) : '待上传',
      note: recordNote(hasHeart, hasTongue),
    }
  })
}

function imageQualityText(item: SessionPayload) {
  if (!item.tongue) return '待上传'
  if (!item.tongue.tongue_detected) return '建议确认'
  if (item.tongue.quality?.includes('清晰')) return '清晰'
  if (item.tongue.quality?.includes('略暗')) return '略暗'
  if (item.tongue.quality?.includes('模糊')) return '轻微模糊'
  if (item.tongue.quality?.includes('完整')) return '区域待确认'
  return '图片已记录'
}

function recordNote(hasHeart: boolean, hasTongue: boolean) {
  if (hasHeart && hasTongue) return '本次记录已进入综合观察卡，可作为后续趋势参考。'
  if (hasHeart) return '本次心率记录已保存，可稍后补充舌象图片。'
  if (hasTongue) return '本次舌象图片已保存，可稍后补充心率记录。'
  return '本次记录素材较少，建议继续补充。'
}

function buildRecordsTrend(history: HistoryResponse['items']) {
  const points = history
    .filter((item) => item.heart?.bpm)
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      date: item.heart?.created_at ? formatMonthDay(item.heart.created_at) : '--',
      bpm: item.heart?.bpm || 0,
    }))

  if (points.length >= 2) return points
  return demoWeekLabels().map((date, index) => ({
    date,
    bpm: [76, 82, 79, 86, 80, 74, 84][index],
  }))
}

function buildFallbackRecords(): RecordItem[] {
  return [
    {
      id: 'sample-1',
      time: formatDemoDateTime(0, 10, 32),
      title: '心率与舌象已汇总',
      kind: 'combined',
      heartText: '78 BPM',
      tongueText: '图片清晰',
      note: '建议继续保持规律作息与适度运动。',
    },
    {
      id: 'sample-2',
      time: formatDemoDateTime(1, 22, 15),
      title: '舌象图片已记录',
      kind: 'tongue',
      heartText: '待补充',
      tongueText: '略暗，已保存',
      note: '下次可在自然光下重新记录，便于形成更清晰的趋势参考。',
    },
    {
      id: 'sample-3',
      time: formatDemoDateTime(2, 16, 45),
      title: '心率记录已完成',
      kind: 'heart',
      heartText: '72 BPM',
      tongueText: '待上传',
      note: '本次心率记录已进入个人档案，可稍后补充舌象图片。',
    },
  ]
}

function formatRecordTime(timestamp?: number | null) {
  if (!timestamp) return '--'
  const date = new Date(timestamp * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`
}

function formatMonthDay(timestamp: number) {
  const date = new Date(timestamp * 1000)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

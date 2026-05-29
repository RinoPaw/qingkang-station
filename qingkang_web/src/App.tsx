import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  Cable,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudUpload,
  Cpu,
  Database,
  HeartPulse,
  History,
  Loader2,
  LogIn,
  Monitor,
  Radio,
  ScanLine,
  ShieldCheck,
  Smartphone,
  UserRound,
  Waves,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  API_BASE,
  DEVICE_ID,
  cancelSession,
  fetchHistory,
  fetchSession,
  finishSession,
  joinQueue,
  loginUser,
  pollDevice,
  uploadTongueImage,
} from './api'
import type { DevicePollResponse, HistoryResponse, SessionPayload, User } from './types'

const STORAGE_USER = 'qingkang_user'
const STORAGE_SESSION = 'qingkang_session_id'
const STORAGE_NICKNAME = 'qingkang_nickname'

type ViewMode = 'student' | 'terminal'
type StageKey = 'identity' | 'queue' | 'waiting' | 'ready' | 'measuring' | 'tongue' | 'observation'

const flowSteps = [
  { key: 'identity', label: '创建身份' },
  { key: 'queue', label: '加入队列' },
  { key: 'ready', label: '轮到你' },
  { key: 'heart', label: '心率测量' },
  { key: 'tongue', label: '上传舌象' },
  { key: 'result', label: '观察卡' },
]

const finalStatuses = new Set(['FINISHED', 'TIMEOUT', 'CANCELLED'])

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function formatClock(ts?: number | null) {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusFromPayload(payload: SessionPayload | null, device: DevicePollResponse | null) {
  const sessionStatus = payload?.session?.status
  if (sessionStatus && finalStatuses.has(sessionStatus)) return sessionStatus
  if (payload?.heart?.state) return payload.heart.state
  if (sessionStatus) return sessionStatus
  if (device?.state === 'DISCONNECTED') return 'DISCONNECTED'
  return 'IDLE'
}

function cnStatus(status?: string | null) {
  if (!status) return '待记录'
  const map: Record<string, string> = {
    IDLE: '设备空闲',
    QUEUED: '排队中',
    READY: '轮到你了',
    PLACE_FINGER: '请放手指',
    HOLD_STILL: '稳定信号中',
    MEASURING: '正在测量',
    ADJUST_FINGER: '请调整手指',
    FINISHED: '心率记录完成',
    TIMEOUT: '测量超时',
    CANCELLED: '已取消',
    DISCONNECTED: '设备离线',
  }
  return map[status] || status
}

function safeBpm(value?: number | null) {
  return value && value > 0 ? value : null
}

function isActiveSession(payload: SessionPayload | null) {
  return payload?.session?.status === 'READY' || payload?.session?.status === 'MEASURING'
}

function getPeopleAhead(payload: SessionPayload | null) {
  return payload?.queue?.people_ahead ?? 0
}

function getDeviceHumanState(device: DevicePollResponse | null, payload: SessionPayload | null) {
  if (!device || device.state === 'DISCONNECTED') return '设备离线'
  if (isActiveSession(payload)) return '设备已分配给你'
  if (device.active_session) return '正在服务其他同学'
  return '设备空闲'
}

function getStage(user: User | null, payload: SessionPayload | null, currentStatus: string): StageKey {
  const status = payload?.session?.status
  if (!user) return 'identity'
  if (payload?.tongue) return 'observation'
  if (status === 'FINISHED') return 'tongue'
  if (!payload?.session || status === 'TIMEOUT' || status === 'CANCELLED') return 'queue'
  if (status === 'QUEUED') return 'waiting'
  if (currentStatus === 'HOLD_STILL' || currentStatus === 'MEASURING' || currentStatus === 'ADJUST_FINGER') {
    return 'measuring'
  }
  if (status === 'READY' || currentStatus === 'READY' || currentStatus === 'PLACE_FINGER') return 'ready'
  return 'queue'
}

function progressKeyForStage(stage: StageKey) {
  const map: Record<StageKey, string> = {
    identity: 'identity',
    queue: 'queue',
    waiting: 'queue',
    ready: 'ready',
    measuring: 'heart',
    tongue: 'tongue',
    observation: 'result',
  }
  return map[stage]
}

function getMainPrompt(
  status: string,
  payload: SessionPayload | null,
  user: User | null,
  device: DevicePollResponse | null,
) {
  const peopleAhead = getPeopleAhead(payload)
  const deviceBusy = Boolean(device?.active_session && !payload?.queue?.is_active)

  if (payload?.tongue) {
    return {
      title: '观察卡已生成',
      description: '可以查看本次心率与舌象记录合并后的非诊断性观察建议。',
      action: '查看综合观察卡',
      tone: 'done',
    }
  }

  if (!user) {
    return {
      title: '第一步：创建身份',
      description: '先用一个昵称绑定本次记录，之后页面会按队列引导测量。',
      action: '输入昵称并创建身份',
      tone: 'calm',
    }
  }

  if (!payload?.session) {
    return {
      title: '第二步：加入测量队列',
      description: deviceBusy ? '前面有同学正在测量，你可以先加入队列。' : '加入队列后，系统会为你分配本次心率记录。',
      action: '加入测量队列',
      tone: deviceBusy ? 'waiting' : 'ready',
    }
  }

  const map: Record<string, { title: string; description: string; action: string; tone: string }> = {
    IDLE: {
      title: '第二步：加入测量队列',
      description: '点击加入队列，轮到你时页面会自动提示。',
      action: '加入测量队列',
      tone: 'calm',
    },
    QUEUED: {
      title: `你前面还有 ${peopleAhead} 位`,
      description: '请在小站附近等待，轮到你时再把手指放上传感器。',
      action: peopleAhead > 0 ? '等待轮到你' : '即将轮到你',
      tone: 'waiting',
    },
    READY: {
      title: '轮到你了，请将手指轻放在传感器上',
      description: '轻放即可，不要用力按压，等待页面进入测量状态。',
      action: '请轻放手指',
      tone: 'ready',
    },
    PLACE_FINGER: {
      title: '轮到你了，请将手指轻放在传感器上',
      description: '轻放即可，不要用力按压，等待页面进入测量状态。',
      action: '请轻放手指',
      tone: 'ready',
    },
    HOLD_STILL: {
      title: '正在测量，请保持手指',
      description: '传感器正在稳定读取，请不要移开手指。',
      action: '请保持手指',
      tone: 'measuring',
    },
    MEASURING: {
      title: '正在测量，请保持手指',
      description: '正在测量，请保持手指，不要移开。',
      action: '请保持手指',
      tone: 'measuring',
    },
    ADJUST_FINGER: {
      title: '信号不稳定',
      description: '请轻轻调整手指位置，让传感器能稳定读取。',
      action: '轻轻调整手指',
      tone: 'warning',
    },
    FINISHED: {
      title: '下一步：上传舌象图片',
      description: '心率记录已完成，上传一张舌象图片后生成综合观察卡。',
      action: '上传舌象图片',
      tone: 'done',
    },
    TIMEOUT: {
      title: '重新加入测量队列',
      description: '本次测量已超时，可以重新排队完成一次心率记录。',
      action: '加入测量队列',
      tone: 'warning',
    },
    CANCELLED: {
      title: '重新加入测量队列',
      description: '本次记录已取消，需要继续测量时可以重新排队。',
      action: '加入测量队列',
      tone: 'calm',
    },
    DISCONNECTED: {
      title: '设备离线',
      description: '请等待工作人员检查小站设备连接。',
      action: '暂时无法测量',
      tone: 'danger',
    },
  }

  return map[status] || map.IDLE
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('student')
  const [nickname, setNickname] = useState(localStorage.getItem(STORAGE_NICKNAME) || '')
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [sessionId, setSessionId] = useState(localStorage.getItem(STORAGE_SESSION) || '')
  const [sessionPayload, setSessionPayload] = useState<SessionPayload | null>(null)
  const [devicePoll, setDevicePoll] = useState<DevicePollResponse | null>(null)
  const [history, setHistory] = useState<HistoryResponse['items']>([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  const refreshHistory = useCallback(
    async (targetUser = user) => {
      const response = await fetchHistory(targetUser?.user_id)
      setHistory(response.items)
    },
    [user],
  )

  const refreshSession = useCallback(
    async (targetSessionId = sessionId) => {
      if (!targetSessionId) return
      const payload = await fetchSession(targetSessionId)
      setSessionPayload(payload)
    },
    [sessionId],
  )

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loop() {
      try {
        const response = await pollDevice()
        if (!cancelled) setDevicePoll(response)
      } catch {
        if (!cancelled) {
          setDevicePoll({
            ok: false,
            server_time: Math.floor(Date.now() / 1000),
            device_id: DEVICE_ID,
            state: 'DISCONNECTED',
            active_session: null,
            heart_upload: '/api/heart-rate',
            poll_interval_ms: 1000,
            message: 'Device API unavailable',
          })
        }
      }
    }
    loop()
    const timer = window.setInterval(loop, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loop() {
      if (!sessionId) return
      try {
        const payload = await fetchSession(sessionId)
        if (!cancelled) setSessionPayload(payload)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '无法读取当前记录')
      }
    }
    loop()
    const timer = window.setInterval(loop, 1800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshHistory().catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshHistory, sessionPayload?.session?.status, sessionPayload?.heart?.created_at])

  const currentStatus = statusFromPayload(sessionPayload, devicePoll)
  const mainPrompt = getMainPrompt(currentStatus, sessionPayload, user, devicePoll)
  const activeSession = sessionPayload?.session
  const bpm = safeBpm(sessionPayload?.heart?.bpm)
  const secondsLeft = activeSession?.expires_at ? Math.max(activeSession.expires_at - now, 0) : null
  const stage = getStage(user, sessionPayload, currentStatus)
  const peopleAhead = getPeopleAhead(sessionPayload)
  const deviceHumanState = getDeviceHumanState(devicePoll, sessionPayload)

  const chartData = useMemo(() => {
    const data = history
      .filter((item) => item.heart?.bpm)
      .slice()
      .reverse()
      .map((item, index) => ({
        name: item.session?.nickname || `记录 ${index + 1}`,
        bpm: item.heart?.bpm || 0,
        time: formatClock(item.heart?.created_at),
      }))

    if (data.length) return data
    return [
      { name: '样例 1', bpm: 76, time: '--' },
      { name: '样例 2', bpm: 82, time: '--' },
      { name: '样例 3', bpm: 79, time: '--' },
    ]
  }, [history])

  async function handleStart(event: FormEvent) {
    event.preventDefault()
    if (!nickname.trim()) return
    setBusy('start')
    setError('')
    setNotice('')
    try {
      const response = await loginUser(nickname.trim())
      setUser(response.user)
      localStorage.setItem(STORAGE_USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_NICKNAME, response.user.nickname)
      setNickname(response.user.nickname)
      const payload = await joinQueue(response.user)
      setSessionPayload(payload)
      setSessionId(payload.session_id)
      localStorage.setItem(STORAGE_SESSION, payload.session_id)
      setNotice(payload.queue?.is_active ? '轮到你了，请按照提示开始测量' : '已加入测量队列')
      await refreshHistory(response.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '开始失败，请稍后再试')
    } finally {
      setBusy('')
    }
  }

  async function handleJoinQueue() {
    if (!user) {
      setError('请先完成身份创建')
      return
    }
    setBusy('queue')
    setError('')
    setNotice('')
    try {
      const payload = await joinQueue(user)
      setSessionPayload(payload)
      setSessionId(payload.session_id)
      localStorage.setItem(STORAGE_SESSION, payload.session_id)
      setNotice(payload.queue?.is_active ? '轮到你了，请按照提示开始测量' : '已加入测量队列')
      await refreshHistory(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入队列失败')
    } finally {
      setBusy('')
    }
  }

  async function handleFinish() {
    if (!sessionId) return
    setBusy('finish')
    setError('')
    try {
      const payload = await finishSession(sessionId)
      setSessionPayload(payload)
      setNotice('心率记录完成，可以上传舌象图片')
      await refreshHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : '结束测量失败')
    } finally {
      setBusy('')
    }
  }

  async function handleCancel() {
    if (!sessionId) return
    setBusy('cancel')
    setError('')
    try {
      const payload = await cancelSession(sessionId)
      setSessionPayload(payload)
      setNotice('已取消本次排队或测量')
      await refreshHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消失败')
    } finally {
      setBusy('')
    }
  }

  async function handleTongueUpload(file?: File) {
    if (!file || !user || !sessionId) return
    setBusy('tongue')
    setError('')
    setNotice('')
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    try {
      const payload = await uploadTongueImage(sessionId, user.user_id, file)
      setSessionPayload(payload)
      setNotice('舌象图片已记录，可以查看综合观察卡')
      await refreshSession(sessionId)
      await refreshHistory(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '舌象上传失败')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="student-shell">
      <div className="soft-grid"></div>
      <div className="station-wrap">
        <header className="student-header">
          <div>
            <p className="eyebrow">QingKang Station</p>
            <h1 className="brand-title">青康小站</h1>
            <p className="brand-subtitle">校园轻健康状态观察小站</p>
          </div>
          <div className="header-actions">
            <span className={`device-pill ${deviceHumanState === '设备离线' ? 'is-offline' : ''}`}>
              <Radio size={16} />
              {deviceHumanState}
            </span>
            <div className="mode-switch" aria-label="页面视角">
              <button
                className={viewMode === 'student' ? 'is-active' : ''}
                onClick={() => setViewMode('student')}
                type="button"
              >
                <Smartphone size={16} />
                用户测量端
              </button>
              <button
                className={viewMode === 'terminal' ? 'is-active' : ''}
                onClick={() => setViewMode('terminal')}
                type="button"
              >
                <Monitor size={16} />
                小站屏幕
              </button>
            </div>
          </div>
        </header>

        {(error || notice) && (
          <section className={`message-strip ${error ? 'is-error' : 'is-success'}`}>
            {error ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || notice}</span>
          </section>
        )}

        {viewMode === 'student' ? (
          <StudentMeasurementView
            bpm={bpm}
            busy={busy}
            chartData={chartData}
            currentStatus={currentStatus}
            deviceHumanState={deviceHumanState}
            history={history}
            nickname={nickname}
            peopleAhead={peopleAhead}
            previewUrl={previewUrl}
            secondsLeft={secondsLeft}
            sessionPayload={sessionPayload}
            setNickname={setNickname}
            stage={stage}
            user={user}
            onCancel={handleCancel}
            onFinish={handleFinish}
            onJoinQueue={handleJoinQueue}
            onStart={handleStart}
            onTongueUpload={handleTongueUpload}
          />
        ) : (
          <TerminalDisplayView
            currentStatus={currentStatus}
            deviceHumanState={deviceHumanState}
            payload={sessionPayload}
            prompt={mainPrompt}
            secondsLeft={secondsLeft}
          />
        )}

        <RoadshowDebugPanel device={devicePoll} payload={sessionPayload} />

        <footer className="site-footer">
          本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。
        </footer>
      </div>
    </main>
  )
}

function StudentMeasurementView({
  bpm,
  busy,
  chartData,
  currentStatus,
  deviceHumanState,
  history,
  nickname,
  peopleAhead,
  previewUrl,
  secondsLeft,
  sessionPayload,
  setNickname,
  stage,
  user,
  onCancel,
  onFinish,
  onJoinQueue,
  onStart,
  onTongueUpload,
}: {
  bpm: number | null
  busy: string
  chartData: Array<{ name: string; bpm: number; time: string }>
  currentStatus: string
  deviceHumanState: string
  history: HistoryResponse['items']
  nickname: string
  peopleAhead: number
  previewUrl: string
  secondsLeft: number | null
  sessionPayload: SessionPayload | null
  setNickname: (value: string) => void
  stage: StageKey
  user: User | null
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onStart: (event: FormEvent) => void
  onTongueUpload: (file?: File) => void
}) {
  return (
    <>
      <section className={`stage-shell stage-${stage}`}>
        <IdentityQueueCard
          bpm={bpm}
          busy={busy}
          currentStatus={currentStatus}
          deviceHumanState={deviceHumanState}
          nickname={nickname}
          peopleAhead={peopleAhead}
          previewUrl={previewUrl}
          secondsLeft={secondsLeft}
          sessionPayload={sessionPayload}
          setNickname={setNickname}
          stage={stage}
          user={user}
          onCancel={onCancel}
          onFinish={onFinish}
          onJoinQueue={onJoinQueue}
          onStart={onStart}
          onTongueUpload={onTongueUpload}
        />
        <CurrentStepCard
          chartData={chartData}
          currentStatus={currentStatus}
          deviceHumanState={deviceHumanState}
          history={history}
          peopleAhead={peopleAhead}
          secondsLeft={secondsLeft}
          sessionPayload={sessionPayload}
          stage={stage}
        />
      </section>
      <StepGuide stage={stage} />
    </>
  )
}

type StageViewProps = {
  bpm: number | null
  busy: string
  currentStatus: string
  deviceHumanState: string
  nickname: string
  peopleAhead: number
  previewUrl: string
  secondsLeft: number | null
  sessionPayload: SessionPayload | null
  setNickname: (value: string) => void
  stage: StageKey
  user: User | null
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onStart: (event: FormEvent) => void
  onTongueUpload: (file?: File) => void
}

function IdentityQueueCard({
  bpm,
  busy,
  currentStatus,
  deviceHumanState,
  nickname,
  peopleAhead,
  previewUrl,
  secondsLeft,
  sessionPayload,
  setNickname,
  stage,
  user,
  onCancel,
  onFinish,
  onJoinQueue,
  onStart,
  onTongueUpload,
}: StageViewProps) {
  if (stage === 'ready' || stage === 'measuring') {
    return (
      <HeartMeasureCard
        bpm={bpm}
        busy={busy}
        currentStatus={currentStatus}
        deviceHumanState={deviceHumanState}
        secondsLeft={secondsLeft}
        stage={stage}
        onCancel={onCancel}
        onFinish={onFinish}
      />
    )
  }

  if (stage === 'tongue') {
    return <TongueUploadCard bpm={bpm} busy={busy} payload={sessionPayload} previewUrl={previewUrl} onTongueUpload={onTongueUpload} />
  }

  if (stage === 'observation') {
    return <ObservationCard payload={sessionPayload} />
  }

  if (stage === 'queue') {
    return (
      <section className="main-stage-card queue-stage">
        <p className="stage-kicker">你好，{user?.nickname}</p>
        <h2>加入测量队列</h2>
        <p className="stage-copy">加入后，小站会按顺序分配公共心率设备。轮到你时，页面会提示你放置手指。</p>
        <button className="primary-btn stage-main-button" disabled={busy === 'queue'} onClick={onJoinQueue}>
          {busy === 'queue' ? <Loader2 className="animate-spin" size={20} /> : <Clock3 size={20} />}
          加入测量队列
        </button>
      </section>
    )
  }

  if (stage === 'waiting') {
    return (
      <section className="main-stage-card waiting-stage">
        <p className="stage-kicker">你已加入队列</p>
        <div className="queue-number">
          <span>前面还有</span>
          <strong>{peopleAhead}</strong>
          <span>位同学</span>
        </div>
        <p className="stage-copy">请等待小站呼叫，轮到你时再把手指放上传感器。</p>
        <button className="ghost-btn stage-side-button" disabled={busy === 'cancel'} onClick={onCancel}>
          {busy === 'cancel' ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
          取消排队
        </button>
      </section>
    )
  }

  return (
    <section className="main-stage-card identity-stage">
      <p className="stage-kicker">欢迎来到青康小站</p>
      <h2>输入昵称，开始使用青康小站</h2>
      <p className="stage-copy">小站会按顺序分配公共心率设备，完成心率记录后再上传舌象图片，生成本次观察卡。</p>
      <form className="stage-form" onSubmit={onStart}>
        <label htmlFor="nickname">昵称或学号</label>
        <div className="stage-form-row">
          <input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="例如 Rino / 20240101"
            className="input"
          />
          <button className="primary-btn" disabled={busy === 'start' || !nickname.trim()} type="submit">
            {busy === 'start' ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            创建身份并加入队列
          </button>
        </div>
      </form>
    </section>
  )
}

function CurrentStepCard({
  chartData,
  currentStatus,
  deviceHumanState,
  history,
  peopleAhead,
  secondsLeft,
  sessionPayload,
  stage,
}: {
  chartData: Array<{ name: string; bpm: number; time: string }>
  currentStatus: string
  deviceHumanState: string
  history: HistoryResponse['items']
  peopleAhead: number
  secondsLeft: number | null
  sessionPayload: SessionPayload | null
  stage: StageKey
}) {
  if (stage === 'observation') {
    return (
      <aside className="secondary-panel">
        <p className="panel-kicker">趋势</p>
        <h3>最近记录</h3>
        <HistorySection chartData={chartData} history={history} />
      </aside>
    )
  }

  const content: Record<Exclude<StageKey, 'observation'>, { title: string; body: string; facts: Array<[ReactNode, string]> }> = {
    identity: {
      title: '完成一次观察大约需要几分钟',
      body: '先创建身份并加入队列，轮到你后完成心率记录，再上传舌象图片。',
      facts: [
        [<UserRound size={18} />, '输入昵称开始'],
        [<HeartPulse size={18} />, '心率记录'],
        [<CloudUpload size={18} />, '上传舌象'],
      ],
    },
    queue: {
      title: '公共设备会按顺序分配',
      body: '同一时间只服务一位同学。加入队列后，请保持页面打开。',
      facts: [
        [<Radio size={18} />, deviceHumanState],
        [<Clock3 size={18} />, '轮到你时页面会提示'],
      ],
    },
    waiting: {
      title: '请等待小站呼叫',
      body: peopleAhead > 0 ? `前面还有 ${peopleAhead} 位同学，请暂时不要放置手指。` : '马上轮到你，请留意页面提示。',
      facts: [
        [<Clock3 size={18} />, peopleAhead > 0 ? `前面 ${peopleAhead} 位` : '即将开始'],
        [<Radio size={18} />, deviceHumanState],
      ],
    },
    ready: {
      title: '手指轻放即可',
      body: '不要用力按压传感器。信号稳定后，心率读数会自动出现。',
      facts: [
        [<Clock3 size={18} />, secondsLeft !== null ? `${secondsLeft} 秒` : '准备中'],
        [<HeartPulse size={18} />, '等待稳定信号'],
      ],
    },
    measuring: {
      title: currentStatus === 'ADJUST_FINGER' ? '轻轻调整手指' : '保持现在的姿势',
      body:
        currentStatus === 'ADJUST_FINGER'
          ? '如果信号过强或过弱，轻轻移动手指到更稳定的位置。'
          : '测量过程中请不要移开手指，直到页面切换到下一步。',
      facts: [
        [<Waves size={18} />, currentStatus === 'ADJUST_FINGER' ? '调整接触' : '保持手指'],
        [<Clock3 size={18} />, secondsLeft !== null ? `${secondsLeft} 秒` : '测量中'],
      ],
    },
    tongue: {
      title: '拍清楚舌象区域',
      body: '建议使用自然光，尽量正对镜头，避免过暗、模糊或大面积遮挡。',
      facts: [
        [<ScanLine size={18} />, sessionPayload?.heart?.bpm ? `${sessionPayload.heart.bpm} BPM 已记录` : '心率已记录'],
        [<CloudUpload size={18} />, '上传后生成观察卡'],
      ],
    },
  }

  const panel = content[stage]
  return (
    <aside className="secondary-panel">
      <p className="panel-kicker">当前提示</p>
      <h3>{panel.title}</h3>
      <p>{panel.body}</p>
      <div className="panel-facts">
        {panel.facts.map(([icon, text]) => (
          <span key={text}>
            {icon}
            {text}
          </span>
        ))}
      </div>
      <div className="mini-disclaimer">
        <ShieldCheck size={16} />
        仅用于健康状态观察和科普记录，不作为医学诊断依据。
      </div>
    </aside>
  )
}

function StepGuide({ stage }: { stage: StageKey }) {
  const activeKey = progressKeyForStage(stage)
  const activeIndex = flowSteps.findIndex((step) => step.key === activeKey)

  return (
    <section className="stepper-card progress-rail" aria-label="测量流程">
      {flowSteps.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
        return (
          <div className={`step-item is-${state}`} key={step.key}>
            <span className="step-marker">{state === 'done' ? <CheckCircle2 size={18} /> : index + 1}</span>
            <span>{step.label}</span>
          </div>
        )
      })}
    </section>
  )
}

function HeartMeasureCard({
  bpm,
  busy,
  currentStatus,
  deviceHumanState,
  secondsLeft,
  stage,
  onCancel,
  onFinish,
}: Pick<StageViewProps, 'bpm' | 'busy' | 'currentStatus' | 'deviceHumanState' | 'secondsLeft' | 'stage' | 'onCancel' | 'onFinish'>) {
  if (stage === 'ready') {
    return (
      <section className="main-stage-card ready-stage">
        <p className="stage-kicker">轮到你了</p>
        <h2>请将手指轻放在传感器上</h2>
        <p className="stage-copy">轻放即可，不要用力按压。设备读取到稳定信号后会自动进入测量。</p>
        <div className="stage-metrics">
          <SummaryPill icon={<Radio size={18} />} label="设备提示" value={deviceHumanState} />
          <SummaryPill icon={<Clock3 size={18} />} label="倒计时" value={secondsLeft !== null ? `${secondsLeft} 秒` : '准备中'} />
        </div>
        <button className="ghost-btn stage-side-button" disabled={busy === 'cancel'} onClick={onCancel}>
          {busy === 'cancel' ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
          暂不测量
        </button>
      </section>
    )
  }

  const needsAdjust = currentStatus === 'ADJUST_FINGER'
  return (
    <section className="main-stage-card measuring-stage">
      <div className={`stage-bpm ${bpm ? 'has-reading' : ''}`}>
        <strong>{bpm || '--'}</strong>
        <span>BPM</span>
      </div>
      <h2>{needsAdjust ? '信号不稳定，请轻轻调整手指' : '正在测量，请保持手指'}</h2>
      <p className="stage-copy">
        {needsAdjust ? '请轻轻调整手指位置，找到更稳定的接触点。' : '即使已经读到心率数据，也请不要移开手指。'}
      </p>
      <div className="stage-metrics">
        <SummaryPill icon={<Clock3 size={18} />} label="倒计时" value={secondsLeft !== null ? `${secondsLeft} 秒` : '测量中'} />
        <SummaryPill icon={<HeartPulse size={18} />} label="提示" value={needsAdjust ? '轻轻调整' : '保持手指'} />
      </div>
      <button className="ghost-btn stage-side-button" disabled={busy === 'finish'} onClick={onFinish}>
        {busy === 'finish' ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
        提前结束
      </button>
    </section>
  )
}

function SummaryPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="summary-pill">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TongueUploadCard({
  bpm,
  busy,
  payload,
  previewUrl,
  onTongueUpload,
}: {
  bpm: number | null
  busy: string
  payload: SessionPayload | null
  previewUrl: string
  onTongueUpload: (file?: File) => void
}) {
  const imageUrl = previewUrl || (payload?.tongue?.image_path ? `${API_BASE}/${payload.tongue.image_path}` : '')

  return (
    <section className="main-stage-card tongue-stage">
      <p className="stage-kicker">心率记录完成</p>
      <h2>现在可以上传舌象图片</h2>
      <p className="stage-copy">上传后，小站会把心率记录和舌象图片合并成非诊断性的观察卡。</p>
      <div className="compact-heart-summary">
        <HeartPulse size={20} />
        <span>心率记录</span>
        <strong>{bpm ? `${bpm} BPM` : '已记录'}</strong>
      </div>
      <label className="upload-primary" htmlFor="tongue-file">
        <input
          id="tongue-file"
          type="file"
          accept="image/*"
          disabled={busy === 'tongue'}
          onChange={(event) => onTongueUpload(event.target.files?.[0])}
        />
        {imageUrl ? (
          <div className="image-preview">
            <img src={imageUrl} alt="舌象预览" />
            <div className="scan-overlay"></div>
          </div>
        ) : (
          <div className="upload-empty">
            {busy === 'tongue' ? <Loader2 className="animate-spin" size={30} /> : <CloudUpload size={32} />}
            <strong>上传舌象图片</strong>
            <span>支持手机拍照或从相册选择</span>
          </div>
        )}
      </label>
    </section>
  )
}

function ObservationCard({ payload }: { payload: SessionPayload | null }) {
  const heart = payload?.heart
  const tongue = payload?.tongue
  const heartText = heart?.bpm
    ? `本次记录到 ${heart.bpm} BPM，可作为学习生活状态观察参考。`
    : '心率记录已完成，暂无稳定 BPM 数值。'
  const tongueText = tongue
    ? '舌象图片已保存，后续可接入图片质量检查和舌体区域识别。'
    : '舌象图片已上传，等待图片摘要更新。'

  return (
    <section className="main-stage-card observation-stage" id="observation-card">
      <p className="stage-kicker">生成观察卡</p>
      <h2>本次观察卡已生成</h2>
      <div className="observation-grid">
        <ObservationItem title="心率记录摘要" text={heartText} />
        <ObservationItem title="舌象图片记录摘要" text={tongueText} />
        <ObservationItem title="茶息建议" text="可以短暂停下，补充温水，观察身体状态变化。" />
        <ObservationItem title="呼吸放松建议" text="尝试 30 秒慢呼吸，让本次记录更稳定。" />
        <ObservationItem title="记录建议" text="建议保留本次记录，用于后续趋势对比。" />
      </div>
      <div className="disclaimer">
        <ShieldCheck size={18} />
        本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。
      </div>
    </section>
  )
}

function ObservationItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="observation-item">
      <span>{title}</span>
      <p>{text}</p>
    </div>
  )
}

function HistorySection({
  chartData,
  history,
}: {
  chartData: Array<{ name: string; bpm: number; time: string }>
  history: HistoryResponse['items']
}) {
  return (
    <details className="history-details">
      <summary>
        <span>
          <History size={18} />
          最近记录与趋势
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="history-content">
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="bpmFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#169b8f" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#169b8f" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d7e3dc" strokeDasharray="3 6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64756d' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64756d' }} axisLine={false} tickLine={false} domain={[40, 130]} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#c7d6ce' }} />
              <Area type="monotone" dataKey="bpm" stroke="#0f766e" strokeWidth={2} fill="url(#bpmFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="record-list">
          {history.length ? (
            history.slice(0, 6).map((item) => (
              <div className="record-row" key={item.session_id}>
                <div>
                  <strong>{cnStatus(item.session?.status)}</strong>
                  <span>{formatClock(item.session?.created_at)}</span>
                </div>
                <p>{item.heart?.bpm ? `${item.heart.bpm} BPM` : '暂无心率'}</p>
              </div>
            ))
          ) : (
            <p className="empty-records">完成一次测量后会显示最近记录。</p>
          )}
        </div>
      </div>
    </details>
  )
}

function TerminalDisplayView({
  currentStatus,
  deviceHumanState,
  payload,
  prompt,
  secondsLeft,
}: {
  currentStatus: string
  deviceHumanState: string
  payload: SessionPayload | null
  prompt: { title: string; description: string; action: string; tone: string }
  secondsLeft: number | null
}) {
  const serving = isActiveSession(payload)
  const offline = deviceHumanState === '设备离线'
  const nickname = serving ? payload?.session?.nickname : ''
  const title = serving ? prompt.title : offline ? '设备离线' : '等待下一位同学'
  const description = serving
    ? currentStatus === 'MEASURING'
      ? '正在测量，请保持手指，不要移开'
      : prompt.description
    : offline
      ? '请等待工作人员检查小站设备连接。'
      : '请在网页上创建身份并加入测量队列。'
  return (
    <section className={`terminal-display tone-${prompt.tone}`}>
      <div className="terminal-top">
        <span>青康小站公共屏幕</span>
        <strong>{deviceHumanState}</strong>
      </div>
      <div className="terminal-center">
        <p>{nickname ? `当前服务：${nickname}` : '等待下一位同学'}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      <div className="terminal-bottom">
        <div>
          <Clock3 size={22} />
          {secondsLeft !== null ? `剩余 ${secondsLeft} 秒` : '等待分配'}
        </div>
        <div>
          <HeartPulse size={22} />
          {serving ? cnStatus(currentStatus) : deviceHumanState}
        </div>
      </div>
    </section>
  )
}

function RoadshowDebugPanel({
  device,
  payload,
}: {
  device: DevicePollResponse | null
  payload: SessionPayload | null
}) {
  const flowNodes = [
    ['ESP32-S3', device?.state || 'IDLE'],
    ['active_session', device?.active_session?.session_id || '--'],
    ['session_id', payload?.session_id || '--'],
    ['heart-rate', payload?.heart?.state || 'waiting'],
    ['tongue-image', payload?.tongue ? 'uploaded' : 'waiting'],
    ['observation', payload?.combined_observation?.summary || 'waiting'],
  ]

  return (
    <details className="debug-details">
      <summary>
        <span>
          <Cable size={18} />
          路演调试模式 / 技术链路
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="debug-grid">
        <DebugLine icon={<Cpu size={18} />} label="ESP32-S3" value={DEVICE_ID} />
        <DebugLine icon={<Database size={18} />} label="API 状态" value={API_BASE} />
        <DebugLine icon={<Activity size={18} />} label="active_session" value={device?.active_session?.session_id || '--'} />
        <DebugLine icon={<Waves size={18} />} label="本次记录编号" value={payload?.session_id || '--'} />
      </div>
      <div className="tech-flow">
        {flowNodes.map(([label, value], index) => (
          <div className="tech-node" key={label}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
            <p>{value}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function DebugLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="debug-line">
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </div>
  )
}

export default App

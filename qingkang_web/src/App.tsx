import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  Bell,
  Cable,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudUpload,
  Cpu,
  Database,
  Eye,
  HeartPulse,
  History,
  Leaf,
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
  if (!status) return '未开始'
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

function isWaitingSession(payload: SessionPayload | null) {
  return payload?.session?.status === 'QUEUED'
}

function isHeartFinished(payload: SessionPayload | null) {
  return payload?.session?.status === 'FINISHED'
}

function getPeopleAhead(payload: SessionPayload | null) {
  return payload?.queue?.people_ahead ?? 0
}

function getDeviceHumanState(device: DevicePollResponse | null, payload: SessionPayload | null) {
  if (!device || device.state === 'DISCONNECTED') return '设备离线'
  if (isActiveSession(payload)) return '正在为你服务'
  if (device.active_session) return '正在服务他人'
  return '设备空闲'
}

function getMainPrompt(
  status: string,
  payload: SessionPayload | null,
  user: User | null,
  device: DevicePollResponse | null,
) {
  const peopleAhead = getPeopleAhead(payload)
  const deviceBusy = Boolean(device?.active_session && !payload?.queue?.is_active)

  if (!user) {
    return {
      title: '先创建你的身份',
      description: '输入昵称或学号后，就可以加入测量队列。',
      action: '请先创建身份',
      tone: 'calm',
    }
  }

  if (!payload?.session) {
    return {
      title: deviceBusy ? '设备正在服务他人' : '设备空闲，可以排队',
      description: deviceBusy ? '你可以先加入队列，轮到你时页面会提示。' : '加入队列后，系统会为你分配本次测量。',
      action: '加入测量队列',
      tone: deviceBusy ? 'waiting' : 'ready',
    }
  }

  const map: Record<string, { title: string; description: string; action: string; tone: string }> = {
    IDLE: {
      title: '设备空闲，请加入测量队列',
      description: '创建身份后点击加入队列，硬件空闲时会自动轮到你。',
      action: '加入测量队列',
      tone: 'calm',
    },
    QUEUED: {
      title: `排队中，前面还有 ${peopleAhead} 位`,
      description: '请在小站附近等待，轮到你时再把手指放上传感器。',
      action: peopleAhead > 0 ? '请稍等' : '即将轮到你',
      tone: 'waiting',
    },
    READY: {
      title: '轮到你了',
      description: '请将手指轻放在心率传感器上，不要用力按压。',
      action: '现在可以放置手指',
      tone: 'ready',
    },
    PLACE_FINGER: {
      title: '轮到你了',
      description: '请将手指轻放在心率传感器上。',
      action: '现在可以放置手指',
      tone: 'ready',
    },
    HOLD_STILL: {
      title: '正在稳定信号',
      description: '请保持手指不动，等待心率信号稳定。',
      action: '请保持手指',
      tone: 'measuring',
    },
    MEASURING: {
      title: '正在测量',
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
      title: '心率记录完成',
      description: '现在可以上传舌象图片，生成本次综合观察卡。',
      action: '上传舌象图片',
      tone: 'done',
    },
    TIMEOUT: {
      title: '本次测量超时',
      description: '可以重新加入队列，再完成一次心率记录。',
      action: '重新加入队列',
      tone: 'warning',
    },
    CANCELLED: {
      title: '本次测量已取消',
      description: '需要继续测量时，可以重新加入队列。',
      action: '重新加入队列',
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
  const heartFinished = isHeartFinished(sessionPayload)
  const canUploadTongue = Boolean(user && sessionId && heartFinished)
  const peopleAhead = getPeopleAhead(sessionPayload)
  const deviceHumanState = getDeviceHumanState(devicePoll, sessionPayload)
  const queueLocked = isWaitingSession(sessionPayload) || isActiveSession(sessionPayload)

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

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setBusy('login')
    setError('')
    setNotice('')
    try {
      const response = await loginUser(nickname)
      setUser(response.user)
      localStorage.setItem(STORAGE_USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_NICKNAME, response.user.nickname)
      setNickname(response.user.nickname)
      setNotice('身份已创建，可以加入测量队列')
      await refreshHistory(response.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setBusy('')
    }
  }

  async function handleJoinQueue() {
    if (!user) {
      setError('请先创建身份')
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

  function scrollToObservation() {
    document.getElementById('observation-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
            canUploadTongue={canUploadTongue}
            currentStatus={currentStatus}
            heartFinished={heartFinished}
            history={history}
            mainPrompt={mainPrompt}
            nickname={nickname}
            peopleAhead={peopleAhead}
            previewUrl={previewUrl}
            queueLocked={queueLocked}
            secondsLeft={secondsLeft}
            sessionPayload={sessionPayload}
            setNickname={setNickname}
            user={user}
            chartData={chartData}
            onCancel={handleCancel}
            onFinish={handleFinish}
            onJoinQueue={handleJoinQueue}
            onLogin={handleLogin}
            onScrollToObservation={scrollToObservation}
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
  canUploadTongue,
  chartData,
  currentStatus,
  heartFinished,
  history,
  mainPrompt,
  nickname,
  peopleAhead,
  previewUrl,
  queueLocked,
  secondsLeft,
  sessionPayload,
  setNickname,
  user,
  onCancel,
  onFinish,
  onJoinQueue,
  onLogin,
  onScrollToObservation,
  onTongueUpload,
}: {
  bpm: number | null
  busy: string
  canUploadTongue: boolean
  chartData: Array<{ name: string; bpm: number; time: string }>
  currentStatus: string
  heartFinished: boolean
  history: HistoryResponse['items']
  mainPrompt: { title: string; description: string; action: string; tone: string }
  nickname: string
  peopleAhead: number
  previewUrl: string
  queueLocked: boolean
  secondsLeft: number | null
  sessionPayload: SessionPayload | null
  setNickname: (value: string) => void
  user: User | null
  onCancel: () => void
  onFinish: () => void
  onJoinQueue: () => void
  onLogin: (event: FormEvent) => void
  onScrollToObservation: () => void
  onTongueUpload: (file?: File) => void
}) {
  return (
    <>
      <section className="first-screen">
        <IdentityQueueCard
          busy={busy}
          nickname={nickname}
          peopleAhead={peopleAhead}
          queueLocked={queueLocked}
          sessionPayload={sessionPayload}
          setNickname={setNickname}
          user={user}
          onCancel={onCancel}
          onJoinQueue={onJoinQueue}
          onLogin={onLogin}
        />
        <CurrentStepCard
          currentStatus={currentStatus}
          mainPrompt={mainPrompt}
          sessionPayload={sessionPayload}
          user={user}
        />
      </section>

      <StepGuide currentStatus={currentStatus} payload={sessionPayload} user={user} />

      <section className="main-flow">
        <HeartMeasureCard
          bpm={bpm}
          busy={busy}
          currentStatus={currentStatus}
          heartFinished={heartFinished}
          prompt={mainPrompt}
          secondsLeft={secondsLeft}
          sessionPayload={sessionPayload}
          onFinish={onFinish}
          onScrollToObservation={onScrollToObservation}
        />
        <TongueUploadCard
          busy={busy}
          canUploadTongue={canUploadTongue}
          payload={sessionPayload}
          previewUrl={previewUrl}
          onTongueUpload={onTongueUpload}
        />
      </section>

      <ObservationCard payload={sessionPayload} />
      <HistorySection chartData={chartData} history={history} />
    </>
  )
}

function IdentityQueueCard({
  busy,
  nickname,
  peopleAhead,
  queueLocked,
  sessionPayload,
  setNickname,
  user,
  onCancel,
  onJoinQueue,
  onLogin,
}: {
  busy: string
  nickname: string
  peopleAhead: number
  queueLocked: boolean
  sessionPayload: SessionPayload | null
  setNickname: (value: string) => void
  user: User | null
  onCancel: () => void
  onJoinQueue: () => void
  onLogin: (event: FormEvent) => void
}) {
  const waiting = isWaitingSession(sessionPayload)
  const active = isActiveSession(sessionPayload)

  return (
    <section className="student-card identity-card">
      <div className="card-heading">
        <UserRound size={20} />
        <span>身份与排队</span>
      </div>
      <form className="identity-form" onSubmit={onLogin}>
        <label htmlFor="nickname">昵称或学号</label>
        <div className="identity-row">
          <input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="例如 Rino / 20240101"
            className="input"
          />
          <button className="primary-btn" disabled={busy === 'login' || !nickname.trim()} type="submit">
            {busy === 'login' ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            创建身份
          </button>
        </div>
      </form>

      <div className="queue-summary">
        <div>
          <span>当前身份</span>
          <strong>{user ? user.nickname : '未创建'}</strong>
        </div>
        <div>
          <span>排队状态</span>
          <strong>{waiting ? '排队中' : active ? '轮到你了' : '未排队'}</strong>
        </div>
        <div className="wide">
          <span>你前面还有</span>
          <strong>{waiting ? `${peopleAhead} 人` : active ? '0 人' : '--'}</strong>
        </div>
      </div>

      <div className="action-row">
        <button className="secondary-btn" disabled={!user || queueLocked || busy === 'queue'} onClick={onJoinQueue}>
          {busy === 'queue' ? <Loader2 className="animate-spin" size={18} /> : <Clock3 size={18} />}
          加入测量队列
        </button>
        <button className="ghost-btn" disabled={!sessionPayload?.session || busy === 'cancel'} onClick={onCancel}>
          {busy === 'cancel' ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
          取消排队
        </button>
      </div>
      {!user && <p className="helper-text">请先创建身份，排队和上传功能会自动解锁。</p>}
    </section>
  )
}

function CurrentStepCard({
  currentStatus,
  mainPrompt,
  sessionPayload,
  user,
}: {
  currentStatus: string
  mainPrompt: { title: string; description: string; action: string; tone: string }
  sessionPayload: SessionPayload | null
  user: User | null
}) {
  return (
    <section className={`student-card current-card tone-${mainPrompt.tone}`}>
      <p className="section-kicker">当前该做什么</p>
      <h2>{mainPrompt.title}</h2>
      <p>{mainPrompt.description}</p>
      <div className="next-action">
        <Bell size={18} />
        <span>{mainPrompt.action}</span>
      </div>
      <div className="quick-facts">
        <span>{user ? '身份已创建' : '未创建身份'}</span>
        <span>{sessionPayload?.session ? cnStatus(currentStatus) : '未加入队列'}</span>
      </div>
    </section>
  )
}

function StepGuide({
  currentStatus,
  payload,
  user,
}: {
  currentStatus: string
  payload: SessionPayload | null
  user: User | null
}) {
  const status = payload?.session?.status
  const tongueDone = Boolean(payload?.tongue)

  function stepState(key: string) {
    if (key === 'identity') return user ? 'done' : 'active'
    if (key === 'queue') {
      if (!user) return 'locked'
      if (payload?.session) return 'done'
      return 'active'
    }
    if (key === 'ready') {
      if (status === 'QUEUED') return 'active'
      if (status === 'READY' || status === 'MEASURING' || status === 'FINISHED') return 'done'
      return payload?.session ? 'done' : 'locked'
    }
    if (key === 'heart') {
      if (currentStatus === 'HOLD_STILL' || currentStatus === 'MEASURING' || currentStatus === 'ADJUST_FINGER') {
        return 'active'
      }
      if (status === 'FINISHED') return 'done'
      return status === 'READY' ? 'active' : 'locked'
    }
    if (key === 'tongue') {
      if (tongueDone) return 'done'
      if (status === 'FINISHED') return 'active'
      return 'locked'
    }
    if (key === 'result') return tongueDone ? 'done' : status === 'FINISHED' ? 'active' : 'locked'
    return 'locked'
  }

  return (
    <section className="stepper-card" aria-label="测量流程">
      {flowSteps.map((step, index) => {
        const state = stepState(step.key)
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
  heartFinished,
  prompt,
  secondsLeft,
  sessionPayload,
  onFinish,
  onScrollToObservation,
}: {
  bpm: number | null
  busy: string
  currentStatus: string
  heartFinished: boolean
  prompt: { title: string; description: string; action: string; tone: string }
  secondsLeft: number | null
  sessionPayload: SessionPayload | null
  onFinish: () => void
  onScrollToObservation: () => void
}) {
  const measuring = currentStatus === 'MEASURING'
  const active = isActiveSession(sessionPayload)

  return (
    <section className={`heart-student-card tone-${prompt.tone}`}>
      <div className="card-heading">
        <HeartPulse size={20} />
        <span>心率测量</span>
      </div>
      <div className="heart-focus">
        <div className={`heart-orb ${measuring ? 'is-live' : ''}`}>
          <strong>{bpm || '--'}</strong>
          <span>BPM</span>
        </div>
        <div className="heart-instruction">
          <span>{cnStatus(currentStatus)}</span>
          <h3>{measuring && bpm ? '正在测量，请保持手指' : prompt.title}</h3>
          <p>{measuring && bpm ? '已经读到心率数据，但请继续保持手指，等待记录完成。' : prompt.description}</p>
          <div className="pulse-band">
            <div className="pulse-line"></div>
          </div>
        </div>
      </div>
      <div className="measure-actions">
        <div>
          <span>剩余时间</span>
          <strong>{secondsLeft !== null ? `${secondsLeft} 秒` : '--'}</strong>
        </div>
        <button className="secondary-btn" disabled={!active || busy === 'finish'} onClick={onFinish}>
          {busy === 'finish' ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          结束测量
        </button>
        <button className="ghost-btn" disabled={!heartFinished} onClick={onScrollToObservation}>
          <Eye size={18} />
          查看观察卡
        </button>
      </div>
    </section>
  )
}

function TongueUploadCard({
  busy,
  canUploadTongue,
  payload,
  previewUrl,
  onTongueUpload,
}: {
  busy: string
  canUploadTongue: boolean
  payload: SessionPayload | null
  previewUrl: string
  onTongueUpload: (file?: File) => void
}) {
  const imageUrl = previewUrl || (payload?.tongue?.image_path ? `${API_BASE}/${payload.tongue.image_path}` : '')

  return (
    <section className={`student-card tongue-card ${canUploadTongue ? 'is-ready' : ''}`}>
      <div className="card-heading">
        <CloudUpload size={20} />
        <span>舌象上传</span>
      </div>
      <p className="card-intro">
        {canUploadTongue ? '心率记录完成后，可以上传一张舌象图片。' : '完成心率记录后可上传。'}
      </p>
      <label className={`upload-zone ${!canUploadTongue ? 'is-disabled' : ''}`} htmlFor="tongue-file">
        <input
          id="tongue-file"
          type="file"
          accept="image/*"
          disabled={!canUploadTongue || busy === 'tongue'}
          onChange={(event) => onTongueUpload(event.target.files?.[0])}
        />
        {imageUrl ? (
          <div className="image-preview">
            <img src={imageUrl} alt="舌象预览" />
            <div className="scan-overlay"></div>
          </div>
        ) : (
          <div className="upload-empty">
            {busy === 'tongue' ? <Loader2 className="animate-spin" size={28} /> : <ScanLine size={30} />}
            <strong>上传舌象图片</strong>
            <span>舌象图片质量检查 / 舌体区域识别占位</span>
          </div>
        )}
      </label>
      <div className="plain-facts">
        <span>{payload?.tongue ? '图片已记录' : '图片待上传'}</span>
        <span>{payload?.tongue ? '质量检查占位已生成' : '等待心率完成'}</span>
      </div>
    </section>
  )
}

function ObservationCard({ payload }: { payload: SessionPayload | null }) {
  const heart = payload?.heart
  const tongue = payload?.tongue
  const heartText = heart?.bpm
    ? `本次记录到 ${heart.bpm} BPM，可作为学习生活状态观察参考。`
    : payload?.session?.status === 'FINISHED'
      ? '心率记录已完成，暂无稳定 BPM 数值。'
      : '完成心率测量后，这里会显示心率记录摘要。'
  const tongueText = tongue
    ? '舌象图片已保存，后续可接入图片质量检查和舌体区域识别。'
    : '上传舌象图片后，这里会显示图片记录摘要。'

  return (
    <section className="observation-card" id="observation-card">
      <div className="card-heading">
        <Leaf size={20} />
        <span>综合观察卡</span>
      </div>
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

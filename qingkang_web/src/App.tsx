import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  Cable,
  CheckCircle2,
  Clock3,
  CloudUpload,
  Cpu,
  Database,
  Gauge,
  HeartPulse,
  History,
  Leaf,
  Loader2,
  LogIn,
  Radio,
  ScanLine,
  ShieldCheck,
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

const statusCopy: Record<string, { label: string; hint: string; tone: string }> = {
  IDLE: {
    label: 'IDLE',
    hint: '设备空闲，请先加入测量队列',
    tone: 'text-slate-500 bg-slate-100 border-slate-200',
  },
  QUEUED: {
    label: 'QUEUED',
    hint: '已排队，等待硬件释放',
    tone: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  },
  READY: {
    label: 'READY',
    hint: '轮到你了，请将手指轻放在传感器上',
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  PLACE_FINGER: {
    label: 'READY',
    hint: '请将手指轻放在传感器上',
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  HOLD_STILL: {
    label: 'HOLD STILL',
    hint: '正在稳定信号，请保持手指不动',
    tone: 'text-teal-800 bg-teal-50 border-teal-200',
  },
  MEASURING: {
    label: 'MEASURING',
    hint: 'MEASURING / 请保持手指',
    tone: 'text-rose-800 bg-rose-50 border-rose-200',
  },
  ADJUST_FINGER: {
    label: 'ADJUST FINGER',
    hint: '信号偏弱或偏强，请轻轻调整接触位置',
    tone: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  FINISHED: {
    label: 'FINISHED',
    hint: '本次测量完成，可生成综合观察卡',
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  TIMEOUT: {
    label: 'TIMEOUT',
    hint: '本次测量超时，可以重新加入队列',
    tone: 'text-orange-800 bg-orange-50 border-orange-200',
  },
  CANCELLED: {
    label: 'CANCELLED',
    hint: '本次测量已取消',
    tone: 'text-slate-600 bg-slate-100 border-slate-200',
  },
  DISCONNECTED: {
    label: 'DISCONNECTED',
    hint: '硬件离线，请检查 ESP32-S3 网络连接',
    tone: 'text-red-800 bg-red-50 border-red-200',
  },
}

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
  if (payload?.heart?.state) return payload.heart.state
  if (payload?.session?.status) return payload.session.status
  if (device?.state) return device.state
  return 'IDLE'
}

function cnStatus(status?: string | null) {
  if (!status) return '未开始'
  const map: Record<string, string> = {
    IDLE: '设备空闲',
    QUEUED: '排队中',
    READY: '轮到你',
    PLACE_FINGER: '请放手指',
    HOLD_STILL: '稳定信号',
    MEASURING: '测量中',
    ADJUST_FINGER: '调整手指',
    FINISHED: '已完成',
    TIMEOUT: '已超时',
    CANCELLED: '已取消',
    DISCONNECTED: '设备离线',
  }
  return map[status] || status
}

function safeBpm(value?: number | null) {
  return value && value > 0 ? value : null
}

function App() {
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
        if (!cancelled) setError(err instanceof Error ? err.message : '无法读取当前 session')
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
  const copy = statusCopy[currentStatus] || statusCopy.IDLE
  const activeSession = sessionPayload?.session
  const bpm = safeBpm(sessionPayload?.heart?.bpm)
  const secondsLeft = activeSession?.expires_at ? Math.max(activeSession.expires_at - now, 0) : null
  const canUseSession =
    activeSession?.status === 'READY' ||
    activeSession?.status === 'MEASURING' ||
    activeSession?.status === 'FINISHED'

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
      setError('请先输入昵称或学号')
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
      setNotice(payload.queue?.is_active ? '轮到你了，请看硬件提示' : '已加入测量队列')
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
      setNotice('本次测量已结束，设备会自动释放给下一位')
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
      setNotice('已取消当前测量')
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
      setNotice('舌象图片已记录，AI 视觉模块占位结果已生成')
      await refreshSession(sessionId)
      await refreshHistory(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '舌象上传失败')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="terminal-grid"></div>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-none border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>QingKang Station</span>
              <span className="h-1 w-1 rounded-full bg-[var(--tea)]"></span>
              <span>ESP32-S3 + AI Vision</span>
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
              青康小站
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              面向校园场景的轻健康状态观察终端：排队占用硬件、绑定 session_id、记录心率与舌象图片，并形成非诊断性综合观察卡。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill icon={<Radio size={16} />} label={DEVICE_ID} value={cnStatus(devicePoll?.state)} />
            <StatusPill icon={<Database size={16} />} label="API" value={API_BASE.replace(/^https?:\/\//, '')} />
          </div>
        </header>

        {(error || notice) && (
          <section
            className={`flex items-start gap-3 border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {error ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || notice}</span>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1.35fr)_minmax(360px,0.95fr)]">
          <aside className="flex flex-col gap-4">
            <IdentityPanel
              nickname={nickname}
              setNickname={setNickname}
              user={user}
              busy={busy}
              onLogin={handleLogin}
              onJoinQueue={handleJoinQueue}
            />
            <QueuePanel
              payload={sessionPayload}
              device={devicePoll}
              secondsLeft={secondsLeft}
              busy={busy}
              onFinish={handleFinish}
              onCancel={handleCancel}
            />
          </aside>

          <section className="measurement-console">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker">当前测量状态</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">{copy.label}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{copy.hint}</p>
              </div>
              <span className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold ${copy.tone}`}>
                <span className="h-2 w-2 rounded-full bg-current"></span>
                {cnStatus(currentStatus)}
              </span>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <HeartRateCard bpm={bpm} status={currentStatus} secondsLeft={secondsLeft} />
              <SensorPanel payload={sessionPayload} device={devicePoll} />
            </div>

            <DataFlowStrip />
          </section>

          <section className="flex flex-col gap-4">
            <TongueUploadPanel
              canUseSession={Boolean(canUseSession && user)}
              busy={busy}
              payload={sessionPayload}
              previewUrl={previewUrl}
              onUpload={handleTongueUpload}
            />
            <ObservationCard payload={sessionPayload} />
          </section>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <HistoryPanel history={history} chartData={chartData} />
          <SystemPanel device={devicePoll} payload={sessionPayload} />
        </section>

        <footer className="border-t border-[var(--line)] py-4 text-xs leading-5 text-[var(--muted)]">
          本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。测量过程中请以 MEASURING / 请保持手指为准，等待 FINISHED 后再移开手指。
        </footer>
      </div>
    </main>
  )
}

function StatusPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 border border-[var(--line)] bg-white/75 px-3 py-2 text-xs text-[var(--muted)] shadow-sm">
      <span className="text-[var(--jade)]">{icon}</span>
      <span>{label}</span>
      <span className="font-semibold text-[var(--ink)]">{value}</span>
    </div>
  )
}

function IdentityPanel({
  nickname,
  setNickname,
  user,
  busy,
  onLogin,
  onJoinQueue,
}: {
  nickname: string
  setNickname: (value: string) => void
  user: User | null
  busy: string
  onLogin: (event: FormEvent) => void
  onJoinQueue: () => void
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <UserRound size={18} />
        <span>身份与队列</span>
      </div>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onLogin}>
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">昵称 / 学号</label>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="例如 Rino"
          className="input"
        />
        <button className="primary-btn" disabled={busy === 'login' || !nickname.trim()}>
          {busy === 'login' ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          创建身份
        </button>
      </form>
      <div className="mt-4 border-t border-[var(--line)] pt-4">
        <div className="mb-3 text-sm text-[var(--muted)]">
          {user ? (
            <>
              当前用户 <span className="font-semibold text-[var(--ink)]">{user.nickname}</span>
              <br />
              <span className="font-mono text-xs">{user.user_id}</span>
            </>
          ) : (
            '创建身份后才能占用公共心率硬件。'
          )}
        </div>
        <button className="secondary-btn w-full" disabled={!user || busy === 'queue'} onClick={onJoinQueue}>
          {busy === 'queue' ? <Loader2 className="animate-spin" size={18} /> : <Clock3 size={18} />}
          加入测量队列
        </button>
      </div>
    </section>
  )
}

function QueuePanel({
  payload,
  device,
  secondsLeft,
  busy,
  onFinish,
  onCancel,
}: {
  payload: SessionPayload | null
  device: DevicePollResponse | null
  secondsLeft: number | null
  busy: string
  onFinish: () => void
  onCancel: () => void
}) {
  const session = payload?.session
  const active = session?.status === 'READY' || session?.status === 'MEASURING'
  const queued = session?.status === 'QUEUED'

  return (
    <section className="panel">
      <div className="panel-title">
        <Cable size={18} />
        <span>硬件占用</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="队列位置" value={queued ? `第 ${payload?.queue?.position || 1} 位` : active ? '当前用户' : '--'} />
        <Metric label="前方人数" value={queued ? `${payload?.queue?.people_ahead || 0} 人` : active ? '0 人' : '--'} />
        <Metric label="倒计时" value={secondsLeft !== null ? `${secondsLeft}s` : '--'} />
        <Metric label="设备状态" value={cnStatus(device?.state)} />
      </div>
      <div className="mt-4 rounded-none border border-dashed border-[var(--line)] bg-[var(--mist)] p-3 text-xs leading-5 text-[var(--muted)]">
        {device?.active_session ? (
          <>
            OLED 应显示当前会话：
            <br />
            <span className="font-mono text-[var(--ink)]">{device.active_session.session_id}</span>
          </>
        ) : (
          '无 active_session 时，ESP32 保持 Waiting / Idle，不上传心率数据。'
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="secondary-btn" disabled={!active || busy === 'finish'} onClick={onFinish}>
          {busy === 'finish' ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
          结束
        </button>
        <button className="ghost-btn" disabled={!session || busy === 'cancel'} onClick={onCancel}>
          {busy === 'cancel' ? <Loader2 className="animate-spin" size={17} /> : <XCircle size={17} />}
          取消
        </button>
      </div>
    </section>
  )
}

function HeartRateCard({
  bpm,
  status,
  secondsLeft,
}: {
  bpm: number | null
  status: string
  secondsLeft: number | null
}) {
  const measuring = status === 'MEASURING'
  return (
    <section className={`heart-card ${measuring ? 'is-measuring' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
          <HeartPulse size={18} />
          心率实时卡片
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">{cnStatus(status)}</span>
      </div>
      <div className="mt-7 flex items-end gap-3">
        <strong className="font-mono text-7xl leading-none tracking-normal text-[var(--ink)] sm:text-8xl">
          {bpm || '--'}
        </strong>
        <span className="mb-3 text-lg font-semibold text-[var(--muted)]">BPM</span>
      </div>
      <div className="mt-7 h-16 overflow-hidden border-y border-[var(--line)] py-3">
        <div className="pulse-line"></div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="状态" value={status === 'MEASURING' ? '请保持手指' : cnStatus(status)} />
        <Metric label="剩余" value={secondsLeft !== null ? `${secondsLeft}s` : '--'} />
        <Metric label="提示" value={status === 'MEASURING' ? '连续记录中' : '等待稳定'} />
      </div>
    </section>
  )
}

function SensorPanel({ payload, device }: { payload: SessionPayload | null; device: DevicePollResponse | null }) {
  return (
    <section className="panel h-full">
      <div className="panel-title">
        <Cpu size={18} />
        <span>传感器状态</span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <SignalRow label="硬件轮询" value={device?.ok ? '在线' : '未连接'} active={device?.ok} />
        <SignalRow label="当前会话" value={payload?.session_id || '--'} active={Boolean(payload?.session_id)} />
        <SignalRow label="上传权限" value={payload?.queue?.is_active ? '已分配' : '等待'} active={payload?.queue?.is_active} />
        <SignalRow label="心率状态" value={cnStatus(payload?.heart?.state)} active={payload?.heart?.state === 'MEASURING'} />
      </div>
    </section>
  )
}

function SignalRow({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 text-sm last:border-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--ink)]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-[var(--jade)]' : 'bg-slate-300'}`}></span>
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}

function TongueUploadPanel({
  canUseSession,
  busy,
  payload,
  previewUrl,
  onUpload,
}: {
  canUseSession: boolean
  busy: string
  payload: SessionPayload | null
  previewUrl: string
  onUpload: (file?: File) => void
}) {
  const imageUrl = previewUrl || (payload?.tongue?.image_path ? `${API_BASE}/${payload.tongue.image_path}` : '')
  return (
    <section className="panel">
      <div className="panel-title">
        <CloudUpload size={18} />
        <span>舌象上传区</span>
      </div>
      <label className={`upload-zone mt-4 ${!canUseSession ? 'opacity-60' : ''}`}>
        <input
          type="file"
          accept="image/*"
          disabled={!canUseSession || busy === 'tongue'}
          className="hidden"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
        {imageUrl ? (
          <div className="relative h-52 w-full overflow-hidden bg-slate-100">
            <img src={imageUrl} alt="舌象预览" className="h-full w-full object-cover" />
            <div className="scan-overlay"></div>
          </div>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
            {busy === 'tongue' ? <Loader2 className="animate-spin text-[var(--jade)]" /> : <ScanLine className="text-[var(--jade)]" />}
            <div>
              <p className="font-semibold text-[var(--ink)]">上传舌象图片</p>
              <p className="mt-1 text-xs text-[var(--muted)]">用于同一 session 下的非诊断性观察记录</p>
            </div>
          </div>
        )}
      </label>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="图片状态" value={payload?.tongue ? '已记录' : '待上传'} />
        <Metric label="图像质量" value={payload?.tongue?.quality || '待分析'} />
        <Metric label="AI 模块" value={payload?.tongue ? '占位完成' : '待接入'} />
      </div>
    </section>
  )
}

function ObservationCard({ payload }: { payload: SessionPayload | null }) {
  const observation = payload?.combined_observation
  const suggestions = observation?.suggestions || [
    '完成心率测量后，可与舌象图片绑定成同一次观察记录。',
    '等待队列时，请留意硬件 OLED 上显示的 session 信息。',
  ]

  return (
    <section className="panel observation-card">
      <div className="panel-title">
        <Leaf size={18} />
        <span>综合观察卡片</span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-7 text-[var(--ink)]">
        {observation?.summary || '等待本次 session 数据生成综合观察。'}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {suggestions.slice(0, 4).map((item) => (
          <div className="flex gap-3 text-sm leading-6 text-[var(--muted)]" key={item}>
            <ShieldCheck className="mt-1 shrink-0 text-[var(--jade)]" size={16} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">
        {observation?.disclaimer || '本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。'}
      </div>
    </section>
  )
}

function HistoryPanel({
  history,
  chartData,
}: {
  history: HistoryResponse['items']
  chartData: Array<{ name: string; bpm: number; time: string }>
}) {
  return (
    <section className="panel">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="panel-title">
            <History size={18} />
            <span>历史记录 / 趋势</span>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">展示最近几次 session 的心率记录和测量状态。</p>
        </div>
        <div className="flex gap-2 text-xs text-[var(--muted)]">
          <span className="border border-[var(--line)] bg-white/70 px-3 py-2">非诊断性趋势</span>
          <span className="border border-[var(--line)] bg-white/70 px-3 py-2">session 绑定</span>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-64 min-w-0 border border-[var(--line)] bg-white/60 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="bpmFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f9f8f" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0f9f8f" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d6ded7" strokeDasharray="3 6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64756d' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64756d' }} axisLine={false} tickLine={false} domain={[40, 130]} />
              <Tooltip contentStyle={{ borderRadius: 0, borderColor: '#c7d6ce' }} />
              <Area type="monotone" dataKey="bpm" stroke="#0f766e" strokeWidth={2} fill="url(#bpmFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex max-h-64 flex-col gap-2 overflow-auto pr-1">
          {history.length ? (
            history.map((item) => (
              <div className="history-row" key={item.session_id}>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{cnStatus(item.session?.status)}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{item.session_id}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold text-[var(--ink)]">{item.heart?.bpm || '--'}</p>
                  <p className="text-xs text-[var(--muted)]">{formatClock(item.session?.created_at)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
              暂无历史记录，完成一次测量后会显示在这里。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SystemPanel({ device, payload }: { device: DevicePollResponse | null; payload: SessionPayload | null }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Gauge size={18} />
        <span>路演数据链路</span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <SystemLine icon={<Cpu size={16} />} label="ESP32-S3" value={device?.state || 'IDLE'} />
        <SystemLine icon={<Activity size={16} />} label="PulseSensor" value={payload?.heart?.state || '等待上传'} />
        <SystemLine icon={<CloudUpload size={16} />} label="舌象图片" value={payload?.tongue ? '已绑定' : '待上传'} />
        <SystemLine icon={<Database size={16} />} label="session_id" value={payload?.session_id || '--'} />
        <SystemLine icon={<Waves size={16} />} label="观察卡" value={payload?.combined_observation?.summary || '等待数据'} />
      </div>
    </section>
  )
}

function SystemLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border border-[var(--line)] bg-white/65 p-3 text-sm">
      <span className="text-[var(--jade)]">{icon}</span>
      <span className="w-24 shrink-0 font-semibold text-[var(--ink)]">{label}</span>
      <span className="min-w-0 truncate text-[var(--muted)]">{value}</span>
    </div>
  )
}

function DataFlowStrip() {
  const nodes = ['ESP32-S3', 'active_session', 'heart-rate', 'tongue-image', 'observation']
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-5">
      {nodes.map((node, index) => (
        <div className="flow-node" key={node}>
          <span className="font-mono text-[10px] text-[var(--muted)]">0{index + 1}</span>
          <span>{node}</span>
        </div>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value ?? '--'}</strong>
    </div>
  )
}

export default App

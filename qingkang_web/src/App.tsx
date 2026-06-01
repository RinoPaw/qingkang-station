import { useEffect, useState } from 'react'
import { DeviceGuidePage } from './components/DeviceGuidePage'
import { HeartRatePage } from './components/HeartRatePage'
import { HomePage } from './components/HomePage'
import { ObservationCardPage } from './components/ObservationCardPage'
import { ProfilePage } from './components/ProfilePage'
import { RecordsPage } from './components/RecordsPage'
import { RoadshowDebugPanel } from './components/RoadshowDebugPanel'
import type { AppPage } from './components/SidebarNavigation'
import { TongueUploadPage } from './components/TongueUploadPage'
import { useDeviceStatus } from './hooks/useDeviceStatus'
import { useQueueSession } from './hooks/useQueueSession'
import { useUserIdentity } from './hooks/useUserIdentity'
import {
  getDeviceHumanState,
  getPeopleAhead,
  getStage,
  safeBpm,
  statusFromPayload,
} from './lib/statusText'

const appPages: AppPage[] = ['home', 'heart', 'tongue', 'observation', 'records', 'guide', 'profile']

function pageFromHash(): AppPage {
  const value = window.location.hash.replace(/^#\/?/, '')
  return appPages.includes(value as AppPage) ? (value as AppPage) : 'home'
}

function App() {
  const [activePage, setActivePage] = useState<AppPage>(() => pageFromHash())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const identity = useUserIdentity()
  const queue = useQueueSession({ user: identity.user, setError, setNotice })
  const device = useDeviceStatus()
  const currentStatus = statusFromPayload(queue.sessionPayload, device.devicePoll)
  const activeSession = queue.sessionPayload?.session
  const bpm = safeBpm(queue.sessionPayload?.heart?.bpm)
  const secondsLeft = activeSession?.expires_at ? Math.max(activeSession.expires_at - queue.now, 0) : null
  const stage = getStage(identity.user, queue.sessionPayload, currentStatus, device.devicePoll)
  const peopleAhead = getPeopleAhead(queue.sessionPayload)
  const deviceHumanState = getDeviceHumanState(device.devicePoll, queue.sessionPayload)
  const busy = identity.busy || queue.busy
  const activeStatuses = new Set(['QUEUED', 'READY', 'MEASURING'])

  useEffect(() => {
    function syncPageFromHistory() {
      setActivePage(pageFromHash())
    }

    window.addEventListener('hashchange', syncPageFromHistory)
    window.addEventListener('popstate', syncPageFromHistory)
    return () => {
      window.removeEventListener('hashchange', syncPageFromHistory)
      window.removeEventListener('popstate', syncPageFromHistory)
    }
  }, [])

  function handleNavigate(page: AppPage) {
    setActivePage(page)
    const nextHash = `#${page}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreateIdentity() {
    setError('')
    setNotice('')
    try {
      queue.clearSession()
      await identity.createIdentity()
      setNotice('身份已创建，请在下一步加入测量队列')
    } catch (err) {
      setError(err instanceof Error ? err.message : '开始失败，请稍后再试')
    }
  }

  async function handleJoinQueue() {
    setError('')
    setNotice('')
    try {
      await queue.joinMeasurementQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入队列失败，请稍后再试')
    }
  }

  async function handleCancel() {
    setError('')
    setNotice('')
    try {
      await queue.cancelMeasurement()
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消失败，请稍后再试')
    }
  }

  async function handleFinish() {
    setError('')
    setNotice('')
    try {
      await queue.finishMeasurement()
    } catch (err) {
      setError(err instanceof Error ? err.message : '结束测量失败，请稍后再试')
    }
  }

  async function handleLogout() {
    setError('')
    setNotice('')

    if (activeStatuses.has(queue.sessionPayload?.session?.status || '')) {
      await queue.cancelMeasurement()
    }

    queue.clearSession()
    identity.clearIdentity()
    setError('')
    setNotice('已退出当前身份，可以重新输入昵称')
  }

  function handleSaveHeartRecord() {
    setError('')
    setNotice('本次心率记录已保存，可稍后补充舌象图片')
  }

  async function handleTongueUploadComplete() {
    setError('')
    setNotice('舌象图片已记录，可前往观察卡查看本次状态观察')
    await Promise.all([
      queue.refreshSession().catch(() => undefined),
      queue.refreshHistory(identity.user).catch(() => undefined),
    ])
  }

  if (activePage === 'home') {
    return (
      <HomePage
        deviceHumanState={deviceHumanState}
        user={identity.user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  if (activePage === 'heart') {
    return (
      <HeartRatePage
        bpm={bpm}
        busy={busy}
        currentStatus={currentStatus}
        debugPanel={<RoadshowDebugPanel device={device.devicePoll} payload={queue.sessionPayload} />}
        deviceHumanState={deviceHumanState}
        history={queue.history}
        peopleAhead={peopleAhead}
        secondsLeft={secondsLeft}
        stage={stage}
        user={identity.user}
        onCancel={handleCancel}
        onFinish={handleFinish}
        onJoinQueue={handleJoinQueue}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onSaveRecord={handleSaveHeartRecord}
      />
    )
  }

  if (activePage === 'tongue') {
    return (
      <TongueUploadPage
        currentSessionId={queue.sessionId}
        debugPanel={<RoadshowDebugPanel device={device.devicePoll} payload={queue.sessionPayload} />}
        user={identity.user}
        onUploadComplete={handleTongueUploadComplete}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  if (activePage === 'observation') {
    return (
      <ObservationCardPage
        bpm={bpm}
        currentPayload={queue.sessionPayload}
        debugPanel={<RoadshowDebugPanel device={device.devicePoll} payload={queue.sessionPayload} />}
        history={queue.history}
        user={identity.user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  if (activePage === 'records') {
    return (
      <RecordsPage
        history={queue.history}
        user={identity.user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  if (activePage === 'guide') {
    return (
      <DeviceGuidePage
        deviceHumanState={deviceHumanState}
        user={identity.user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  return (
    <ProfilePage
      busy={identity.busy}
      error={error}
      nickname={identity.nickname}
      notice={notice}
      user={identity.user}
      setNickname={identity.setNickname}
      onCreateIdentity={handleCreateIdentity}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    />
  )
}

export default App

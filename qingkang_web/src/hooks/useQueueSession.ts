import { useCallback, useEffect, useState } from 'react'
import { cancelSession, fetchHistory, fetchSession, finishSession, joinQueue } from '../lib/api'
import type { HistoryResponse, SessionPayload, User } from '../types/index'

export const STORAGE_SESSION = 'qingkang_session_id'

type FeedbackHandlers = {
  setError: (value: string) => void
  setNotice: (value: string) => void
  user: User | null
}

export function useQueueSession({ setError, setNotice, user }: FeedbackHandlers) {
  const [sessionId, setSessionId] = useState(localStorage.getItem(STORAGE_SESSION) || '')
  const [sessionPayload, setSessionPayload] = useState<SessionPayload | null>(null)
  const [history, setHistory] = useState<HistoryResponse['items']>([])
  const [busy, setBusy] = useState('')
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
  }, [sessionId, setError])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshHistory().catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshHistory, sessionPayload?.session?.status, sessionPayload?.heart?.created_at])

  async function joinMeasurementQueue(targetUser = user, busyLabel = 'queue') {
    if (!targetUser) {
      setError('请先完成身份创建')
      return null
    }

    setBusy(busyLabel)
    setError('')
    setNotice('')
    try {
      const payload = await joinQueue(targetUser)
      setSessionPayload(payload)
      setSessionId(payload.session_id)
      localStorage.setItem(STORAGE_SESSION, payload.session_id)
      setNotice(payload.queue?.is_active ? '轮到你了，请按照提示开始测量' : '已加入测量队列')
      await refreshHistory(targetUser)
      return payload
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入队列失败')
      return null
    } finally {
      setBusy('')
    }
  }

  async function finishMeasurement() {
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

  async function cancelMeasurement() {
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

  function clearSession() {
    setSessionId('')
    setSessionPayload(null)
    setHistory([])
    localStorage.removeItem(STORAGE_SESSION)
  }

  return {
    busy,
    history,
    now,
    refreshHistory,
    refreshSession,
    sessionId,
    sessionPayload,
    setSessionPayload,
    cancelMeasurement,
    clearSession,
    finishMeasurement,
    joinMeasurementQueue,
  }
}

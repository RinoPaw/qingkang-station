import type { DevicePollResponse, HistoryResponse, SessionPayload, User } from '../types/index'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:2070'
export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'esp32_s3_001'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
    })
  } catch {
    throw new Error('暂时无法连接服务器，请确认后端服务已启动')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = readableApiMessage(payload, response.status)
    throw new Error(message)
  }
  return payload as T
}

function readableApiMessage(payload: { detail?: string; message?: string }, status: number) {
  if (payload?.detail || payload?.message) return payload.detail || payload.message || ''
  if (status === 404) return '没有找到对应记录，请返回上一步重新开始'
  if (status === 409) return '当前公共设备暂未分配给本次记录，请稍后再试'
  if (status >= 500) return '服务器暂时没有响应，请稍后再试'
  return `请求暂时未完成（${status}）`
}

export async function loginUser(nickname: string, userId?: string) {
  return requestJson<{ ok: boolean; user: User }>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ nickname, user_id: userId }),
  })
}

export async function joinQueue(user: User) {
  return requestJson<SessionPayload & { message: string }>('/api/queue/join', {
    method: 'POST',
    body: JSON.stringify({
      user_id: user.user_id,
      nickname: user.nickname,
      device_id: DEVICE_ID,
    }),
  })
}

export async function fetchSession(sessionId: string) {
  return requestJson<SessionPayload>(`/api/session/${sessionId}?device_id=${DEVICE_ID}`)
}

export async function finishSession(sessionId: string) {
  return requestJson<SessionPayload & { message: string }>(`/api/session/${sessionId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ device_id: DEVICE_ID }),
  })
}

export async function cancelSession(sessionId: string) {
  return requestJson<SessionPayload & { message: string }>(`/api/session/${sessionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ device_id: DEVICE_ID }),
  })
}

export async function fetchHistory(userId?: string) {
  const suffix = userId ? `?user_id=${encodeURIComponent(userId)}&limit=8` : '?limit=8'
  return requestJson<HistoryResponse>(`/api/history${suffix}`)
}

export async function fetchDeviceStatus() {
  return requestJson<DevicePollResponse>(`/api/device/status?device_id=${DEVICE_ID}`)
}

export async function uploadTongueImage(sessionId: string, userId: string, file: File) {
  const formData = new FormData()
  formData.set('session_id', sessionId)
  formData.set('user_id', userId)
  formData.set('file', file)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/tongue-image`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error('请检查网络或确认后端服务已启动')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = readableApiMessage(payload, response.status)
    throw new Error(message)
  }
  return payload as SessionPayload & { image_path: string }
}

import type { DevicePollResponse, HistoryResponse, SessionPayload, User } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'esp32_s3_001'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Request failed: ${response.status}`
    throw new Error(message)
  }
  return payload as T
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

export async function pollDevice() {
  return requestJson<DevicePollResponse>(`/api/device/poll?device_id=${DEVICE_ID}`)
}

export async function uploadTongueImage(sessionId: string, userId: string, file: File) {
  const formData = new FormData()
  formData.set('session_id', sessionId)
  formData.set('user_id', userId)
  formData.set('file', file)

  const response = await fetch(`${API_BASE}/api/tongue-image`, {
    method: 'POST',
    body: formData,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Upload failed: ${response.status}`
    throw new Error(message)
  }
  return payload as SessionPayload & { image_path: string }
}

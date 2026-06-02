import type { DevicePollResponse, SessionPayload, User } from '../types/index'

export type StageKey =
  | 'identity'
  | 'queue'
  | 'waiting'
  | 'ready'
  | 'measuring'
  | 'tongue'
  | 'observation'
  | 'disconnected'

const finalStatuses = new Set(['FINISHED', 'TIMEOUT', 'CANCELLED'])

export function statusFromPayload(payload: SessionPayload | null, device: DevicePollResponse | null) {
  const sessionStatus = payload?.session?.status
  if (sessionStatus && finalStatuses.has(sessionStatus)) return sessionStatus
  if (payload?.heart?.state) return payload.heart.state
  if (sessionStatus) return sessionStatus
  if (device?.state === 'DISCONNECTED') return 'DISCONNECTED'
  return 'IDLE'
}

export function safeBpm(value?: number | null) {
  return value && value > 0 ? value : null
}

export function isActiveSession(payload: SessionPayload | null) {
  return payload?.session?.status === 'READY' || payload?.session?.status === 'MEASURING'
}

export function getPeopleAhead(payload: SessionPayload | null) {
  return payload?.queue?.people_ahead ?? 0
}

export function getDeviceHumanState(device: DevicePollResponse | null, payload: SessionPayload | null) {
  if (!device || device.state === 'DISCONNECTED') return '设备离线'
  if (isActiveSession(payload)) return '设备已分配给你'
  if (device.active_session) return '正在服务其他同学'
  return '设备空闲'
}

export function getStage(
  user: User | null,
  payload: SessionPayload | null,
  currentStatus: string,
  device: DevicePollResponse | null,
): StageKey {
  const status = payload?.session?.status
  if (!user) return 'identity'
  if (payload?.heart && payload?.tongue && payload.combined_observation?.summary?.trim()) return 'observation'
  if (status === 'FINISHED') return 'tongue'
  if (!payload?.session || status === 'TIMEOUT' || status === 'CANCELLED') return 'queue'
  if (status === 'QUEUED') return 'waiting'
  if (device?.state === 'DISCONNECTED') return 'disconnected'
  if (currentStatus === 'HOLD_STILL' || currentStatus === 'MEASURING' || currentStatus === 'ADJUST_FINGER') {
    return 'measuring'
  }
  if (status === 'READY' || currentStatus === 'READY' || currentStatus === 'PLACE_FINGER') return 'ready'
  return 'queue'
}

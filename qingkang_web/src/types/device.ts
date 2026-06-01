import type { SessionStatus } from './session'

export type DeviceState = 'IDLE' | 'READY' | 'MEASURING' | 'DISCONNECTED'

export type DeviceStatus = {
  id: number
  device_id: string
  current_session_id: string | null
  state: DeviceState
  last_seen: number | null
  created_at: number
}

export type DevicePollResponse = {
  ok: boolean
  server_time: number
  device_id: string
  state: DeviceState
  active_session: {
    session_id: string
    user_id: string
    nickname: string
    status: SessionStatus
    started_at: number | null
    expires_at: number | null
  } | null
  heart_upload: string
  poll_interval_ms: number
  message: string
}

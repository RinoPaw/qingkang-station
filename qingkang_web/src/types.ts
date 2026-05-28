export type SessionStatus =
  | 'QUEUED'
  | 'READY'
  | 'MEASURING'
  | 'FINISHED'
  | 'TIMEOUT'
  | 'CANCELLED'

export type DeviceState = 'IDLE' | 'READY' | 'MEASURING' | 'DISCONNECTED'

export type HeartState =
  | 'IDLE'
  | 'READY'
  | 'PLACE_FINGER'
  | 'HOLD_STILL'
  | 'MEASURING'
  | 'ADJUST_FINGER'
  | 'FINISHED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'DISCONNECTED'

export type User = {
  id: number
  user_id: string
  nickname: string
  created_at: number
}

export type MeasurementSession = {
  id: number
  session_id: string
  user_id: string
  nickname: string
  status: SessionStatus
  queue_position: number | null
  started_at: number | null
  finished_at: number | null
  expires_at: number | null
  created_at: number
}

export type DeviceStatus = {
  id: number
  device_id: string
  current_session_id: string | null
  state: DeviceState
  last_seen: number | null
  created_at: number
}

export type HeartRecord = {
  bpm: number | null
  raw: number | null
  amplitude: number | null
  state: HeartState
  created_at: number
}

export type TongueRecord = {
  image_path: string
  quality: string
  tongue_detected: boolean
  coating_color: string
  coating_ratio: number
  note: string
  created_at: number
}

export type CombinedObservation = {
  summary: string
  suggestions: string[]
  disclaimer: string
}

export type SessionPayload = {
  ok: boolean
  session_id: string
  session: MeasurementSession | null
  device: DeviceStatus | null
  queue: {
    position: number | null
    people_ahead: number
    is_active: boolean
  } | null
  heart: HeartRecord | null
  tongue: TongueRecord | null
  combined_observation: CombinedObservation
  combined_suggestion: string
}

export type HistoryResponse = {
  ok: boolean
  items: SessionPayload[]
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

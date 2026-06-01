import type { DeviceStatus } from './device'
import type { HeartRecord, TongueRecord } from './measurement'

export type SessionStatus =
  | 'QUEUED'
  | 'READY'
  | 'MEASURING'
  | 'FINISHED'
  | 'TIMEOUT'
  | 'CANCELLED'

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

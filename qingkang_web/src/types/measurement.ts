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

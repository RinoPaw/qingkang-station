import { useEffect, useState } from 'react'
import { DEVICE_ID, pollDevice } from '../lib/api'
import type { DevicePollResponse } from '../types/index'

export function useDeviceStatus() {
  const [devicePoll, setDevicePoll] = useState<DevicePollResponse | null>(null)

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

  return { devicePoll }
}

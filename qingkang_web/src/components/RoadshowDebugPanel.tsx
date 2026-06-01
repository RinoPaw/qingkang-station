import type { ReactNode } from 'react'
import { Activity, Cable, ChevronDown, Cpu, Database, Waves } from 'lucide-react'
import { API_BASE, DEVICE_ID } from '../lib/api'
import type { DevicePollResponse, SessionPayload } from '../types/index'

export function RoadshowDebugPanel({
  device,
  payload,
}: {
  device: DevicePollResponse | null
  payload: SessionPayload | null
}) {
  const flowNodes = [
    ['ESP32-S3', device?.state || 'IDLE'],
    ['active_session', device?.active_session?.session_id || '--'],
    ['session_id', payload?.session_id || '--'],
    ['heart-rate', payload?.heart?.state || 'waiting'],
    ['tongue-image', payload?.tongue ? 'uploaded' : 'waiting'],
    ['observation', payload?.combined_observation?.summary || 'waiting'],
  ]

  return (
    <details className="debug-details">
      <summary>
        <span>
          <Cable size={18} />
          路演调试模式 / 技术链路
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="debug-grid">
        <DebugLine icon={<Cpu size={18} />} label="ESP32-S3" value={DEVICE_ID} />
        <DebugLine icon={<Database size={18} />} label="API 状态" value={API_BASE} />
        <DebugLine icon={<Activity size={18} />} label="active_session" value={device?.active_session?.session_id || '--'} />
        <DebugLine icon={<Waves size={18} />} label="session_id" value={payload?.session_id || '--'} />
      </div>
      <div className="tech-flow">
        {flowNodes.map(([label, value], index) => (
          <div className="tech-node" key={label}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
            <p>{value}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function DebugLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="debug-line">
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </div>
  )
}

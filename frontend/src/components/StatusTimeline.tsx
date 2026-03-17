// ─────────────────────────────────────────────────────────────
// components/StatusTimeline.tsx
// Animated vertical timeline showing complaint lifecycle
// ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import { CheckCircle, Clock, User, Wrench, XCircle } from 'lucide-react'

const STEPS = [
  { key: 'pending',     label: 'Submitted',   icon: Clock },
  { key: 'assigned',    label: 'Assigned',    icon: User },
  { key: 'inprogress',  label: 'In Progress', icon: Wrench },
  { key: 'resolved',    label: 'Resolved',    icon: CheckCircle },
]

const ORDER: Record<string, number> = {
  pending: 0, assigned: 1, inprogress: 2, resolved: 3, rejected: 99,
}

interface TimelineEvent {
  status: string
  timestamp: string
  note?: string
}

interface Props {
  currentStatus: string
  events?: TimelineEvent[]
}

export default function StatusTimeline({ currentStatus, events }: Props) {
  const currentOrder = ORDER[currentStatus] ?? 0
  const isRejected = currentStatus === 'rejected'

  return (
    <div className="flex flex-col gap-0">
      {isRejected ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border"
             style={{ background: 'rgba(239,35,60,0.08)', borderColor: 'rgba(239,35,60,0.3)' }}>
          <XCircle size={20} className="text-red-400" />
          <div>
            <p className="font-semibold text-red-400">Report Rejected</p>
            <p className="text-xs text-red-300/70">This complaint was reviewed and rejected by the admin.</p>
          </div>
        </div>
      ) : (
        STEPS.map((step, i) => {
          const done    = currentOrder > i
          const active  = currentOrder === i
          const pending = currentOrder < i
          const Icon    = step.icon

          const color = done   ? 'var(--accent-green)'
                      : active ? 'var(--accent-orange)'
                      :          'var(--text-muted)'

          const evt = events?.find(e => e.status === step.key)

          return (
            <div key={step.key} className="flex gap-4">
              {/* Icon + line */}
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2"
                  style={{
                    borderColor: color,
                    background: (done || active) ? `${color}20` : 'transparent',
                  }}
                >
                  <Icon size={16} style={{ color }} />
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-0.5 flex-1 min-h-[20px] my-1 transition-all duration-700"
                    style={{ background: done ? 'var(--accent-green)' : 'var(--border)' }}
                  />
                )}
              </div>

              {/* Text */}
              <div className="pb-5">
                <p className="font-semibold text-sm" style={{ color: pending ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {step.label}
                  {active && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(255,107,0,0.15)', color: 'var(--accent-orange)' }}>
                      Current
                    </span>
                  )}
                </p>
                {evt ? (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(evt.timestamp).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    {evt.note && <span className="ml-2 opacity-70">· {evt.note}</span>}
                  </p>
                ) : (
                  active && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--accent-orange)', opacity: 0.7 }}>
                      In progress…
                    </p>
                  )
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

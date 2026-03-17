// ─────────────────────────────────────────────────────────────
// components/SeverityBadge.tsx
// Animated severity indicator (score 0-100 → Critical / High / Medium / Low)
// ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import { severityLabel } from '../lib/utils'

interface Props {
  score: number
  showScore?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function SeverityBadge({ score, showScore = true, size = 'md' }: Props) {
  const { label, color } = severityLabel(score)

  const sizeClasses = {
    sm:  'text-xs px-2 py-0.5',
    md:  'text-xs px-3 py-1',
    lg:  'text-sm px-4 py-1.5',
  }

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClasses[size]}`}
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {/* Pulsing dot for critical */}
      {score >= 75 && (
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        </span>
      )}
      {label}
      {showScore && <span className="opacity-70">· {score}</span>}
    </motion.span>
  )
}

// ─────────────────────────────────────────────────────────────
// components/NotificationBell.tsx
// Real-time notification bell (Socket.io "notification" event)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import type { NotificationEvent } from '../hooks/useSocket'

export default function NotificationBell() {
  const [open, setOpen]       = useState(false)
  const [items, setItems]     = useState<(NotificationEvent & { id: string })[]>([
    // Seed with a demo notification
    { id: '1', type: 'info',    message: 'Rain forecast in next 48h — pothole risk elevated in Zone 3.', timestamp: new Date().toISOString() },
    { id: '2', type: 'success', message: 'Complaint #C001 verified as 92% resolved by AI.', timestamp: new Date(Date.now()-300000).toISOString() },
    { id: '3', type: 'warning', message: 'Anomaly detected: 8 reports in Velachery in last 30 min.', timestamp: new Date(Date.now()-600000).toISOString() },
  ])
  const [unread, setUnread] = useState(3)

  useSocket({
    onNotification: (d) => {
      setItems(prev => [{ ...d, id: Date.now().toString() }, ...prev])
      setUnread(u => u + 1)
    },
  })

  function clear(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function markAllRead() { setUnread(0); setOpen(false) }

  const icons: Record<string, React.ReactNode> = {
    info:    <Info    size={14} className="text-blue-400" />,
    success: <CheckCircle size={14} className="text-green-400" />,
    warning: <AlertTriangle size={14} className="text-yellow-400" />,
    error:   <XCircle size={14} className="text-red-400" />,
  }

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => { setOpen(o => !o); setUnread(0) }}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <Bell size={16} style={{ color: 'var(--text-primary)' }} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: 'var(--accent-orange)' }}
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{   opacity: 0, y: -8, scale: 0.96 }}
            className="absolute right-0 top-12 w-80 rounded-2xl shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Notifications</span>
              <button onClick={markAllRead} className="text-xs" style={{ color: 'var(--accent-orange)' }}>
                Clear all
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.length === 0 ? (
                <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>All caught up! 🎉</p>
              ) : items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">{icons[item.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{item.message}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => clear(item.id)} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

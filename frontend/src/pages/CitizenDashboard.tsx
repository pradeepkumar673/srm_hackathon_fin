// ─────────────────────────────────────────────────────────────
// pages/CitizenDashboard.tsx
// Citizen home: quick-report, stats, recent complaints, map
// Real-time via Socket.io new-report + status-update events
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Trophy, Clock, CheckCircle, AlertCircle, ChevronRight, Sun, Moon, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import ReportForm from '../components/ReportForm'
import LeafletMap from '../components/LeafletMap'
import AIChatbot from '../components/AIChatbot'
import NotificationBell from '../components/NotificationBell'
import SeverityBadge from '../components/SeverityBadge'
import { statusClass, timeAgo, CATEGORY_ICONS } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'
import { complaintsAPI } from '../api'

export default function CitizenDashboard() {
  const [dark, setDark]         = useState(() => document.documentElement.classList.contains('dark'))
  const [showForm, setShowForm] = useState(false)
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const name = localStorage.getItem('civic_name') ?? 'Citizen'

  function toggleDark() {
    document.documentElement.classList.toggle('dark')
    setDark(d => !d)
  }

  useSocket({
    onNewReport: (d) => {
      toast('🆕 New report in your area: ' + d.title, { duration: 3000 })
    },
    onStatusUpdate: (d) => {
      setComplaints(prev => prev.map(c => (c._id === d.id || c.id === d.id) ? { ...c, status: d.status } : c))
      toast.success('Status updated: ' + d.status)
    },
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await complaintsAPI.getMine(1, 50)
        const list = res.data?.complaints ?? []
        if (!mounted) return
        setComplaints(list.slice(0, 3))
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to load your recent reports.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const counts = useMemo(() => {
    const pending = complaints.filter(c => String(c.status || '').toLowerCase() === 'pending').length
    const resolved = complaints.filter(c => String(c.status || '').toLowerCase() === 'resolved').length
    return { pending, resolved }
  }, [complaints])

  const stats = useMemo(() => ([
    { label: 'My Reports',     value: complaints.length, icon: MapPin,      color: 'var(--accent-orange)' },
    { label: 'Resolved',       value: counts.resolved,   icon: CheckCircle, color: 'var(--accent-green)'  },
    { label: 'Pending',        value: counts.pending,    icon: Clock,       color: '#FFB347'               },
    { label: 'Civic Points',   value: Number(localStorage.getItem('civic_points') || 0), icon: Trophy, color: 'var(--accent-teal)' },
  ]), [complaints.length, counts.pending, counts.resolved])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Navbar ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)' }}>
            <AlertCircle size={16} className="text-white" />
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>AI-SmartCivic</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={toggleDark} className="w-9 h-9 rounded-xl flex items-center justify-center border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link to="/login" onClick={() => {
            localStorage.removeItem('civic_token')
            localStorage.removeItem('civic_role')
            localStorage.removeItem('civic_name')
            localStorage.removeItem('civic_language')
          }}
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <LogOut size={15} />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-28">
        {/* ── Greeting ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
            வணக்கம், {name}! 👋
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Help make Chennai better — report civic issues around you.
          </p>
        </motion.div>

        {/* ── Stats grid ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Quick Report Button ───────────────────── */}
        {!showForm ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-semibold text-base"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)', boxShadow: '0 6px 20px rgba(255,107,0,0.35)' }}
          >
            <Plus size={22} />
            Report a Civic Issue
          </motion.button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>New Report</h3>
              <button onClick={() => setShowForm(false)} className="text-xs px-3 py-1 rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
            </div>
            <ReportForm />
          </motion.div>
        )}

        {/* ── Live Map ─────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Issues Near You</h3>
            <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(6,214,160,0.12)', color: 'var(--accent-green)' }}>
              🔴 Live
            </span>
          </div>
          <LeafletMap mode="citizen" height="260px" />
        </div>

        {/* ── Recent complaints ─────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>My Recent Reports</h3>
            <Link to="/complaints" className="text-xs font-medium" style={{ color: 'var(--accent-orange)' }}>
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {complaints.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <Link to={`/complaints/${c.id}`}>
                  <div className="p-4 rounded-2xl flex items-center gap-3 transition-all hover:scale-[1.01]"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                         style={{ background: 'var(--bg-secondary)' }}>
                      {CATEGORY_ICONS[c.category] ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(c.status)}`}>
                          {c.status}
                        </span>
                        <SeverityBadge score={c.severity} size="sm" showScore={false} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Community stats ───────────────────────── */}
        <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(10,37,64,0.9),rgba(26,58,92,0.9))', border: '1px solid #1A3A5C' }}>
          <p className="text-white font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            🏙️ Chennai Today
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Your Reports', value: complaints.length },
              { label: 'Resolved', value: counts.resolved },
              { label: 'Pending', value: counts.pending },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-orange-400" style={{ fontFamily: 'Syne, sans-serif' }}>{s.value}</p>
                <p className="text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AIChatbot userRole="citizen" userName={name} />
    </div>
  )
}

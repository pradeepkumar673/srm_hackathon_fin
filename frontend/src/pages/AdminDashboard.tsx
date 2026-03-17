// ─────────────────────────────────────────────────────────────
// pages/AdminDashboard.tsx
// Admin control center: KPI cards, Groq AI summary,
// live Leaflet heatmap, priority queue, auto-assign
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CheckCircle, Clock, Download, LogOut, Moon, RefreshCw, Sun, Users, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import LeafletMap from '../components/LeafletMap'
import SeverityBadge from '../components/SeverityBadge'
import AIChatbot from '../components/AIChatbot'
import NotificationBell from '../components/NotificationBell'
import { statusClass, timeAgo, CATEGORY_ICONS } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'
import { adminAPI } from '../api'

export default function AdminDashboard() {
  const [dark, setDark]         = useState(() => document.documentElement.classList.contains('dark'))
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState<any | null>(null)
  const [anomalyBanner, setAnomalyBanner] = useState<string | null>(null)
  const [kpi, setKpi] = useState<{ total: number; pending: number; assigned: number; inProgress: number; resolved: number; avgSeverity: number } | null>(null)
  const [autoAssigning, setAutoAssigning]   = useState(false)
  const [recentAlert, setRecentAlert]       = useState<string | null>(null)

  function toggleDark() { document.documentElement.classList.toggle('dark'); setDark(d => !d) }

  async function refreshDashboard() {
    setLoading(true)
    try {
      const res = await adminAPI.getDashboard()
      const dash = res.data?.dashboard
      setKpi(dash?.kpis ?? null)
      setWeather(dash?.weather ?? null)
      setAnomalyBanner(dash?.anomalyAlerts?.[0]?.message ?? null)
      setComplaints(dash?.topComplaints ?? [])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load admin dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useSocket({
    onNewReport: (d) => {
      toast('🆕 New report: ' + d.title)
      // Refresh for authoritative data (and to keep KPIs correct)
      refreshDashboard()
    },
    onAnomalyAlert: (d) => {
      setRecentAlert(d.message)
      toast.error('⚠️ Anomaly: ' + d.message, { duration: 6000 })
    },
    onStatusUpdate: (d) => {
      setComplaints(prev => prev.map(c => (c.id === d.id || c._id === d.id) ? { ...c, status: d.status } : c))
    },
  })

  async function autoAssign() {
    setAutoAssigning(true)
    try {
      const pending = complaints.find(c => String(c.status).toLowerCase() === 'pending')
      if (!pending?.id) {
        toast('No pending complaints to assign.')
        return
      }
      await adminAPI.assignWorker(pending.id)
      toast.success('AI assigned a worker.')
      await refreshDashboard()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Auto-assign failed.')
    } finally {
      setAutoAssigning(false)
    }
  }

  const criticalCount = useMemo(
    () => complaints.filter(c => Number(c.severityScore ?? 0) >= 75).length,
    [complaints]
  )

  const kpis = useMemo(() => ([
    { label: 'Total Reports',    value: kpi?.total ?? 0,        icon: BarChart3,     color: 'var(--accent-teal)',   bg: 'rgba(0,180,216,0.10)'   },
    { label: 'Critical',         value: criticalCount,         icon: AlertTriangle, color: 'var(--accent-red)',    bg: 'rgba(239,35,60,0.10)'   },
    { label: 'Pending',          value: kpi?.pending ?? 0,      icon: Clock,         color: '#FFB347',              bg: 'rgba(255,179,71,0.10)'  },
    { label: 'Resolved',         value: kpi?.resolved ?? 0,     icon: CheckCircle,   color: 'var(--accent-green)',  bg: 'rgba(6,214,160,0.10)'   },
    { label: 'In Progress',      value: kpi?.inProgress ?? 0,   icon: Users,         color: 'var(--accent-orange)', bg: 'rgba(255,107,0,0.10)'   },
    { label: 'Avg Severity',     value: kpi?.avgSeverity ?? 0,  icon: Zap,           color: '#A78BFA',              bg: 'rgba(167,139,250,0.10)' },
  ]), [criticalCount, kpi])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg,#0A2540,#1A3A5C)' }}>
          <BarChart3 size={15} className="text-orange-400" />
        </div>
        <h1 className="font-bold flex-1 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Admin Dashboard</h1>
        {(recentAlert || anomalyBanner) && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium animate-pulse"
               style={{ background: 'rgba(239,35,60,0.15)', color: 'var(--accent-red)' }}>
            ⚠️ {(recentAlert || anomalyBanner || '').slice(0, 40)}…
          </div>
        )}
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

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-6 pb-28">
        {loading && (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading dashboard…</div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: k.bg }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: k.color }}>{k.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            </motion.div>
          ))}
        </div>

        {/* AI Summary card */}
        <div className="p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(10,37,64,0.95),rgba(26,58,92,0.95))', border: '1px solid #1A3A5C' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>🌦️ Weather</p>
              <p className="text-white/50 text-xs">OpenWeatherMap · rain risk drives heatmap multiplier</p>
            </div>
            <div className="flex gap-2">
              <button onClick={refreshDashboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 hover:border-white/30 transition-all">
                <RefreshCw size={12} /> Refresh
              </button>
              <button onClick={async () => {
                try {
                  const res = await adminAPI.downloadPDF()
                  const blob = new Blob([res.data], { type: 'application/pdf' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'SmartCivic-Weekly.pdf'
                  a.click()
                  URL.revokeObjectURL(url)
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'PDF download failed.')
                }
              }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 hover:border-white/30 transition-all">
                <Download size={12} /> PDF
              </button>
            </div>
          </div>
          {weather ? (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/80 text-xs leading-relaxed">
                {weather.description} · Temp {Math.round(weather.tempC)}°C · Rain probability next 48h: {weather.rainProbabilityNext48h}%
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-xs">Weather unavailable (missing `OPENWEATHER_API_KEY` or rate limited).</p>
          )}
        </div>

        {/* Map + auto-assign */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Live Issue Map</h3>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={autoAssign} disabled={autoAssigning}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg,#00B4D8,#0096B4)', opacity: autoAssigning ? 0.7 : 1 }}>
                {autoAssigning ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                AI Auto-Assign
              </motion.button>
            </div>
          </div>
          <LeafletMap mode="admin" height="420px" />
        </div>

        {/* Priority queue */}
        <div>
          <h3 className="font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>Priority Queue</h3>
          <div className="space-y-2">
            {[...complaints].sort((a, b) => Number(b.severityScore ?? 0) - Number(a.severityScore ?? 0)).map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/complaints/${c.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.005]"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <span className="text-lg w-6 flex-shrink-0">{CATEGORY_ICONS[String(c.category || '').toLowerCase()] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {String(c.location?.address || '').split(',')[0]} · {timeAgo(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SeverityBadge score={Number(c.severityScore ?? 0)} size="sm" showScore={false} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(String(c.status || 'pending'))}`}>
                        {String(c.status || 'pending')}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <AIChatbot userRole="admin" userName="Admin" />
    </div>
  )
}

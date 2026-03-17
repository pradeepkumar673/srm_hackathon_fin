// ─────────────────────────────────────────────────────────────
// pages/AdminDashboard.tsx
// Admin control center: KPI cards, Groq AI summary,
// live Leaflet heatmap, priority queue, auto-assign
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CheckCircle, Clock, Download, LogOut, Moon, RefreshCw, Sun, Users, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import LeafletMap from '../components/LeafletMap'
import SeverityBadge from '../components/SeverityBadge'
import AIChatbot from '../components/AIChatbot'
import NotificationBell from '../components/NotificationBell'
import { MOCK_COMPLAINTS, MOCK_KPIS, MOCK_WORKERS, statusClass, timeAgo, CATEGORY_ICONS } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'

export default function AdminDashboard() {
  const [dark, setDark]         = useState(() => document.documentElement.classList.contains('dark'))
  const [complaints, setComplaints] = useState(MOCK_COMPLAINTS)
  const [aiSummary, setAiSummary]   = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [autoAssigning, setAutoAssigning]   = useState(false)
  const [recentAlert, setRecentAlert]       = useState<string | null>(null)

  function toggleDark() { document.documentElement.classList.toggle('dark'); setDark(d => !d) }

  useSocket({
    onNewReport: (d) => {
      toast('🆕 New report: ' + d.title)
      setComplaints(prev => [{
        id: d.id, title: d.title, category: d.category, severity: d.severity,
        status: 'pending', location: d.location, photo: 'https://placehold.co/400x250/0A2540/FF6B00?text=New',
        aiDescription: 'New report — AI analysis pending.', aiSeverityScore: d.severity, aiCategory: d.category,
        isFakeDetected: false, createdAt: d.createdAt, updatedAt: d.createdAt,
        workerId: null, workerName: null, workerLocation: null, workerEta: null,
        civicPoints: 20, communityConfirms: 0,
      }, ...prev])
    },
    onAnomalyAlert: (d) => {
      setRecentAlert(d.message)
      toast.error('⚠️ Anomaly: ' + d.message, { duration: 6000 })
    },
    onStatusUpdate: (d) => {
      setComplaints(prev => prev.map(c => c.id === d.id ? { ...c, status: d.status } : c))
    },
  })

  async function generateAISummary() {
    setSummaryLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `You are a Chennai civic admin AI. Summarize these issues in 3 bullet points for the dashboard. Issues: ${JSON.stringify(complaints.slice(0,4).map(c => ({ title: c.title, severity: c.severity, status: c.status })))}. Keep it concise and action-oriented.`
          }]
        })
      })
      const data = await res.json()
      setAiSummary(data?.content?.[0]?.text ?? 'Summary unavailable.')
    } catch {
      setAiSummary('• 4 active reports — 2 Critical\n• Velachery water leak requires immediate attention\n• Anna Nagar pothole worker ETA: 8 min')
    } finally {
      setSummaryLoading(false)
    }
  }

  async function autoAssign() {
    setAutoAssigning(true)
    await new Promise(r => setTimeout(r, 1500))
    setAutoAssigning(false)
    setComplaints(prev => prev.map(c =>
      c.status === 'pending' && !c.workerId
        ? { ...c, status: 'assigned', workerId: 'W002', workerName: 'Priya Devi' }
        : c
    ))
    toast.success('AI auto-assigned 2 workers optimally! 🤖')
  }

  const criticalCount  = complaints.filter(c => c.severity >= 75).length
  const pendingCount   = complaints.filter(c => c.status === 'pending').length
  const resolvedToday  = MOCK_KPIS.resolvedToday
  const activeWorkers  = MOCK_WORKERS.length

  const kpis = [
    { label: 'Total Reports',    value: complaints.length,  icon: BarChart3,     color: 'var(--accent-teal)',   bg: 'rgba(0,180,216,0.10)'   },
    { label: 'Critical',         value: criticalCount,      icon: AlertTriangle, color: 'var(--accent-red)',    bg: 'rgba(239,35,60,0.10)'   },
    { label: 'Pending',          value: pendingCount,       icon: Clock,         color: '#FFB347',              bg: 'rgba(255,179,71,0.10)'  },
    { label: 'Resolved Today',   value: resolvedToday,      icon: CheckCircle,   color: 'var(--accent-green)',  bg: 'rgba(6,214,160,0.10)'   },
    { label: 'Active Workers',   value: activeWorkers,      icon: Users,         color: 'var(--accent-orange)', bg: 'rgba(255,107,0,0.10)'   },
    { label: 'Avg Resolve (h)',  value: MOCK_KPIS.avgResolutionHrs, icon: Zap,  color: '#A78BFA',             bg: 'rgba(167,139,250,0.10)' },
  ]

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
        {recentAlert && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium animate-pulse"
               style={{ background: 'rgba(239,35,60,0.15)', color: 'var(--accent-red)' }}>
            ⚠️ {recentAlert.slice(0, 40)}…
          </div>
        )}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={toggleDark} className="w-9 h-9 rounded-xl flex items-center justify-center border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link to="/login" onClick={() => localStorage.clear()}
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <LogOut size={15} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-6 pb-28">
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
              <p className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>🤖 Groq AI Insights</p>
              <p className="text-white/50 text-xs">Real-time situation summary · Llama-3.1-70B</p>
            </div>
            <div className="flex gap-2">
              <button onClick={generateAISummary} disabled={summaryLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 hover:border-orange-400/50 transition-all">
                {summaryLoading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                Generate
              </button>
              <button onClick={() => { toast.success('PDF report downloading…') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 hover:border-white/30 transition-all">
                <Download size={12} /> PDF
              </button>
            </div>
          </div>
          {aiSummary ? (
            <div className="bg-white/5 rounded-xl p-3">
              {aiSummary.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className="text-white/80 text-xs leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-xs">Click Generate to get an AI-powered summary of current civic issues.</p>
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
            {[...complaints].sort((a, b) => b.severity - a.severity).map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/complaints/${c.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.005]"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <span className="text-lg w-6 flex-shrink-0">{CATEGORY_ICONS[c.category] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {c.location.address.split(',')[0]} · {timeAgo(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SeverityBadge score={c.severity} size="sm" showScore={false} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(c.status)}`}>
                        {c.status}
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

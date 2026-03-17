// ─────────────────────────────────────────────────────────────
// pages/MyComplaints.tsx
// Filterable list with live Socket.io status updates
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import SeverityBadge from '../components/SeverityBadge'
import { statusClass, timeAgo, CATEGORY_ICONS } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'
import { complaintsAPI, getUploadUrl } from '../api'

const STATUSES = ['all', 'pending', 'assigned', 'inprogress', 'resolved', 'rejected']

export default function MyComplaints() {
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setFilter]   = useState('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await complaintsAPI.getMine(1, 50)
        const list = (res.data?.complaints ?? []) as any[]
        if (!mounted) return
        setComplaints(list)
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Failed to load your reports.'
        toast.error(msg)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useSocket({
    onStatusUpdate: (d) => {
      setComplaints(prev => prev.map(c => (c._id === d.id || c.id === d.id) ? { ...c, status: d.status, updatedAt: d.updatedAt } : c))
      toast.success(`#${d.id} status → ${d.status}`)
    },
  })

  const filtered = complaints.filter(c => {
    const status = String(c.status || '').toLowerCase()
    const matchStatus = statusFilter === 'all' || status === statusFilter
    const address = String(c.location?.address || '')
    const matchSearch = String(c.title || '').toLowerCase().includes(search.toLowerCase()) ||
                        address.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/dashboard" className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-bold flex-1" style={{ fontFamily: 'Syne, sans-serif' }}>My Reports</h1>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(255,107,0,0.12)', color: 'var(--accent-orange)' }}>
          {filtered.length}
        </span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Search reports…" className="input-field pl-9" />
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border"
                    style={{
                      background: statusFilter === s ? 'var(--accent-orange)' : 'var(--bg-card)',
                      borderColor: statusFilter === s ? 'var(--accent-orange)' : 'var(--border)',
                      color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                    }}>
              {s}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <Filter size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reports found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <motion.div key={c._id || c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Link to={`/complaints/${c._id || c.id}`}>
                  <div className="p-4 rounded-2xl transition-all hover:scale-[1.01]"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex gap-3">
                      {/* Photo thumbnail */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                           style={{ background: 'var(--bg-secondary)' }}>
                        <img src={getUploadUrl(c.photoUrl || c.photo)} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-snug">{c.title}</p>
                          <ChevronRight size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(String(c.status || 'pending'))}`}>
                            {String(c.status || 'pending')}
                          </span>
                          <SeverityBadge score={Number(c.severityScore ?? c.severity ?? 0)} size="sm" showScore={false} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {CATEGORY_ICONS[String(c.category || '').toLowerCase()] ?? '📋'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            📍 {String(c.location?.address || '').split(',')[0]}
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(c.createdAt || new Date().toISOString())}
                          </span>
                        </div>

                        {Number(c.confirmations ?? c.communityConfirms ?? 0) > 0 && (
                          <p className="text-xs mt-1" style={{ color: 'var(--accent-teal)' }}>
                            👥 {Number(c.confirmations ?? c.communityConfirms ?? 0)} community confirmations
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

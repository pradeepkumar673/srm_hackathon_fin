// ─────────────────────────────────────────────────────────────
// pages/ComplaintDetail.tsx
// Full detail: AI description, live worker tracking on map,
// before/after photos, status timeline, community confirms
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ThumbsUp, Share2, Navigation, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import LeafletMap from '../components/LeafletMap'
import StatusTimeline from '../components/StatusTimeline'
import SeverityBadge from '../components/SeverityBadge'
import { MOCK_COMPLAINTS, statusClass, timeAgo, CATEGORY_ICONS } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'

export default function ComplaintDetail() {
  const { id }  = useParams<{ id: string }>()
  const initial = MOCK_COMPLAINTS.find(c => c.id === id) ?? MOCK_COMPLAINTS[0]

  const [complaint, setComplaint] = useState(initial)
  const [confirmed, setConfirmed] = useState(false)

  useSocket({
    onStatusUpdate: (d) => {
      if (d.id === id) setComplaint(c => ({ ...c, status: d.status }))
    },
    onWorkerLocation: (d) => {
      if (d.complaintId === id) {
        setComplaint(c => ({ ...c, workerLocation: { lat: d.lat, lng: d.lng }, workerEta: d.eta ?? c.workerEta }))
      }
    },
    onCommunityConfirm: (d) => {
      if (d.id === id) setComplaint(c => ({ ...c, communityConfirms: d.confirmCount }))
    },
    onResolutionVerified: (d) => {
      if (d.id === id) toast.success(`AI verified: ${d.message}`)
    },
  })

  function handleConfirm() {
    if (confirmed) return
    setConfirmed(true)
    setComplaint(c => ({ ...c, communityConfirms: c.communityConfirms + 1, severity: Math.min(100, c.severity + 5) }))
    toast.success('Thanks! Your confirmation boosted this issue\'s priority.')
  }

  const mockEvents = [
    { status: 'pending',    timestamp: complaint.createdAt,  note: 'Submitted by citizen' },
    ...(complaint.status !== 'pending' ? [{ status: 'assigned', timestamp: complaint.updatedAt, note: `Assigned to ${complaint.workerName ?? 'worker'}` }] : []),
    ...(complaint.status === 'inprogress' || complaint.status === 'resolved' ? [{ status: 'inprogress', timestamp: complaint.updatedAt, note: 'Worker on-site' }] : []),
    ...(complaint.status === 'resolved' ? [{ status: 'resolved', timestamp: complaint.updatedAt, note: 'AI verified 92% fixed' }] : []),
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/complaints" className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-bold flex-1 truncate" style={{ fontFamily: 'Syne, sans-serif' }}>#{complaint.id}</h1>
        <button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied!') }}
                className="w-8 h-8 rounded-xl flex items-center justify-center border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Share2 size={14} />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Photo */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl overflow-hidden">
          <img src={complaint.photo} alt="Issue" className="w-full max-h-52 object-cover" />
        </motion.div>

        {/* Title + badges */}
        <div>
          <div className="flex items-start gap-2 mb-2 flex-wrap">
            <span className="text-2xl">{CATEGORY_ICONS[complaint.category] ?? '📋'}</span>
            <SeverityBadge score={complaint.severity} size="md" />
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass(complaint.status)}`}>
              {complaint.status}
            </span>
          </div>
          <h2 className="text-xl font-bold leading-snug" style={{ fontFamily: 'Syne, sans-serif' }}>
            {complaint.title}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            📍 {complaint.location.address} · {timeAgo(complaint.createdAt)}
          </p>
        </div>

        {/* AI Description */}
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-teal)' }}>✨ AI Analysis</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{complaint.aiDescription}</p>
          <div className="flex items-center gap-3 mt-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>👥 {complaint.communityConfirms} confirmations</span>
            <span>🪙 {complaint.civicPoints} pts awarded</span>
          </div>
        </div>

        {/* Worker tracking */}
        {complaint.workerName && (
          <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg,#00B4D8,#0096B4)' }}>
                {complaint.workerName.split(' ').map(w => w[0]).join('')}
              </div>
              <div>
                <p className="font-semibold text-sm">{complaint.workerName}</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs" style={{ color: 'var(--accent-green)' }}>Live · {complaint.workerEta ?? '?'} away</span>
                </div>
              </div>
              <div className="ml-auto">
                <Navigation size={18} style={{ color: 'var(--accent-teal)' }} />
              </div>
            </div>
            <LeafletMap mode="citizen" height="200px" />
          </div>
        )}

        {/* Status timeline */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="font-bold mb-4 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Progress Timeline</p>
          <StatusTimeline currentStatus={complaint.status} events={mockEvents} />
        </div>

        {/* If resolved: before/after */}
        {complaint.status === 'resolved' && (
          <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="font-bold mb-3 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Before / After</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Before</p>
                <img src={complaint.photo} alt="Before" className="rounded-xl w-full h-28 object-cover" />
              </div>
              <div>
                <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--accent-green)' }}>After ✅</p>
                <div className="rounded-xl w-full h-28 flex items-center justify-center"
                     style={{ background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.2)' }}>
                  <div className="text-center">
                    <CheckCircle size={24} className="mx-auto text-green-400 mb-1" />
                    <p className="text-xs text-green-400 font-semibold">AI: 92% Fixed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Community confirm */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleConfirm}
          disabled={confirmed}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all"
          style={{
            background: confirmed ? 'rgba(6,214,160,0.12)' : 'var(--bg-card)',
            border: `1px solid ${confirmed ? 'rgba(6,214,160,0.4)' : 'var(--border)'}`,
            color: confirmed ? 'var(--accent-green)' : 'var(--text-primary)',
          }}
        >
          <ThumbsUp size={16} />
          {confirmed ? `Confirmed! (${complaint.communityConfirms})` : `Confirm this issue (${complaint.communityConfirms})`}
        </motion.button>
      </main>
    </div>
  )
}

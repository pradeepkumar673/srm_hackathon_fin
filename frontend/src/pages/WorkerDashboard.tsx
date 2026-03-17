// ─────────────────────────────────────────────────────────────
// pages/WorkerDashboard.tsx
// Worker view: assigned tasks, accept, GPS share, resolve with after-photo
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle, ChevronLeft, MapPin, Navigation, Radio, Upload, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import SeverityBadge from '../components/SeverityBadge'
import AIChatbot from '../components/AIChatbot'
import { MOCK_COMPLAINTS, CATEGORY_ICONS, statusClass, timeAgo } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'

interface Task {
  id: string; title: string; category: string; severity: number;
  status: string; address: string; createdAt: string; accepted: boolean; resolvedPhoto?: string
}

export default function WorkerDashboard() {
  const [tasks, setTasks] = useState<Task[]>(
    MOCK_COMPLAINTS.filter(c => c.workerId === 'W003' || c.workerId === 'W001').map(c => ({
      id: c.id, title: c.title, category: c.category, severity: c.severity,
      status: c.status, address: c.location.address, createdAt: c.createdAt, accepted: c.status !== 'assigned',
    }))
  )
  const [gpsSharing, setGpsSharing] = useState(false)
  const [resolveId, setResolveId]   = useState<string | null>(null)
  const [resolvePhoto, setResolvePhoto] = useState<string | null>(null)
  const [submitting, setSubmitting]    = useState(false)
  const watchRef = useRef<number | null>(null)
  const { emit } = useSocket()

  // GPS broadcast via Socket.io
  useEffect(() => {
    if (!gpsSharing) { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); return }
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        emit('worker-gps-update', {
          workerId: 'W003', workerName: 'Ravi Kumar',
          lat: pos.coords.latitude, lng: pos.coords.longitude,
        })
      },
      () => {}, { enableHighAccuracy: true }
    )
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current!) }
  }, [gpsSharing, emit])

  function acceptTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, accepted: true, status: 'inprogress' } : t))
    emit('accept-task', { taskId: id })
    toast.success('Task accepted! Live GPS started.')
    setGpsSharing(true)
  }

  async function resolveTask() {
    if (!resolveId) return
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1500))
    setTasks(prev => prev.map(t => t.id === resolveId ? { ...t, status: 'resolved', resolvedPhoto } : t))
    emit('resolve-task', { taskId: resolveId, afterPhotoUrl: resolvePhoto })
    setSubmitting(false)
    setResolveId(null)
    setResolvePhoto(null)
    toast.success('Resolved! AI is verifying the fix. 🤖')
  }

  const completed = tasks.filter(t => t.status === 'resolved').length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/login" onClick={() => localStorage.clear()}
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-bold flex-1" style={{ fontFamily: 'Syne, sans-serif' }}>Worker Dashboard</h1>
        {/* GPS toggle */}
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => setGpsSharing(g => !g)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                style={{ background: gpsSharing ? 'linear-gradient(135deg,#EF233C,#C91A2E)' : 'linear-gradient(135deg,#06D6A0,#049E74)' }}>
          <Radio size={12} className={gpsSharing ? 'animate-pulse' : ''} />
          {gpsSharing ? 'GPS Live' : 'Share GPS'}
        </motion.button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-28">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Assigned',  value: tasks.length,   color: 'var(--accent-orange)' },
            { label: 'Active',    value: tasks.filter(t => t.accepted && t.status !== 'resolved').length, color: 'var(--accent-teal)' },
            { label: 'Done Today',value: completed,       color: 'var(--accent-green)'  },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Task list */}
        <div>
          <h3 className="font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>My Tasks</h3>
          {tasks.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                            className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[t.category] ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(t.status)}`}>{t.status}</span>
                        <SeverityBadge score={t.severity} size="sm" showScore={false} />
                      </div>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={11} />{t.address.split(',')[0]} · {timeAgo(t.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    {!t.accepted && t.status !== 'resolved' && (
                      <button onClick={() => acceptTask(t.id)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                              style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)' }}>
                        <CheckCircle size={13} /> Accept Task
                      </button>
                    )}
                    {t.accepted && t.status !== 'resolved' && (
                      <>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${t.address}`}
                           target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border"
                           style={{ borderColor: 'var(--accent-teal)', color: 'var(--accent-teal)' }}>
                          <Navigation size={12} /> Navigate
                        </a>
                        <button onClick={() => setResolveId(t.id)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                                style={{ background: 'linear-gradient(135deg,#06D6A0,#049E74)' }}>
                          <CheckCircle size={13} /> Mark Resolved
                        </button>
                      </>
                    )}
                    {t.status === 'resolved' && (
                      <div className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                           style={{ background: 'rgba(6,214,160,0.10)', color: 'var(--accent-green)', border: '1px solid rgba(6,214,160,0.3)' }}>
                        <CheckCircle size={13} /> Completed ✅
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Resolve modal */}
      <AnimatePresence>
        {resolveId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
                        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Upload After Photo</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI will compare before/after and verify the fix automatically.
              </p>
              <label className="block cursor-pointer">
                <div className="rounded-xl border-2 border-dashed p-6 text-center transition-all hover:border-orange-400"
                     style={{ borderColor: resolvePhoto ? 'var(--accent-green)' : 'var(--border)' }}>
                  {resolvePhoto
                    ? <><CheckCircle size={24} className="mx-auto text-green-400 mb-1" /><p className="text-xs text-green-400">Photo ready</p></>
                    : <><Upload size={24} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap to capture / upload</p></>
                  }
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden"
                       onChange={e => {
                         const f = e.target.files?.[0]
                         if (!f) return
                         const r = new FileReader()
                         r.onload = ev => setResolvePhoto(ev.target?.result as string)
                         r.readAsDataURL(f)
                       }} />
              </label>
              <div className="flex gap-3">
                <button onClick={() => { setResolveId(null); setResolvePhoto(null) }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={resolveTask} disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg,#06D6A0,#049E74)' }}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} />Submit</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AIChatbot userRole="worker" userName="Ravi" />
    </div>
  )
}

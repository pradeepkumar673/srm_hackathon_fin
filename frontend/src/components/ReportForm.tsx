// ─────────────────────────────────────────────────────────────
// components/ReportForm.tsx
// Full AI-powered report form:
//   • Drag-and-drop photo with TensorFlow.js instant severity preview
//   • Roboflow API call for production (stubbed with mock)
//   • GPS button (browser Geolocation)
//   • Click-to-pin Leaflet map
//   • Fake report detector badge
//   • Voice report button
//   • AI category override
//   • Groq description generation
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, MapPin, Loader2, AlertTriangle, CheckCircle, Sparkles, Navigation } from 'lucide-react'
import toast from 'react-hot-toast'
import LeafletMap from './LeafletMap'
import SeverityBadge from './SeverityBadge'
import VoiceReportButton from './VoiceReportButton'
import { CATEGORIES, CATEGORY_ICONS } from '../lib/utils'
import { complaintsAPI } from '../api'

interface AIResult {
  category: string
  severity: number
  description: string
  isFake: boolean
  fakeReason?: string
  confidence: number
}

export default function ReportForm() {
  const [photo, setPhoto]           = useState<string | null>(null)
  const [photoFile, setPhotoFile]   = useState<File | null>(null)
  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]     = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [aiResult, setAiResult]     = useState<AIResult | null>(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [dragOver, setDragOver]     = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  // ── Photo handling ──────────────────────────────────────
  async function handlePhoto(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPhoto(e.target?.result as string)
    reader.readAsDataURL(file)
    
    // Auto-analyze photo
    await analyzeUploadedPhoto(file)
  }

  // ── AI Auto-Fill ────────────────────────────────────────
  async function analyzeUploadedPhoto(file: File) {
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      // Optional hint helps the model craft a better title/description
      fd.append('hint', title || description || '')
      
      const res = await complaintsAPI.analyze(fd)
      const ai = res.data?.data
      
      if (ai) {
        // Backend categories are Title Case; UI category values are lowercase keys
        const categoryMap: Record<string, string> = {
          Pothole: 'pothole',
          Garbage: 'garbage',
          'Broken Street Light': 'streetlight',
          'Water Leakage': 'waterleakage',
          'Road Damage': 'roadcrack',
        }

        const uiCategory = categoryMap[String(ai.category)] ?? category
        const approxSizeText = ai.approxSize ? `\n\nApprox size: ${ai.approxSize}` : ''
        const keyDetailsText =
          Array.isArray(ai.keyDetails) && ai.keyDetails.length > 0
            ? `\n\nKey details:\n- ${ai.keyDetails.slice(0, 5).join('\n- ')}`
            : ''

        // Set AI card preview (keeps your existing UI intact)
        setAiResult({
          category: String(ai.category ?? uiCategory),
          severity: Number(ai.severityScore ?? 0),
          description: String(ai.description ?? '') + approxSizeText + keyDetailsText,
          isFake: Boolean(ai.isFake),
          fakeReason: ai.fakeReason,
          confidence: Number(ai.confidence ?? 0) || 0,
        })

        // Auto-fill form fields (only overwrite if user hasn't typed)
        if (ai.title && !title) setTitle(String(ai.title))
        if (ai.description && !description) setDescription(String(ai.description))
        if (uiCategory && !category) setCategory(uiCategory)
        toast.success('AI has automatically filled in the details based on the photo!', { id: 'ai-fill' })
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err)
      toast.error('AI preview failed. You can still submit the report.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── GPS ────────────────────────────────────────────────
  function getGPS() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    toast.loading('Getting your location…', { id: 'gps' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        // Nominatim reverse geocode (free, no key, add 1s delay to respect rate limit)
        try {
          await new Promise(r => setTimeout(r, 1000))
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            headers: { 'User-Agent': 'AI-SmartCivic/1.0 (hackathon)' },
          })
          const data = await res.json()
          setLocation({ lat, lng, address: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
          toast.success('Location captured!', { id: 'gps' })
        } catch {
          setLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
          toast.success('Location captured!', { id: 'gps' })
        }
      },
      () => { toast.error('Could not get location', { id: 'gps' }) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ── Map pin ────────────────────────────────────────────
  async function handleMapPin(lat: number, lng: number) {
    try {
      await new Promise(r => setTimeout(r, 1000))
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'User-Agent': 'AI-SmartCivic/1.0 (hackathon)' },
      })
      const data = await res.json()
      setLocation({ lat, lng, address: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
    } catch {
      setLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
    }
    toast.success('Location pinned on map!')
  }

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!photoFile) { toast.error('Please upload a photo'); return }
    if (!location) { toast.error('Please set a location'); return }
    if (!title)    { toast.error('Please add a title'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('photo', photoFile)
      fd.append('title', title)
      fd.append('description', description || title)
      fd.append('category', category || 'Road Damage')
      fd.append('lat', String(location.lat))
      fd.append('lng', String(location.lng))

      const res = await complaintsAPI.report(fd)
      const complaintId = res.data?.complaint?.id as string | undefined

      const ai = res.data?.aiAnalysis
      if (ai) {
        setAiResult({
          category: (ai.autoCategory ?? category ?? 'other') as string,
          severity: Number(ai.severityScore ?? 0),
          description: (ai.description ?? description ?? '') as string,
          isFake: Number(ai.fakeScore ?? 0) >= 70,
          fakeReason: Number(ai.fakeScore ?? 0) >= 70 ? 'High fake/spam probability' : undefined,
          confidence: 90,
        })
        if (ai.autoCategory && !category) setCategory(ai.autoCategory)
        if (ai.description && !description) setDescription(ai.description)
      }

      setSubmittedId(complaintId ?? null)
      setSubmitted(true)
      toast.success(res.data?.message ?? 'Report submitted successfully!')
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit report.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center text-center p-12 gap-4"
      >
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(6,214,160,0.15)', border: '2px solid rgba(6,214,160,0.4)' }}>
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Report Submitted!
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          AI has assigned Severity {aiResult?.severity ?? 0}
          {submittedId ? ` · Your complaint ID: ${submittedId}` : ''}
        </p>
        <button onClick={() => { setSubmitted(false); setPhoto(null); setAiResult(null); setTitle(''); setLocation(null) }}
                className="btn-primary mt-2">
          Submit Another
        </button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Photo upload ──────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Photo <span className="text-red-400">*</span>
        </label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handlePhoto(f) }}
          onClick={() => fileInputRef.current?.click()}
          className="relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden"
          style={{
            borderColor: dragOver ? 'var(--accent-orange)' : 'var(--border)',
            background: dragOver ? 'rgba(255,107,0,0.05)' : 'var(--bg-secondary)',
            minHeight: photo ? 'auto' : '160px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }}
          />

          {photo ? (
            <div className="relative">
              <img src={photo} alt="Uploaded" className="w-full max-h-56 object-cover rounded-2xl" />
              {analyzing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
                     style={{ background: 'rgba(10,37,64,0.75)' }}>
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-orange)' }} />
                    <p className="text-sm font-semibold">AI analyzing photo…</p>
                    <p className="text-xs opacity-70">Roboflow · TensorFlow.js</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)' }}>
                <Upload size={22} style={{ color: 'var(--accent-orange)' }} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Drag & drop or tap to upload
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  AI will auto-detect issue type, severity & fake reports
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AI result card */}
        <AnimatePresence>
          {aiResult && !analyzing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 rounded-xl border"
              style={{ background: 'rgba(6,214,160,0.06)', borderColor: 'rgba(6,214,160,0.25)' }}
            >
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-green-400">AI Analysis</span>
                    <SeverityBadge score={aiResult.severity} size="sm" />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {aiResult.description}
                  </p>
                  {aiResult.isFake && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                      <AlertTriangle size={12} />
                      Possible fake report: {aiResult.fakeReason}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Title + voice ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Issue Title <span className="text-red-400">*</span>
          </label>
          <VoiceReportButton onTranscript={text => setTitle(text)} />
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Brief description of the issue…"
          className="input-field"
        />
      </div>

      {/* ── Category (AI override) ────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Category
          {aiResult && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--accent-teal)' }}>← AI suggested</span>}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all"
              style={{
                background: category === cat.value ? 'rgba(255,107,0,0.10)' : 'var(--bg-secondary)',
                borderColor: category === cat.value ? 'var(--accent-orange)' : 'var(--border)',
                color: category === cat.value ? 'var(--accent-orange)' : 'var(--text-secondary)',
              }}
            >
              <span className="text-lg">{CATEGORY_ICONS[cat.value]}</span>
              <span className="truncate w-full text-center">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Description ───────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the issue in detail (AI will fill this if a photo is uploaded)…"
          className="input-field resize-none"
        />
      </div>

      {/* ── Location ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Location <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={getGPS}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#00B4D8,#0096B4)' }}
          >
            <Navigation size={12} />
            Use GPS
          </button>
        </div>
        {location && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 mb-2 p-2.5 rounded-xl"
            style={{ background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)' }}
          >
            <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-teal)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{location.address}</p>
          </motion.div>
        )}
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          Or click on the map to pin your location ↓
        </p>
        <LeafletMap
          mode="picker"
          onPinSelect={handleMapPin}
          selectedPin={location}
          height="220px"
        />
      </div>

      {/* ── Submit ────────────────────────────────────────── */}
      <motion.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.97 }}
        className="btn-primary w-full justify-center py-3.5 text-sm"
      >
        {submitting ? (
          <><Loader2 size={16} className="animate-spin" /> Submitting…</>
        ) : (
          <><CheckCircle size={16} /> Submit Report</>
        )}
      </motion.button>
    </form>
  )
}

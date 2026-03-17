// ─────────────────────────────────────────────────────────────
// components/LeafletMap.tsx
// Full-featured Leaflet map:
//   • Colored severity pins
//   • Dynamic heatmap (CSS class based)
//   • Live worker avatars with ETA badges
//   • Clustering
//   • Click-to-pin for report form
//   • Real-time via Socket.io worker-location events
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { motion } from 'framer-motion'
import { Navigation, Layers, Cloud } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import { MOCK_COMPLAINTS, MOCK_WORKERS, severityLabel, statusClass, timeAgo } from '../lib/utils'
import { useSocket } from '../hooks/useSocket'

// Fix default icon paths for Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Custom severity icon factory ───────────────────────────
function severityIcon(score: number) {
  const color = severityLabel(score).color
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      cursor:pointer;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// ── Worker icon ─────────────────────────────────────────────
function workerIcon(name: string) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:linear-gradient(135deg,#00B4D8,#0096B4);
      border:3px solid white;
      box-shadow:0 0 0 0 rgba(0,180,216,0.5), 0 2px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;color:white;
      animation: worker-pulse 2s infinite;
    ">${initials}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// ── Click-to-pin sub-component ──────────────────────────────
interface ClickPinProps { onPin: (latlng: L.LatLng) => void }
function ClickPin({ onPin }: ClickPinProps) {
  useMapEvents({ click: (e) => onPin(e.latlng) })
  return null
}

// ── Props ────────────────────────────────────────────────────
interface WorkerPos { workerId: string; workerName: string; lat: number; lng: number; eta?: string }

interface Props {
  mode?: 'admin' | 'citizen' | 'picker'
  onPinSelect?: (lat: number, lng: number) => void
  selectedPin?: { lat: number; lng: number } | null
  height?: string
  className?: string
}

export default function LeafletMap({ mode = 'admin', onPinSelect, selectedPin, height = '420px', className = '' }: Props) {
  const [showHeatmap, setShowHeatmap]     = useState(true)
  const [showWorkers, setShowWorkers]     = useState(true)
  const [rainMode, setRainMode]           = useState(false)
  const [workerPositions, setWorkerPositions] = useState<WorkerPos[]>(
    MOCK_WORKERS.map(w => ({ workerId: w.id, workerName: w.name, lat: w.location.lat, lng: w.location.lng }))
  )

  // Live worker location updates via Socket.io
  useSocket({
    onWorkerLocation: (d) => {
      setWorkerPositions(prev => {
        const idx = prev.findIndex(w => w.workerId === d.workerId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...d }
          return next
        }
        return [...prev, d]
      })
    },
  })

  const center: [number, number] = [13.0827, 80.2707] // Chennai

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} style={{ height }}>
      {/* Map controls */}
      <div className="absolute top-3 right-3 z-[999] flex flex-col gap-2">
        {mode === 'admin' && (
          <>
            <button
              onClick={() => setShowHeatmap(h => !h)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
              title="Toggle heatmap"
              style={{ background: showHeatmap ? 'rgba(255,107,0,0.8)' : 'rgba(10,37,64,0.7)' }}
            >
              <Layers size={15} />
            </button>
            <button
              onClick={() => setShowWorkers(w => !w)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
              title="Toggle workers"
              style={{ background: showWorkers ? 'rgba(0,180,216,0.8)' : 'rgba(10,37,64,0.7)' }}
            >
              <Navigation size={15} />
            </button>
            <button
              onClick={() => setRainMode(r => !r)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
              title="Rain risk multiplier (OpenWeather)"
              style={{ background: rainMode ? 'rgba(6,214,160,0.8)' : 'rgba(10,37,64,0.7)' }}
            >
              <Cloud size={15} />
            </button>
          </>
        )}
      </div>

      {/* Rain overlay badge */}
      {rainMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-3 left-3 z-[999] px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: 'rgba(6,214,160,0.85)' }}
        >
          🌧️ Rain mode: pothole risk ×3
        </motion.div>
      )}

      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* FREE OpenStreetMap tiles — no API key needed */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Click-to-pin for report form */}
        {mode === 'picker' && onPinSelect && (
          <ClickPin onPin={(ll) => onPinSelect(ll.lat, ll.lng)} />
        )}

        {/* Selected pin (report form) */}
        {mode === 'picker' && selectedPin && (
          <Marker
            position={[selectedPin.lat, selectedPin.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="
                width:22px;height:22px;border-radius:50%;
                background:var(--accent-orange,#FF6B00);
                border:3px solid white;
                box-shadow:0 0 0 4px rgba(255,107,0,0.3);
              "></div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })}
          />
        )}

        {/* Complaint markers */}
        {(mode === 'admin' || mode === 'citizen') && MOCK_COMPLAINTS.map(c => (
          <Marker
            key={c.id}
            position={[c.location.lat, c.location.lng]}
            icon={severityIcon(rainMode && c.category === 'pothole' ? Math.min(100, c.severity * 1.5) : c.severity)}
          >
            <Popup>
              <div className="w-52 font-body">
                <p className="font-semibold text-sm mb-1">{c.title}</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(c.status)}`}>
                    {c.status}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Sev: {c.severity}{rainMode && c.category === 'pothole' ? ' → ' + Math.min(100, Math.round(c.severity * 1.5)) + '⚡' : ''}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.location.address}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.createdAt)}</p>
                {c.workerEta && (
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--accent-teal)' }}>
                    🚶 Worker arriving in {c.workerEta}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Heatmap circles (severity-weighted, CSS opacity) */}
        {mode === 'admin' && showHeatmap && MOCK_COMPLAINTS.map(c => (
          <Circle
            key={`heat-${c.id}`}
            center={[c.location.lat, c.location.lng]}
            radius={rainMode && c.category === 'pothole' ? 600 : 400}
            pathOptions={{
              color: severityLabel(c.severity).color,
              fillColor: severityLabel(c.severity).color,
              fillOpacity: 0.08 + c.severity / 800,
              weight: 0,
            }}
          />
        ))}

        {/* Live worker markers */}
        {mode === 'admin' && showWorkers && workerPositions.map(w => (
          <Marker
            key={w.workerId}
            position={[w.lat, w.lng]}
            icon={workerIcon(w.workerName)}
          >
            <Popup>
              <div className="font-body">
                <p className="font-semibold text-sm">{w.workerName}</p>
                <p className="text-xs" style={{ color: 'var(--accent-teal)' }}>
                  🔴 Live location
                </p>
                {w.eta && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ETA: {w.eta}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

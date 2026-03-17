// ─────────────────────────────────────────────────────────────
// lib/utils.ts  – shared utility helpers
// ─────────────────────────────────────────────────────────────

/** Merge class names (tiny cn helper, no clsx dep needed) */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Severity score (0-100) → label + colour */
export function severityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: 'Critical',  color: '#EF233C', bg: 'status-rejected'   }
  if (score >= 50) return { label: 'High',       color: '#FF6B00', bg: 'status-inprogress' }
  if (score >= 25) return { label: 'Medium',     color: '#FFB347', bg: 'status-assigned'   }
  return                  { label: 'Low',         color: '#06D6A0', bg: 'status-resolved'   }
}

/** Map status string → Tailwind class */
export function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending:     'status-pending',
    assigned:    'status-assigned',
    inprogress:  'status-inprogress',
    resolved:    'status-resolved',
    rejected:    'status-rejected',
  }
  return map[status.toLowerCase()] ?? 'status-pending'
}

/** Human-readable relative time */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1)  return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Category emoji map */
export const CATEGORY_ICONS: Record<string, string> = {
  pothole:      '🕳️',
  garbage:      '🗑️',
  streetlight:  '💡',
  waterleakage: '💧',
  roadcrack:    '🛣️',
  treefallen:   '🌳',
  flooding:     '🌊',
  other:        '📋',
}

export const CATEGORIES = [
  { value: 'pothole',      label: 'Pothole' },
  { value: 'garbage',      label: 'Garbage Pile' },
  { value: 'streetlight',  label: 'Street Light' },
  { value: 'waterleakage', label: 'Water Leakage' },
  { value: 'roadcrack',    label: 'Road Crack' },
  { value: 'treefallen',   label: 'Fallen Tree' },
  { value: 'flooding',     label: 'Flooding' },
  { value: 'other',        label: 'Other' },
]

/** Mock KPI data for admin dashboard */
export const MOCK_KPIS = {
  totalReports:     284,
  pendingReports:   47,
  resolvedToday:    23,
  activeWorkers:    12,
  avgResolutionHrs: 18.4,
  citizenPoints:    1840,
}

/** Mock complaints for demo */
export const MOCK_COMPLAINTS = [
  {
    id: 'C001',
    title: 'Large pothole near Anna Nagar signal',
    category: 'pothole',
    severity: 82,
    status: 'inprogress',
    location: { lat: 13.085, lng: 80.21, address: 'Anna Nagar, Chennai' },
    photo: 'https://placehold.co/400x250/0A2540/FF6B00?text=Pothole+Photo',
    aiDescription: 'Large pothole detected (0.8m × 0.4m) causing hazard to two-wheelers. School within 150m — escalated to Critical.',
    aiSeverityScore: 82,
    aiCategory: 'pothole',
    isFakeDetected: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    workerId: 'W003',
    workerName: 'Ravi Kumar',
    workerLocation: { lat: 13.087, lng: 80.213 },
    workerEta: '8 min',
    civicPoints: 50,
    communityConfirms: 7,
  },
  {
    id: 'C002',
    title: 'Garbage pile overflow T Nagar',
    category: 'garbage',
    severity: 65,
    status: 'pending',
    location: { lat: 13.041, lng: 80.233, address: 'T Nagar, Chennai' },
    photo: 'https://placehold.co/400x250/0A2540/FF6B00?text=Garbage+Photo',
    aiDescription: 'Multiple garbage bags detected with overflow. Overdue collection by 2 days. Medium-high risk.',
    aiSeverityScore: 65,
    aiCategory: 'garbage',
    isFakeDetected: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    workerId: null,
    workerName: null,
    workerLocation: null,
    workerEta: null,
    civicPoints: 35,
    communityConfirms: 4,
  },
  {
    id: 'C003',
    title: 'Street light not working Adyar',
    category: 'streetlight',
    severity: 30,
    status: 'assigned',
    location: { lat: 13.001, lng: 80.256, address: 'Adyar, Chennai' },
    photo: 'https://placehold.co/400x250/0A2540/FF6B00?text=Streetlight+Photo',
    aiDescription: 'Non-functional street light identified on main road. Low risk during day, medium at night.',
    aiSeverityScore: 30,
    aiCategory: 'streetlight',
    isFakeDetected: false,
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    workerId: 'W001',
    workerName: 'Suresh Babu',
    workerLocation: { lat: 13.003, lng: 80.258 },
    workerEta: '15 min',
    civicPoints: 20,
    communityConfirms: 2,
  },
  {
    id: 'C004',
    title: 'Water pipe burst Velachery main road',
    category: 'waterleakage',
    severity: 90,
    status: 'pending',
    location: { lat: 12.978, lng: 80.218, address: 'Velachery, Chennai' },
    photo: 'https://placehold.co/400x250/0A2540/FF6B00?text=WaterLeak+Photo',
    aiDescription: 'Severe water pipe burst detected. Significant water loss, road flooding risk. Hospital nearby — marked Critical.',
    aiSeverityScore: 90,
    aiCategory: 'waterleakage',
    isFakeDetected: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    workerId: null,
    workerName: null,
    workerLocation: null,
    workerEta: null,
    civicPoints: 75,
    communityConfirms: 12,
  },
]

/** Mock workers */
export const MOCK_WORKERS = [
  { id: 'W001', name: 'Suresh Babu',   skill: 'electrician', activeJobs: 1, location: { lat: 13.003, lng: 80.258 } },
  { id: 'W002', name: 'Priya Devi',    skill: 'sanitation',  activeJobs: 0, location: { lat: 13.060, lng: 80.240 } },
  { id: 'W003', name: 'Ravi Kumar',    skill: 'roads',       activeJobs: 1, location: { lat: 13.087, lng: 80.213 } },
  { id: 'W004', name: 'Meena Srinivas',skill: 'plumber',     activeJobs: 0, location: { lat: 12.990, lng: 80.230 } },
]

/** Leaderboard mock */
export const MOCK_LEADERBOARD = [
  { rank: 1,  name: 'Karthik R.',    points: 480, reports: 14, resolved: 12, badge: '🏆' },
  { rank: 2,  name: 'Lakshmi P.',    points: 395, reports: 11, resolved: 10, badge: '🥈' },
  { rank: 3,  name: 'Muthu S.',      points: 310, reports: 9,  resolved: 8,  badge: '🥉' },
  { rank: 4,  name: 'Anitha D.',     points: 275, reports: 8,  resolved: 7,  badge: '⭐' },
  { rank: 5,  name: 'Venkat B.',     points: 240, reports: 7,  resolved: 6,  badge: '⭐' },
  { rank: 6,  name: 'Sudha M.',      points: 195, reports: 6,  resolved: 5,  badge: '⭐' },
  { rank: 7,  name: 'You',           points: 120, reports: 4,  resolved: 3,  badge: '🔵', isMe: true },
]

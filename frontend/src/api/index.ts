// ═══════════════════════════════════════════════════════
// api/index.ts  — Production API client
// Wired to all real backend endpoints (src/controllers/*)
// ═══════════════════════════════════════════════════════
import axios from 'axios'
import toast from 'react-hot-toast'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export const api = axios.create({ baseURL: BASE + '/api', timeout: 15000 })

// ── Auth token injection ──────────────────────────────
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('civic_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── Global error handler ──────────────────────────────
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('civic_token')
      localStorage.removeItem('civic_role')
      localStorage.removeItem('civic_name')
      localStorage.removeItem('civic_language')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
export const authAPI = {
  register: (data: { name: string; email: string; password: string; role?: string; language?: string; skills?: string[]; phone?: string }) =>
    api.post('/auth/register', data),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getProfile: () => api.get('/auth/profile'),

  updateProfile: (data: { name?: string; language?: string; lat?: number; lng?: number }) =>
    api.patch('/auth/profile', data),

  getLeaderboard: () => api.get('/auth/leaderboard'),
}

// ═══════════════════════════════════════════════════════
// COMPLAINTS
// ═══════════════════════════════════════════════════════
export const complaintsAPI = {
  report: (formData: FormData) =>
    api.post('/complaints/report', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),

  getMine: (page = 1, limit = 10) =>
    api.get(`/complaints/my?page=${page}&limit=${limit}`),

  getById: (id: string) => api.get(`/complaints/${id}`),

  getPublic: (params?: { lat?: number; lng?: number; radius?: number; category?: string; status?: string }) =>
    api.get('/complaints/public', { params }),

  confirm: (id: string) => api.post(`/complaints/${id}/confirm`),

  analyze: (formData: FormData) =>
    api.post('/complaints/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),
}

// ═══════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getMapData: () => api.get('/admin/map-data'),
  assignWorker: (complaintId: string, workerId?: string) =>
    api.post('/admin/assign-worker', { complaintId, workerId }),
  updateStatus: (id: string, status: string, message?: string) =>
    api.patch(`/admin/complaints/${id}/status`, { status, message }),
  downloadPDF: () => api.get('/admin/weekly-pdf', { responseType: 'blob', timeout: 30000 }),
  getWorkers: () => api.get('/admin/workers'),
  getNotifications: () => api.get('/admin/notifications'),
}

// ═══════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════
export const workerAPI = {
  getAssigned: () => api.get('/worker/assigned'),
  accept: (id: string) => api.patch(`/worker/accept/${id}`),
  updateLocation: (lat: number, lng: number) =>
    api.post('/worker/location', { lat, lng }),
  resolve: (id: string, formData: FormData) =>
    api.post(`/worker/resolve/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),
  getNotifications: () => api.get('/worker/notifications'),
}

// ═══════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════
export const chatAPI = {
  send: (message: string, isVoice = false, complaintId?: string) =>
    api.post('/chat', { message, isVoice, complaintId }),
  getSuggestions: () => api.get('/chat/suggestions'),
  voiceReport: (formData: FormData) =>
    api.post('/chat/voice-report', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
export function getUploadUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return BASE + '/' + path.replace(/^\//, '')
}

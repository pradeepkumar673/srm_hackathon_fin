// ─────────────────────────────────────────────────────────────
// App.tsx  – Root with React Router 6, page transitions, Toaster
// ─────────────────────────────────────────────────────────────
import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'

// Lazy-loaded pages for code-splitting
const Login            = lazy(() => import('./pages/Login'))
const Register         = lazy(() => import('./pages/Register'))
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard'))
const MyComplaints     = lazy(() => import('./pages/MyComplaints'))
const ComplaintDetail  = lazy(() => import('./pages/ComplaintDetail'))
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'))
const WorkerDashboard  = lazy(() => import('./pages/WorkerDashboard'))
const Leaderboard      = lazy(() => import('./pages/Leaderboard'))

// ── Page transition wrapper ──────────────────────────────────
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{   opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

// ── Loading skeleton ─────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="min-h-screen p-4 space-y-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="skeleton h-14 rounded-2xl" />
      <div className="skeleton h-32 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
      <div className="skeleton h-48 rounded-2xl" />
      <div className="skeleton h-20 rounded-2xl" />
    </div>
  )
}

// ── Auth guard ───────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('civic_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Dark mode initializer ────────────────────────────────────
function DarkModeInit() {
  useEffect(() => {
    // Default to dark mode
    if (!localStorage.getItem('civic_theme')) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('civic_theme', 'dark')
    } else if (localStorage.getItem('civic_theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])
  return null
}

// ── Animated routes ──────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/login"    element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />

        {/* Citizen */}
        <Route path="/dashboard" element={<RequireAuth><PageWrapper><CitizenDashboard /></PageWrapper></RequireAuth>} />
        <Route path="/complaints" element={<RequireAuth><PageWrapper><MyComplaints /></PageWrapper></RequireAuth>} />
        <Route path="/complaints/:id" element={<RequireAuth><PageWrapper><ComplaintDetail /></PageWrapper></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><PageWrapper><Leaderboard /></PageWrapper></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAuth><PageWrapper><AdminDashboard /></PageWrapper></RequireAuth>} />

        {/* Worker */}
        <Route path="/worker" element={<RequireAuth><PageWrapper><WorkerDashboard /></PageWrapper></RequireAuth>} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

// ── Root App ─────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <DarkModeInit />

      {/* React Hot Toast – top-right, custom style */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--bg-card)',
            color:      'var(--text-primary)',
            border:     '1px solid var(--border)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize:   '13px',
            borderRadius: '12px',
            boxShadow:  'var(--shadow)',
          },
          success: {
            iconTheme: { primary: '#06D6A0', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#EF233C', secondary: 'white' },
          },
        }}
      />

      <Suspense fallback={<PageSkeleton />}>
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  )
}

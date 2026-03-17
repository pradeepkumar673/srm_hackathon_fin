// ─────────────────────────────────────────────────────────────
// pages/Login.tsx  – Elegant login with dark mode + Tamil/English toggle
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Languages, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [tamil, setTamil]       = useState(false)
  const navigate                = useNavigate()

  const T = tamil ? {
    title:    'AI-ஸ்மார்ட்சிவிக்',
    subtitle: 'உங்கள் நகரை மேம்படுத்துங்கள்',
    email:    'மின்னஞ்சல்',
    password: 'கடவுச்சொல்',
    login:    'உள்நுழை',
    noAccount:'கணக்கு இல்லையா?',
    register: 'பதிவு செய்யுங்கள்',
    demo:     'டெமோ நற்சான்றிதழ்கள்',
  } : {
    title:    'AI-SmartCivic',
    subtitle: 'Empowering Chennai, one report at a time.',
    email:    'Email address',
    password: 'Password',
    login:    'Sign in',
    noAccount:'Don\'t have an account?',
    register: 'Register',
    demo:     'Demo credentials',
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)

    // Role detection from email for demo
    if (email.includes('admin')) {
      localStorage.setItem('civic_role', 'admin')
      localStorage.setItem('civic_token', 'mock-admin-token')
      navigate('/admin')
    } else if (email.includes('worker')) {
      localStorage.setItem('civic_role', 'worker')
      localStorage.setItem('civic_token', 'mock-worker-token')
      navigate('/worker')
    } else {
      localStorage.setItem('civic_role', 'citizen')
      localStorage.setItem('civic_token', 'mock-citizen-token')
      navigate('/dashboard')
    }
    toast.success('Welcome back! 👋')
  }

  function fillDemo(role: string) {
    const map: Record<string, [string, string]> = {
      citizen: ['citizen@example.com', 'demo123'],
      admin:   ['admin@example.com',   'demo123'],
      worker:  ['worker@example.com',  'demo123'],
    }
    const [e, p] = map[role]
    setEmail(e); setPassword(p)
    toast.success(`${role} credentials filled`)
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo area */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)', boxShadow: '0 8px 30px rgba(255,107,0,0.35)' }}
          >
            <ShieldCheck size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {T.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{T.subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-xl"
             style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Language toggle */}
          <div className="flex justify-end mb-5">
            <button
              onClick={() => setTamil(t => !t)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:border-orange-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
            >
              <Languages size={13} />
              {tamil ? 'English' : 'தமிழ்'}
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {T.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {T.password}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : T.login}
            </motion.button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              🔑 {T.demo}
            </p>
            <div className="flex gap-2 flex-wrap">
              {['citizen', 'admin', 'worker'].map(role => (
                <button
                  key={role}
                  onClick={() => fillDemo(role)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border capitalize transition-all hover:border-orange-400 hover:text-orange-400"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {T.noAccount}{' '}
            <Link to="/register" className="font-semibold" style={{ color: 'var(--accent-orange)' }}>
              {T.register}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

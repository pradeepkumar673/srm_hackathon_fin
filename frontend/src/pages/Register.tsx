// ─────────────────────────────────────────────────────────────
// pages/Register.tsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../api'

export default function Register() {
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'citizen', phone: '' })
  const [showPass, setShow] = useState(false)
  const [loading, setLoad]  = useState(false)
  const navigate            = useNavigate()

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error('Fill all required fields'); return }
    setLoad(true)
    try {
      const res = await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || undefined,
      })

      const token = res.data?.token as string | undefined
      const user = res.data?.user as { name?: string; role?: string; language?: string } | undefined
      if (!token || !user?.role) throw new Error('Invalid register response')

      localStorage.setItem('civic_token', token)
      localStorage.setItem('civic_role', user.role)
      if (user.name) localStorage.setItem('civic_name', user.name)
      if (user.language) localStorage.setItem('civic_language', user.language)

      toast.success('Account created!')
      navigate(user.role === 'admin' ? '/admin' : user.role === 'worker' ? '/worker' : '/dashboard')
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoad(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)', boxShadow: '0 8px 30px rgba(255,107,0,0.35)' }}>
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Create Account</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Join AI-SmartCivic — Chennai's smart civic platform</p>
        </div>

        <div className="rounded-2xl p-8 shadow-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>I am a…</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'citizen', label: 'Citizen',  emoji: '🏘️' },
                  { value: 'admin',   label: 'Admin',    emoji: '🏛️' },
                  { value: 'worker',  label: 'Worker',   emoji: '🔧' },
                ].map(r => (
                  <button key={r.value} type="button" onClick={() => update('role', r.value)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all"
                    style={{
                      background: form.role === r.value ? 'rgba(255,107,0,0.10)' : 'var(--bg-secondary)',
                      borderColor: form.role === r.value ? 'var(--accent-orange)' : 'var(--border)',
                      color: form.role === r.value ? 'var(--accent-orange)' : 'var(--text-secondary)',
                    }}>
                    <span className="text-xl">{r.emoji}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name *</label>
              <div className="relative">
                <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" className="input-field pl-9" />
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email *</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone (optional)</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min 8 characters" className="input-field pr-10" />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Account'}
            </motion.button>
          </form>

          <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--accent-orange)' }}>Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

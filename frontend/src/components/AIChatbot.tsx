// ─────────────────────────────────────────────────────────────
// components/AIChatbot.tsx
// Floating Groq-powered chatbot (Llama-3.1 via Groq Cloud)
// • Voice input (Web Speech API)
// • Role-aware suggestions (citizen / admin / worker)
// • Tamil ↔ English toggle
// • Anthropic API used here for demo (replace with Groq in prod)
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Mic, Bot, User, Loader2, Languages } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Props {
  userRole?: 'citizen' | 'admin' | 'worker'
  userName?: string
}

const SUGGESTIONS: Record<string, string[]> = {
  citizen: [
    'Report a pothole near me',
    'What is the status of my complaint?',
    'How do I earn civic points?',
    'எனது புகார் நிலை என்ன?',
  ],
  admin: [
    'Summarize top 5 issues in Zone 3',
    'Suggest workers for critical reports',
    'Any anomalies detected today?',
    'Generate weekly report summary',
  ],
  worker: [
    'Show my assigned tasks',
    'Navigate to nearest issue',
    'Mark my task as in progress',
    'How many tasks completed today?',
  ],
}

export default function AIChatbot({ userRole = 'citizen', userName = 'User' }: Props) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `வணக்கம்! Hi ${userName}! 👋 I'm your AI Civic Assistant. Ask me anything about reporting issues, checking status, or civic data. I speak Tamil & English!`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [lang, setLang]         = useState<'en-IN' | 'ta-IN'>('en-IN')
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const userMsg = (text ?? input).trim()
    if (!userMsg) return

    setInput('')
    const userEntry: Message = { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: new Date() }
    setMessages(prev => [...prev, userEntry])
    setLoading(true)

    try {
      // ── Call Groq Cloud (or Anthropic API for demo) ──────────
      // In production replace with:
      // const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY
      // fetch('https://api.groq.com/openai/v1/chat/completions', ...)
      //
      // For this demo we use the Anthropic API:
      const systemPrompt = `You are a smart civic assistant for Chennai's AI-SmartCivic platform.
Role: ${userRole}. User: ${userName}.
Keep responses concise (2-3 sentences). Respond in the same language as the user.
If asked in Tamil, respond in Tamil. Be helpful, friendly, and solution-focused.
You know about: pothole repairs, garbage collection, street lights, water leakages, civic points, report status.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: systemPrompt,
          messages: [
            ...messages.filter(m => m.id !== '0').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
          ],
        }),
      })

      const data = await res.json()
      const reply = data?.content?.[0]?.text ?? 'Sorry, I could not process your request right now.'

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }])
    } catch {
      // Fallback smart replies for offline demo
      const fallbacks: Record<string, string> = {
        status: 'Your Complaint #C001 is currently In Progress. Worker Ravi Kumar is 8 minutes away! 🚶',
        pothole: 'I\'ve detected your location. Submit via the Report form — AI will auto-classify it. Severity scored in <2 seconds! 🕳️',
        points: 'You have 120 Civic Points! Each confirmed report earns 20-75 points. Top 10 earners get recognized by the municipality. 🏆',
        default: 'I\'m currently in offline mode. Please check your internet connection. Your data is safe! ✅',
      }
      const key = Object.keys(fallbacks).find(k => userMsg.toLowerCase().includes(k)) ?? 'default'
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: fallbacks[key],
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  // Voice input
  function startVoice() {
    const SR = (window as Window & typeof globalThis).SpeechRecognition || (window as Window & typeof globalThis & { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { toast.error('Voice not supported'); return }
    const r = new SR()
    r.lang = lang
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0][0].transcript
      setInput(t)
      send(t)
    }
    r.onerror = () => toast.error('Voice error')
    r.start()
    toast.success('Listening…')
  }

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[1000] w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl"
        style={{
          background: open ? '#EF233C' : 'linear-gradient(135deg,#FF6B00,#FF8C42)',
          boxShadow: '0 8px 30px rgba(255,107,0,0.4)',
        }}
        aria-label="Open AI Chatbot"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}><X size={22} /></motion.div>
            : <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }}  animate={{ rotate: 0, opacity: 1 }}><MessageCircle size={22} /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{   opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-[999] w-80 sm:w-96 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            style={{
              height: '460px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#0A2540,#1A3A5C)', borderBottom: '1px solid #1A3A5C' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(255,107,0,0.2)', border: '1px solid rgba(255,107,0,0.3)' }}>
                  <Bot size={16} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Civic AI</p>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-300 text-[10px]">Groq · Llama-3.1</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLang(l => l === 'en-IN' ? 'ta-IN' : 'en-IN')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white/70 border border-white/10 hover:border-white/30 transition"
              >
                <Languages size={10} />
                {lang === 'en-IN' ? 'EN' : 'தமிழ்'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-orange-500/20' : 'bg-teal-500/20'
                  }`}>
                    {msg.role === 'user'
                      ? <User size={12} className="text-orange-400" />
                      : <Bot  size={12} className="text-teal-400" />
                    }
                  </div>
                  <div className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user' ? 'chatbot-bubble-user' : 'chatbot-bubble-ai'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Bot size={12} className="text-teal-400" />
                  </div>
                  <div className="chatbot-bubble-ai px-3 py-2">
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto flex-shrink-0">
              {SUGGESTIONS[userRole].slice(0,3).map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); send(s) }}
                  className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-medium whitespace-nowrap transition-all hover:border-orange-400 hover:text-orange-400"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
                >
                  {s.length > 30 ? s.slice(0,30) + '…' : s}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-3 pb-3 flex gap-2 flex-shrink-0"
                 style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={startVoice}
                className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <Mic size={14} />
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={lang === 'ta-IN' ? 'உங்கள் கேள்வியை தட்டச்சு செய்யுங்கள்…' : 'Ask anything…'}
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)', opacity: !input.trim() ? 0.5 : 1 }}
              >
                <Send size={14} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

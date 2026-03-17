// ─────────────────────────────────────────────────────────────
// pages/Leaderboard.tsx  – Public civic leaderboard
// ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronLeft, Trophy } from 'lucide-react'
import { MOCK_LEADERBOARD } from '../lib/utils'

export default function Leaderboard() {
  const top3    = MOCK_LEADERBOARD.slice(0, 3)
  const others  = MOCK_LEADERBOARD.slice(3)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/dashboard" className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-bold flex-1" style={{ fontFamily: 'Syne, sans-serif' }}>Civic Champions</h1>
        <Trophy size={18} style={{ color: 'var(--accent-orange)' }} />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-24">
        {/* Hero banner */}
        <div className="p-5 rounded-2xl text-center"
             style={{ background: 'linear-gradient(135deg,rgba(10,37,64,0.95),rgba(26,58,92,0.95))', border: '1px solid #1A3A5C' }}>
          <p className="text-3xl mb-1">🏆</p>
          <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>Chennai Civic Champions</h2>
          <p className="text-white/50 text-xs mt-1">Top reporters making Chennai a better city</p>
        </div>

        {/* Top 3 podium */}
        <div className="flex items-end justify-center gap-3 pt-4 pb-2">
          {/* 2nd */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="flex-1 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-2 font-bold text-white"
                 style={{ background: 'linear-gradient(135deg,#8D99AE,#6B7280)' }}>
              {top3[1]?.name.split(' ')[0][0]}
            </div>
            <p className="text-xs font-semibold text-center" style={{ color: 'var(--text-primary)' }}>{top3[1]?.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{top3[1]?.points} pts</p>
            <div className="w-full h-16 rounded-t-xl mt-2 flex items-center justify-center text-lg"
                 style={{ background: 'rgba(141,153,174,0.2)', border: '1px solid rgba(141,153,174,0.3)' }}>
              🥈
            </div>
          </motion.div>

          {/* 1st */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="flex-1 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-2 font-bold text-white"
                 style={{ background: 'linear-gradient(135deg,#FF6B00,#FF8C42)', boxShadow: '0 6px 20px rgba(255,107,0,0.4)' }}>
              {top3[0]?.name.split(' ')[0][0]}
            </div>
            <p className="text-xs font-bold text-center" style={{ color: 'var(--text-primary)' }}>{top3[0]?.name}</p>
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-orange)' }}>{top3[0]?.points} pts</p>
            <div className="w-full h-24 rounded-t-xl mt-2 flex items-center justify-center text-2xl"
                 style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)' }}>
              🥇
            </div>
          </motion.div>

          {/* 3rd */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="flex-1 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-2 font-bold text-white"
                 style={{ background: 'linear-gradient(135deg,#D97706,#B45309)' }}>
              {top3[2]?.name.split(' ')[0][0]}
            </div>
            <p className="text-xs font-semibold text-center" style={{ color: 'var(--text-primary)' }}>{top3[2]?.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{top3[2]?.points} pts</p>
            <div className="w-full h-10 rounded-t-xl mt-2 flex items-center justify-center text-lg"
                 style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}>
              🥉
            </div>
          </motion.div>
        </div>

        {/* Full table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {MOCK_LEADERBOARD.map((entry, i) => (
            <motion.div key={entry.rank}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                        style={{
                          borderBottom: i < MOCK_LEADERBOARD.length - 1 ? '1px solid var(--border)' : 'none',
                          background: (entry as { isMe?: boolean }).isMe ? 'rgba(255,107,0,0.05)' : 'transparent',
                        }}>
              <span className="text-base w-5 text-center">{entry.badge}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                   style={{ background: entry.rank <= 3 ? 'linear-gradient(135deg,#FF6B00,#FF8C42)' : 'var(--bg-secondary)' }}>
                {entry.name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: (entry as { isMe?: boolean }).isMe ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
                  {entry.name} {(entry as { isMe?: boolean }).isMe && <span className="text-xs">(You)</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {entry.reports} reports · {entry.resolved} resolved
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm" style={{ color: 'var(--accent-orange)', fontFamily: 'Syne, sans-serif' }}>
                  {entry.points}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* How to earn points */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="font-bold mb-3 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>🪙 How to Earn Points</p>
          {[
            ['Submit a report',            '+20 pts'],
            ['Report confirmed by AI',     '+15 pts'],
            ['Community confirms your report', '+10 pts / confirm'],
            ['Report resolved within 24h', '+25 pts'],
            ['Weekly streak (7 days)',     '+50 pts'],
          ].map(([action, pts]) => (
            <div key={action} className="flex justify-between py-1.5 text-xs border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{action}</span>
              <span className="font-bold" style={{ color: 'var(--accent-orange)' }}>{pts}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// components/VoiceReportButton.tsx
// Web Speech API voice-to-text that auto-fills report form
// Supports Tamil + English via SpeechRecognition API
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Languages } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onTranscript: (text: string) => void
  lang?: 'en-IN' | 'ta-IN'
}

// Augment window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

export default function VoiceReportButton({ onTranscript, lang = 'en-IN' }: Props) {
  const [listening, setListening]       = useState(false)
  const [transcript, setTranscript]     = useState('')
  const [currentLang, setCurrentLang]   = useState(lang)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      toast.error('Voice recognition not supported in this browser.')
      return
    }

    const recognition = new SR()
    recognition.lang            = currentLang
    recognition.continuous      = false
    recognition.interimResults  = true

    recognition.onstart = () => setListening(true)

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let final = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final  += e.results[i][0].transcript
        else                      interim += e.results[i][0].transcript
      }
      setTranscript(final || interim)
      if (final) {
        onTranscript(final)
        toast.success('Voice captured! Form updated.')
      }
    }

    recognition.onerror = () => {
      setListening(false)
      toast.error('Could not capture voice. Please try again.')
    }

    recognition.onend = () => setListening(false)

    recognition.start()
    recognitionRef.current = recognition
  }, [currentLang, onTranscript])

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const toggleLang = () => {
    setCurrentLang(l => l === 'en-IN' ? 'ta-IN' : 'en-IN')
    toast.success(`Switched to ${currentLang === 'en-IN' ? 'Tamil' : 'English'}`)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Language toggle */}
      <button
        type="button"
        onClick={toggleLang}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        <Languages size={13} />
        {currentLang === 'en-IN' ? 'EN' : 'தமிழ்'}
      </button>

      {/* Mic button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={listening ? stopListening : startListening}
        className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
        style={{
          background: listening
            ? 'linear-gradient(135deg,#EF233C,#C91A2E)'
            : 'linear-gradient(135deg,#00B4D8,#0096B4)',
          boxShadow: listening
            ? '0 4px 14px rgba(239,35,60,0.4)'
            : '0 4px 14px rgba(0,180,216,0.3)',
        }}
      >
        {/* Listening ripples */}
        {listening && (
          <>
            <span className="absolute inset-0 rounded-xl animate-ping opacity-30"
                  style={{ background: 'rgba(239,35,60,0.5)' }} />
          </>
        )}
        {listening ? <MicOff size={15} /> : <Mic size={15} />}
        {listening ? 'Stop' : 'Voice'}
      </motion.button>

      {/* Live transcript preview */}
      <AnimatePresence>
        {transcript && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs italic truncate max-w-[140px]"
            style={{ color: 'var(--text-muted)' }}
          >
            "{transcript}"
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

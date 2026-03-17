import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          navy:   '#0A2540',
          blue:   '#1A3A5C',
          orange: '#FF6B00',
          amber:  '#FFB347',
          teal:   '#00B4D8',
          green:  '#06D6A0',
          red:    '#EF233C',
          gray:   '#8D99AE',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':  'spin 4s linear infinite',
        'bounce-sm':  'bounce 1.5s infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      boxShadow: {
        'glow-orange': '0 0 20px rgba(255, 107, 0, 0.4)',
        'glow-teal':   '0 0 20px rgba(0, 180, 216, 0.4)',
        'glow-green':  '0 0 20px rgba(6, 214, 160, 0.4)',
        'card':        '0 4px 24px rgba(10, 37, 64, 0.12)',
        'card-dark':   '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}

export default config

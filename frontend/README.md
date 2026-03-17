# 🏙️ AI-SmartCivic — Smart Civic Issue Reporting & Resolution Platform

> **Hackathon Edition** · Chennai · 2026  
> Built with React 18 · TypeScript · Tailwind CSS · Leaflet · Socket.io · Groq AI · Roboflow

---

## 🚀 Quick Start (under 5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and add your API keys (optional — works with mocks)
cp .env.example .env

# 3. Start development server
npm run dev

# App runs at http://localhost:3000
```

---

## 🔑 Demo Login Credentials

| Role    | Email                  | Password |
|---------|------------------------|----------|
| Citizen | citizen@example.com    | demo123  |
| Admin   | admin@example.com      | demo123  |
| Worker  | worker@example.com     | demo123  |

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ReportForm.tsx        # AI photo analysis + GPS + map picker
│   │   ├── AIChatbot.tsx         # Floating Groq-powered chatbot
│   │   ├── LeafletMap.tsx        # Live map with heatmap + worker tracking
│   │   ├── VoiceReportButton.tsx # Web Speech API (Tamil + English)
│   │   ├── StatusTimeline.tsx    # Animated complaint lifecycle
│   │   ├── SeverityBadge.tsx     # Animated severity indicator
│   │   └── NotificationBell.tsx  # Real-time Socket.io notifications
│   ├── pages/
│   │   ├── Login.tsx             # Auth with Tamil/English toggle
│   │   ├── Register.tsx          # Role-based registration
│   │   ├── CitizenDashboard.tsx  # Citizen home + quick report
│   │   ├── MyComplaints.tsx      # Filterable complaint list
│   │   ├── ComplaintDetail.tsx   # Full detail + live worker tracking
│   │   ├── AdminDashboard.tsx    # KPIs + Groq summary + live map
│   │   ├── WorkerDashboard.tsx   # Task management + GPS broadcast
│   │   └── Leaderboard.tsx       # Civic points leaderboard
│   ├── hooks/
│   │   └── useSocket.ts          # Socket.io hook with typed events
│   ├── lib/
│   │   └── utils.ts              # Helpers, mock data, constants
│   └── styles/
│       └── globals.css           # CSS variables, animations, utilities
```

---

## 🤖 AI Features (10+)

| # | Feature | API Used |
|---|---------|----------|
| 1 | Photo auto-categorization + severity | Roboflow GARBAGE-POTHOLE |
| 2 | Fake/spam report detection | Hugging Face Vision |
| 3 | Severity + impact scoring engine | Groq + OSM data |
| 4 | Predictive hotspot heatmap | TensorFlow.js + OpenWeather |
| 5 | Smart worker auto-assignment | Groq optimization |
| 6 | Multilingual AI chatbot (Tamil/EN) | Groq Llama-3.1-70B |
| 7 | Real-time worker GPS tracking | Socket.io |
| 8 | AI resolution verification (before/after) | Roboflow comparison |
| 9 | Community validation + gamification | Civic Points system |
| 10 | Voice-only reporting mode | Web Speech API |
| 11 | Anomaly detection alerts | Groq + pattern matching |
| 12 | Weekly AI-generated PDF reports | Groq summarization |

---

## 🔌 Socket.io Events

### Server → Client
| Event | Payload | Handler |
|-------|---------|---------|
| `new-report` | `{ id, title, category, severity, location }` | Citizen/Admin map update |
| `status-update` | `{ id, status, updatedAt }` | Timeline + list refresh |
| `worker-location` | `{ workerId, lat, lng, eta }` | Live map worker icon |
| `anomaly-alert` | `{ zone, message, lat, lng }` | Admin alert banner |
| `resolution-verified` | `{ id, aiScore, message }` | Detail page toast |
| `community-confirm` | `{ id, confirmCount }` | Priority boost |
| `notification` | `{ type, message }` | Notification bell |

### Client → Server
| Event | When |
|-------|------|
| `worker-gps-update` | Every 5s when GPS sharing active |
| `accept-task` | Worker accepts a task |
| `resolve-task` | Worker marks resolved + photo |

---

## 🗺️ Map Features

- **OpenStreetMap tiles** — completely free, no API key
- **Colored severity pins** — Critical (red), High (orange), Medium (amber), Low (green)
- **Heatmap circles** — radius proportional to severity
- **Live worker avatars** — animated pulse, initials, ETA popup
- **Rain mode** — pothole risk ×3 overlay (OpenWeather API)
- **Click-to-pin** — map click sets report location in form
- **Nominatim reverse geocoding** — free, no key required

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary Navy | `#0A2540` |
| Accent Orange | `#FF6B00` |
| Accent Teal | `#00B4D8` |
| Accent Green | `#06D6A0` |
| Accent Red | `#EF233C` |
| Display Font | Syne (Google Fonts) |
| Body Font | DM Sans (Google Fonts) |
| Code Font | JetBrains Mono |

---

## 🎬 60-Second Demo Script

```
0:00 – Login as admin@example.com → Admin Dashboard
0:08 – Show KPI cards (284 reports, 4 critical, 12 workers)
0:15 – Click "Generate" → Groq AI summary appears
0:22 – Show live Leaflet map → toggle heatmap → toggle rain mode
0:30 – Click "AI Auto-Assign" → 2 workers assigned instantly
0:38 – Open sidebar → logout → login as citizen@example.com
0:42 – Click "Report a Civic Issue"
0:45 – Upload pothole photo → AI analyzes in 1.5s → severity badge + description
0:50 – Click "Use GPS" → location auto-filled
0:53 – Submit → +82 Civic Points toast
0:56 – Open AI Chatbot → "What's my complaint status?" → AI responds
1:00 – Show Leaderboard page → Done ✅
```

---

## 🌐 Deployment (Free)

```bash
# Frontend → Vercel
npm run build
vercel deploy --prod

# Backend → Render (free tier)
# Push backend/ to GitHub → connect to Render → auto-deploy
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript 5.5 |
| Build Tool | Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| Maps | React-Leaflet 4.2 + OpenStreetMap |
| Animations | Framer Motion 11.5 |
| Real-time | Socket.io-client 4.7 |
| AI/ML Client | @tensorflow/tfjs 4.21 |
| HTTP | Axios 1.7 |
| Icons | Lucide React 0.441 |
| Notifications | React Hot Toast 2.4 |
| Routing | React Router 6.26 |

---

*Built with ❤️ for SRM Hackathon 2026 · Team AI-SmartCivic*

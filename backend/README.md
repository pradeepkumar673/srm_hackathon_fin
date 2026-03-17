# AI-SmartCivic Backend

## Smart Civic Issue Reporting & Resolution Platform – Backend API

**Node.js 20 + Express 4.19 + Socket.io 4.7 + Mongoose 8.5 + Groq AI + Roboflow**

---

## 📁 Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.ts                    # MongoDB connection manager
│   ├── models/
│   │   ├── User.ts                  # User schema (citizen/admin/worker)
│   │   ├── Complaint.ts             # Complaint schema with AI fields
│   │   └── Worker.ts                # Worker + Notification schemas
│   ├── controllers/
│   │   ├── authController.ts        # Register, login, profile, leaderboard
│   │   ├── complaintController.ts   # 13-step AI pipeline
│   │   ├── adminController.ts       # Dashboard, map, assignment, PDF
│   │   ├── workerController.ts      # Assignments, location, resolution
│   │   └── chatController.ts        # Groq chatbot + voice commands
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── complaintRoutes.ts
│   │   ├── adminRoutes.ts
│   │   ├── workerRoutes.ts
│   │   └── chatRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts                  # JWT protect + authorize
│   │   ├── upload.ts                # Multer + Sharp compression
│   │   └── rateLimiter.ts           # express-rate-limit configs
│   ├── sockets/
│   │   └── socketHandler.ts         # All 8 WebSocket events
│   ├── utils/
│   │   ├── aiUtils.ts               # Roboflow, Groq, HF, OWM, Nominatim
│   │   ├── haversine.ts             # Geospatial utilities
│   │   └── pdfGenerator.ts          # pdf-lib weekly report
│   ├── scripts/
│   │   └── seed.ts                  # Demo data seed script
│   └── index.ts                     # Express + Socket.io server entry
├── uploads/                         # Local photo storage
├── .env.example                     # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 🚀 How to Run Backend

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas free tier)
- API keys (see below)

### Step 1 – Clone and install
```bash
cd backend
npm install
```

### Step 2 – Configure environment
```bash
cp .env.example .env
```

Edit `.env` with your API keys:

| Variable | Where to get it | Required |
|---|---|---|
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) (free) | ✅ |
| `JWT_SECRET` | Any 64-char random string | ✅ |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (free) | ✅ |
| `ROBOFLOW_API_KEY` | [app.roboflow.com](https://app.roboflow.com) (free) | ⚠️ optional |
| `HF_API_KEY` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (free) | ⚠️ optional |
| `OPENWEATHER_API_KEY` | [openweathermap.org/api](https://openweathermap.org/api) (free) | ⚠️ optional |

> **Note**: The app works without Roboflow/HF/OpenWeather – those features degrade gracefully.

### Step 3 – Create uploads directory
```bash
mkdir -p uploads
```

### Step 4 – Seed demo data
```bash
npm run seed
```

This creates:
- Admin: `admin@smartcivic.in` / `Password123!`
- Citizens: `priya@example.com`, `arjun@example.com`, `deepa@example.com`
- Workers: `ravi.worker@smartcivic.in`, `murugan.worker@smartcivic.in`, etc.
- 15 sample complaints across Chennai

### Step 5 – Start development server
```bash
npm run dev
```

Server starts at: `http://localhost:5000`

---

## 🔌 API Reference

### Auth
```
POST /api/auth/register   { name, email, password, role, language, skills? }
POST /api/auth/login      { email, password }
GET  /api/auth/profile    [Bearer token]
PATCH /api/auth/profile   { name?, language?, lat?, lng? }
GET  /api/auth/leaderboard
```

### Complaints (Citizen)
```
POST /api/complaints/report   [multipart: title, description, category, lat, lng, photo]
GET  /api/complaints/my
GET  /api/complaints/:id
GET  /api/complaints/public?lat=&lng=&radius=&category=&status=
POST /api/complaints/:id/confirm
```

### Admin
```
GET  /api/admin/dashboard
GET  /api/admin/map-data
POST /api/admin/assign-worker   { complaintId, workerId? }
PATCH /api/admin/complaints/:id/status   { status, message? }
GET  /api/admin/weekly-pdf      [streams PDF download]
GET  /api/admin/workers
GET  /api/admin/notifications
```

### Worker
```
GET   /api/worker/assigned
PATCH /api/worker/accept/:id
POST  /api/worker/location    { lat, lng }
POST  /api/worker/resolve/:id  [multipart: afterPhoto, notes?, pixelDiffScore?]
GET   /api/worker/notifications
```

### Chat (AI Chatbot)
```
POST /api/chat   { message, isVoice?, complaintId? }
GET  /api/chat/suggestions
```

---

## 🔌 WebSocket Events

Connect with: `socket.io-client` using `auth: { token: "<JWT>" }`

```javascript
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});
```

### Emitting (Client → Server)
| Event | Payload | Purpose |
|---|---|---|
| `subscribe-complaint` | `complaintId: string` | Join complaint room |
| `worker-location` | `{ lat, lng, complaintId? }` | Send GPS (Feature #7) |
| `community-confirm` | `{ complaintId, confirmed }` | Confirm issue (Feature #9) |
| `chat-message` | `{ targetRoom, message }` | Chat relay (Feature #6) |
| `request-map-data` | — | Get initial map data |

### Receiving (Server → Client)
| Event | Data | Feature |
|---|---|---|
| `new-report` | New complaint details | #1, #9 |
| `status-update` | `{ complaintId, status, message }` | #7 |
| `worker-location` | `{ workerId, location, etaMinutes }` | #7 |
| `community-confirm` | `{ complaintId, confirmations }` | #9 |
| `resolution-verified` | `{ fixedPercentage, verified, suggestion }` | #8 |
| `live-map-update` | Map data update | #4, #7 |
| `anomaly-alert` | `{ count, category, explanation }` | #13 |

---

## 🤖 13 AI Features Summary

| # | Feature | Tech Used | Route/Trigger |
|---|---|---|---|
| 1 | Auto-Detection & Categorization | Roboflow + Groq | POST /complaints/report |
| 2 | Fake/Spam Detection | HuggingFace + MongoDB $geoWithin | POST /complaints/report |
| 3 | Severity Scoring Engine | Multi-factor formula | POST /complaints/report |
| 4 | Predictive Heatmap | OpenWeatherMap + leaflet.heat | GET /admin/map-data |
| 5 | Smart Worker Assignment | Groq + Haversine | POST /admin/assign-worker |
| 6 | AI Chatbot | Groq llama-3.1-70b | POST /chat |
| 7 | Real-time Location | Socket.io + GPS | WS: worker-location |
| 8 | Resolution Verification | Groq + TF.js pixel diff | POST /worker/resolve/:id |
| 9 | Community Validation | Socket.io + civicPoints | WS: community-confirm |
| 10 | Multilingual AI | Groq translation | All endpoints |
| 11 | Weekly PDF Report | Groq + pdf-lib | GET /admin/weekly-pdf |
| 12 | Voice Reporting | SpeechRecognition → POST /chat | POST /chat (isVoice:true) |
| 13 | Anomaly Detection | MongoDB aggregation + Groq | POST /complaints/report |

---

## 📦 Exact Package Versions

See `package.json` for exact versions matching the spec:
- express: ^4.19.2
- socket.io: ^4.7.5
- mongoose: ^8.5.0
- @groq/groq-sdk: ^0.5.0
- multer: ^1.4.5-lts.1
- pdf-lib: ^1.17.1
- helmet: ^7.1.0
- express-rate-limit: ^7.4.0

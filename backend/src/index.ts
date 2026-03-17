/**
 * =============================================================
 * src/index.ts – Express Server Entry Point
 * =============================================================
 * Bootstraps the complete AI-SmartCivic backend server:
 *  1. Express app with security middleware (helmet, cors, rate-limit)
 *  2. MongoDB connection via Mongoose
 *  3. Static file serving for uploaded photos (/uploads)
 *  4. All API route registration
 *  5. Socket.io server initialization for all real-time features
 *  6. Health check endpoint
 *  7. Global error handler
 *  8. Graceful shutdown handlers (SIGTERM, SIGINT)
 *
 * WEBSOCKET FEATURES INITIALIZED HERE:
 *  - Feature #7: Real-time worker location tracking
 *  - Feature #9: Community confirmation events
 *  - Feature #13: Anomaly detection broadcasts
 *  - Feature #6: Chat message relay
 *  - Feature #8: Resolution verification broadcasts
 *
 * ALL 13 AI FEATURES are triggered through the complaint routes
 * and their controllers. Socket.io instance is injected into
 * controllers via setSocketIO() dependency injection pattern.
 * =============================================================
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// ---- Load environment variables first ----
dotenv.config();

// ---- Internal imports ----
import { connectDB } from './config/db';
import { initializeSocketHandlers } from './sockets/socketHandler';
import { generalLimiter } from './middleware/rateLimiter';

// Route imports
import authRoutes from './routes/authRoutes';
import complaintRoutes from './routes/complaintRoutes';
import adminRoutes from './routes/adminRoutes';
import workerRoutes from './routes/workerRoutes';
import chatRoutes from './routes/chatRoutes';

// Controller socket injection (dependency injection pattern)
import { setSocketIO } from './controllers/complaintController';
import { setAdminSocketIO } from './controllers/adminController';
import { setWorkerSocketIO } from './controllers/workerController';

// ============================================================
// INITIALIZE EXPRESS APP
// ============================================================
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ============================================================
// SECURITY MIDDLEWARE
// helmet: sets ~15 security-related HTTP headers
// ============================================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow image URLs from other origins
    contentSecurityPolicy: false, // Disable CSP for simplicity (re-enable in production)
  })
);

// ============================================================
// CORS CONFIGURATION
// Allows frontend (localhost:5173 by default) to call the API
// In production: restrict to your actual domain
// ============================================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,          // Allow cookies for session-based auth
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ============================================================
// BODY PARSERS
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================================
// STATIC FILE SERVING – Uploaded Photos
// GET /uploads/<filename> serves photos uploaded via Multer
// Accessible at: http://localhost:5000/uploads/<uuid>.jpg
// Feature #1/#8: Photo URLs stored in complaints reference this
// ============================================================
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads'), {
    maxAge: '1d', // Cache photos for 1 day
    etag: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// ============================================================
// GLOBAL RATE LIMITING
// 100 requests per 15 minutes per IP (general limiter)
// AI-specific routes have their own tighter limits (aiLimiter)
// ============================================================
app.use('/api/', generalLimiter);

// ============================================================
// HEALTH CHECK ENDPOINT
// Used by Docker health checks and monitoring tools
// ============================================================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'AI-SmartCivic API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// API ROUTES
// Each route file handles a specific domain:
//  /api/auth       → Authentication (register, login, profile)
//  /api/complaints → Civic reports (13-step AI pipeline)
//  /api/admin      → Admin dashboard, assignment, PDF
//  /api/worker     → Worker assignments, location, resolution
//  /api/chat       → Groq AI chatbot (Feature #6 + #12)
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/chat', chatRoutes);

// ============================================================
// 404 HANDLER – Catch unmatched routes
// ============================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// Catches any error thrown from route handlers / middleware
// Returns user-friendly JSON (stack trace only in development)
// ============================================================
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`❌ Unhandled error on ${req.method} ${req.path}:`, err.message);

  // CORS errors
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({
      success: false,
      message: 'CORS policy: request origin not allowed.',
    });
    return;
  }

  // JWT errors (should be caught in middleware but just in case)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ============================================================
// CREATE HTTP SERVER (needed for Socket.io to share the port)
// ============================================================
const httpServer = http.createServer(app);

// ============================================================
// SOCKET.IO SERVER INITIALIZATION
// Implements all 8 WebSocket event types:
//  "new-report"         → Feature #1/#9 (new complaint broadcast)
//  "status-update"      → Feature #7 (status changes)
//  "worker-location"    → Feature #7 (live GPS tracking)
//  "community-confirm"  → Feature #9 (confirmation prompt/response)
//  "chat-message"       → Feature #6 (chatbot relay)
//  "resolution-verified"→ Feature #8 (AI resolution result)
//  "live-map-update"    → Feature #4/#7 (heatmap + marker updates)
//  "anomaly-alert"      → Feature #13 (cluster anomaly detection)
// ============================================================
const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Transports: WebSocket preferred, polling as fallback
  transports: ['websocket', 'polling'],
  // Ping timeout/interval for connection health
  pingTimeout: 60000,
  pingInterval: 25000,
  // Max HTTP buffer size for file transfer over socket (unused here)
  maxHttpBufferSize: 1e6,
});

// Inject Socket.io instance into controllers
// (Dependency injection – avoids circular imports)
setSocketIO(io);
setAdminSocketIO(io);
setWorkerSocketIO(io);

// Initialize all Socket.io event handlers
initializeSocketHandlers(io);

// ============================================================
// START SERVER
// ============================================================
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB before accepting requests
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║    AI-SmartCivic Backend Server        ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║  🚀 Server:   http://localhost:${PORT}     ║`);
      console.log(`║  🔌 Socket:   ws://localhost:${PORT}       ║`);
      console.log(`║  🌍 Env:      ${(process.env.NODE_ENV || 'development').padEnd(23)}║`);
      console.log('╠════════════════════════════════════════╣');
      console.log('║  🤖 AI Features Active:                ║');
      console.log('║    ✅ Roboflow Vision Detection         ║');
      const groqModel = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
      const modelLabel = groqModel.length > 24 ? groqModel.slice(0, 24) : groqModel.padEnd(24);
      console.log(`║    ✅ Groq LLM (${modelLabel}) ║`);
      console.log('║    ✅ HuggingFace Fake Detector         ║');
      console.log('║    ✅ OpenWeatherMap Forecast           ║');
      console.log('║    ✅ Nominatim Geocoding               ║');
      console.log('║    ✅ Socket.io Real-time               ║');
      console.log('╚════════════════════════════════════════╝\n');
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

// ============================================================
// GRACEFUL SHUTDOWN HANDLERS
// Ensure DB connection closes cleanly on process termination
// ============================================================
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n⚡ ${signal} received – initiating graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    console.log('🛑 HTTP server closed');

    // Close MongoDB connection
    const { disconnectDB } = await import('./config/db');
    await disconnectDB();

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });

  // Force exit if shutdown takes >10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections (catch async errors not in try/catch)
process.on('unhandledRejection', (reason: unknown) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // In production, alert monitoring system before exiting
  // process.exit(1); // Uncomment to crash-and-restart in production
});

// Start the server
startServer();

export default app;

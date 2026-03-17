/**
 * =============================================================
 * src/middleware/rateLimiter.ts – Rate Limiting Middleware
 * =============================================================
 * Implements express-rate-limit 7.4 to protect API endpoints
 * from abuse, especially AI-intensive routes.
 *
 * FEATURES IMPLEMENTED:
 *  - Security requirement: 100 req/15min per IP for general routes
 *  - AI-specific limit: 20 req/15min (Roboflow, Groq are expensive)
 *  - Auth limit: 5 attempts/15min to prevent brute force login
 *  - Returns standard 429 Too Many Requests with Retry-After header
 * =============================================================
 */

import rateLimit from 'express-rate-limit';

/**
 * generalLimiter – Applied globally in index.ts
 * 100 requests per 15 minutes per IP address.
 * Standard protection against scrapers and DoS.
 */
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: 'draft-7', // Return RateLimit headers in response
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please wait 15 minutes before retrying.',
  },
  // keyGenerator: use IP + optional user ID for authenticated routes
  keyGenerator: (req) => {
    const userId = req.user?._id?.toString() || '';
    return `${req.ip}_${userId}`;
  },
  // skip: allow health check endpoint unlimited access
  skip: (req) => req.path === '/health',
});

/**
 * aiLimiter – Applied to all AI-heavy routes:
 *  POST /api/complaints/report  (Roboflow + Groq + HuggingFace)
 *  POST /api/chat               (Groq chatbot)
 *  GET  /api/admin/weekly-pdf   (Groq summarization + pdf-lib)
 *
 * 20 requests per 15 minutes per IP to protect free-tier API quotas.
 */
export const aiLimiter = rateLimit({
  windowMs: 900_000, // 15 minutes
  max: parseInt(process.env.AI_RATE_LIMIT_MAX || '20'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI request limit reached. Maximum 20 AI requests per 15 minutes. Please try again later.',
  },
});

/**
 * authLimiter – Applied to POST /api/auth/login
 * 5 login attempts per 15 minutes per IP.
 * Prevents brute-force password attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 900_000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  // skipSuccessfulRequests: don't count successful logins toward the limit
  skipSuccessfulRequests: true,
});

/**
 * workerLocationLimiter – Applied to POST /api/worker/location
 * Workers send GPS updates every 5 seconds, so we allow higher frequency.
 * 500 requests per 15 minutes (≈1 per 1.8s).
 */
export const workerLocationLimiter = rateLimit({
  windowMs: 900_000,
  max: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Location update rate limit exceeded.',
  },
});

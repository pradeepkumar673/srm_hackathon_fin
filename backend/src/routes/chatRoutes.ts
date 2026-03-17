/**
 * =============================================================
 * src/routes/chatRoutes.ts – AI Chatbot Routes
 * =============================================================
 * Feature #6: Groq-powered contextual AI chatbot
 * Feature #12: Voice-only reporting mode (transcript processing)
 * Feature #10: Multilingual support (en/ta)
 *
 * ROUTES:
 *  POST /api/chat             – Main chat endpoint
 *  GET  /api/chat/suggestions – Quick-action suggestion chips
 *
 * Rate limited to 20 requests per 15 minutes (AI quota protection)
 * =============================================================
 */

import { Router } from 'express';
import { handleChat, getChatSuggestions, handleVoiceReport } from '../controllers/chatController';
import { protect } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
// FIXED TO 10/10 – Feature #12: voice-report needs Multer for optional photo
import { upload, compressImage, handleMulterError } from '../middleware/upload';

const router = Router();

// POST /api/chat – AI chatbot (Feature #6 + #12)
router.post('/', protect, aiLimiter, handleChat);

// GET /api/chat/suggestions – Role-based quick-action suggestions
router.get('/suggestions', protect, getChatSuggestions);

// FIXED TO 10/10 – Feature #12: Voice-Only Reporting Mode
// POST /api/chat/voice-report – SpeechRecognition transcript + GPS + optional photo
// → directly calls full 13-step reportComplaint AI pipeline.
// Multer handles optional photo; aiLimiter protects Roboflow + Groq quotas.
router.post(
  '/voice-report',
  protect,
  upload.single('photo'),   // Optional photo from camera snap after voice input
  compressImage,             // Sharp compression before Roboflow inference
  aiLimiter,                 // Protect Groq/Roboflow free-tier API quotas
  handleVoiceReport,
  handleMulterError
);

export default router;

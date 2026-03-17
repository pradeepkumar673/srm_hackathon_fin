/**
 * =============================================================
 * src/routes/workerRoutes.ts – Worker Routes
 * =============================================================
 * All routes protected by: protect + authorize('worker', 'admin')
 * Admin can also access worker routes for management purposes.
 *
 * ROUTES:
 *  GET   /api/worker/assigned       – Worker's active assignments
 *  PATCH /api/worker/accept/:id     – Accept assignment (→ InProgress)
 *  POST  /api/worker/location       – REST GPS update (socket is primary)
 *  POST  /api/worker/resolve/:id    – Resolve with after-photo (Feature #8)
 *  GET   /api/worker/notifications  – Worker notification feed
 * =============================================================
 */

import { Router } from 'express';
import {
  getAssignedComplaints,
  acceptAssignment,
  updateLocation,
  resolveComplaint,
  getWorkerNotifications,
} from '../controllers/workerController';
import { protect, authorize } from '../middleware/auth';
import { upload, compressImage, handleMulterError } from '../middleware/upload';
import { aiLimiter, workerLocationLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all worker routes
router.use(protect);
router.use(authorize('worker', 'admin'));

// GET /api/worker/assigned – Active complaint assignments
router.get('/assigned', getAssignedComplaints);

// PATCH /api/worker/accept/:id – Accept assignment (→ InProgress)
router.patch('/accept/:id', acceptAssignment);

// POST /api/worker/location – REST GPS update
// Higher rate limit (500/15min) since sent every 5 seconds
router.post('/location', workerLocationLimiter, updateLocation);

// POST /api/worker/resolve/:id – Resolve with after photo + AI verification
// Multer handles afterPhoto; aiLimiter protects Groq resolution verify call
router.post(
  '/resolve/:id',
  upload.single('afterPhoto'),
  compressImage,
  aiLimiter,
  resolveComplaint,
  handleMulterError
);

// GET /api/worker/notifications – Worker notification feed
router.get('/notifications', getWorkerNotifications);

export default router;


/**
 * =============================================================
 * src/routes/chatRoutes.ts – AI Chatbot Routes
 * =============================================================
 * Feature #6: Groq chatbot + Feature #12: voice command processing
 *
 * ROUTES:
 *  POST /api/chat             – Main chat endpoint (text + voice)
 *  GET  /api/chat/suggestions – Quick-action chips for chat UI
 * =============================================================
 */

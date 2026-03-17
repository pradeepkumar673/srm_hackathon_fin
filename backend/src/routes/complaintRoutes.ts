/**
 * =============================================================
 * src/routes/complaintRoutes.ts – Complaint Routes
 * =============================================================
 * All civic complaint endpoints for citizens + public access.
 *
 * MIDDLEWARE CHAIN for POST /report:
 *   protect → upload.single('photo') → compressImage → aiLimiter → handler
 *
 * This chain ensures:
 *  1. User is authenticated
 *  2. Multer validates & stores the photo
 *  3. Sharp compresses it before AI analysis
 *  4. AI rate limit protects free-tier API quotas
 * =============================================================
 */

import { Router } from 'express';
import {
  reportComplaint,
  getMyComplaints,
  getComplaintById,
  getPublicComplaints,
  confirmComplaint,
} from '../controllers/complaintController';
import { protect, optionalAuth } from '../middleware/auth';
import { upload, compressImage, handleMulterError } from '../middleware/upload';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

// -------------------------------------------------------
// POST /api/complaints/report
// FULL 13-STEP AI PIPELINE (Feature #1-#13)
// Multipart form: title, description, category, lat, lng + photo file
// Rate limited: 20 AI requests per 15 min (aiLimiter)
// -------------------------------------------------------
router.post(
  '/report',
  protect,
  upload.single('photo'),   // Multer: validate + store photo
  compressImage,             // Sharp: resize + compress
  aiLimiter,                 // Rate limit AI API calls
  reportComplaint,
  handleMulterError          // Catch Multer-specific errors
);

// GET /api/complaints/public – Public map feed (no auth required)
router.get('/public', optionalAuth, getPublicComplaints);

// GET /api/complaints/my – Citizen's own complaint history
router.get('/my', protect, getMyComplaints);

// GET /api/complaints/:id – Single complaint detail
router.get('/:id', optionalAuth, getComplaintById);

// POST /api/complaints/:id/confirm – Community confirmation (Feature #9)
router.post('/:id/confirm', protect, confirmComplaint);

export default router;

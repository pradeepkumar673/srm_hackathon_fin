/**
 * =============================================================
 * src/routes/adminRoutes.ts – Admin-Only Routes
 * =============================================================
 * All routes protected by: protect + authorize('admin')
 *
 * ROUTES:
 *  GET  /api/admin/dashboard     – AI-ranked dashboard + Groq summary
 *  GET  /api/admin/map-data      – Heatmap + markers + live workers
 *  POST /api/admin/assign-worker – Groq smart worker assignment (Feature #5)
 *  PATCH /api/admin/complaints/:id/status – Status override
 *  GET  /api/admin/weekly-pdf    – Groq PDF generation (Feature #11)
 *  GET  /api/admin/workers       – All worker profiles
 *  GET  /api/admin/notifications – Admin notification feed
 * =============================================================
 */

import { Router } from 'express';
import {
  getDashboard,
  getMapData,
  assignWorker,
  updateComplaintStatus,
  getWeeklyPDF,
  getAllWorkers,
  getAdminNotifications,
} from '../controllers/adminController';
import { protect, authorize } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply protect + admin authorization to ALL admin routes
router.use(protect);
router.use(authorize('admin'));

// GET /api/admin/dashboard – AI-ranked complaint list + KPI cards
router.get('/dashboard', getDashboard);

// GET /api/admin/map-data – Heatmap points + complaint + worker markers
router.get('/map-data', getMapData);

// POST /api/admin/assign-worker – Groq smart assignment (Feature #5)
// Rate limited since it calls Groq API
router.post('/assign-worker', aiLimiter, assignWorker);

// PATCH /api/admin/complaints/:id/status – Status override
router.patch('/complaints/:id/status', updateComplaintStatus);

// GET /api/admin/weekly-pdf – AI PDF generation (Feature #11)
// Rate limited (calls Groq + pdf-lib)
router.get('/weekly-pdf', aiLimiter, getWeeklyPDF);

// GET /api/admin/workers – All worker profiles for assignment panel
router.get('/workers', getAllWorkers);

// GET /api/admin/notifications – Admin notification feed + anomaly alerts
router.get('/notifications', getAdminNotifications);

export default router;

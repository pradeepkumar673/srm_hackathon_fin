/**
 * =============================================================
 * src/routes/authRoutes.ts – Authentication Routes
 * =============================================================
 */

import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  getLeaderboard,
} from '../controllers/authController';
import { protect } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /api/auth/register – New user registration (citizen/admin/worker)
router.post('/register', register);

// POST /api/auth/login – Login with email/password, returns JWT
// Rate limited: 5 attempts per 15 minutes (authLimiter)
router.post('/login', authLimiter, login);

// GET /api/auth/profile – Get authenticated user profile
router.get('/profile', protect, getProfile);

// PATCH /api/auth/profile – Update name, language, location
router.patch('/profile', protect, updateProfile);

// GET /api/auth/leaderboard – Public civic points leaderboard (Feature #9)
router.get('/leaderboard', getLeaderboard);

export default router;

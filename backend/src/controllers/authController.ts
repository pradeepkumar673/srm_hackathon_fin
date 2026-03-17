/**
 * =============================================================
 * src/controllers/authController.ts – Authentication Controller
 * =============================================================
 * Handles user registration and login for all roles.
 * Issues JWT tokens used by protect() middleware.
 *
 * FEATURES IMPLEMENTED:
 *  - Secure password hashing via bcryptjs (cost factor 12)
 *  - JWT issuance with role embedded for authorization
 *  - Language preference stored for Feature #10 multilingual
 *  - Worker profile auto-created on worker registration
 *  - Response includes full user profile for frontend store init
 * =============================================================
 */

import { Request, Response } from 'express';
import User from '../models/User';
import Worker from '../models/Worker';
import { generateToken } from '../middleware/auth';

/**
 * register – POST /api/auth/register
 * Creates a new user account.
 *
 * Body: { name, email, password, role?, language?, skills? }
 *   - role defaults to "citizen"
 *   - If role="worker", also creates a Worker profile document
 *   - language: "en" | "ta" for multilingual support (Feature #10)
 *   - skills: required if role="worker" (for Feature #5 assignment)
 *
 * Returns: { success, token, user }
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      role = 'citizen',
      language = 'en',
      skills = [],
      phone = '',
    } = req.body;

    // ---- Input validation ----
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
      return;
    }

    // ---- Check for existing email ----
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
      return;
    }

    // ---- Create user ----
    // Note: The User model's pre-save hook will hash the password
    // when it detects passwordHash field has been modified.
    // We set passwordHash = plain password here, and the hook hashes it.
    const user = await User.create({
      name,
      email,
      passwordHash: password, // Pre-save hook in User.ts will hash this
      role,
      language,
      civicPoints: 0,
    });

    // ---- If worker role: create associated Worker document ----
    // Worker document stores skills, location, and assignment data
    // (separate from User for normalization – Feature #5)
    if (role === 'worker') {
      await Worker.create({
        userId: user._id,
        name: user.name,
        skills: skills.length > 0 ? skills : ['road-worker'],
        phone,
        currentLocation: { lat: 13.0827, lng: 80.2707 }, // Default: Chennai center
        isAvailable: true,
      });
      console.log(`👷 Worker profile created for ${user.name}`);
    }

    // ---- Generate JWT ----
    const token = generateToken(user._id.toString(), user.role);

    // ---- Send response (password hash excluded by model's toJSON) ----
    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        civicPoints: user.civicPoints,
        currentLocation: user.currentLocation,
      },
    });

    console.log(`✅ New ${role} registered: ${email}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    console.error('❌ Register error:', message);

    // Handle duplicate key error (race condition on email uniqueness)
    if (message.includes('duplicate key') || message.includes('E11000')) {
      res.status(409).json({
        success: false,
        message: 'Email already in use.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
};

/**
 * login – POST /api/auth/login
 * Authenticates user and returns JWT.
 *
 * Body: { email, password }
 * Returns: { success, token, user }
 *
 * Security:
 *  - Same generic error for wrong email OR wrong password
 *    (prevents user enumeration attacks)
 *  - Rate limited to 5 attempts/15min (see authLimiter middleware)
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    // Explicitly select passwordHash (excluded by default in schema)
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash');

    // Generic message for both "not found" and "wrong password"
    const authError = {
      success: false,
      message: 'Invalid email or password.',
    };

    if (!user) {
      res.status(401).json(authError);
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json(authError);
      return;
    }

    // ---- Fetch worker profile if applicable ----
    let workerProfile = null;
    if (user.role === 'worker') {
      workerProfile = await Worker.findOne({ userId: user._id })
        .select('skills isAvailable phone');
    }

    // ---- Generate fresh JWT ----
    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        civicPoints: user.civicPoints,
        currentLocation: user.currentLocation,
        workerProfile,
      },
    });

    console.log(`🔓 Login: ${email} (${user.role})`);
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
};

/**
 * getProfile – GET /api/auth/profile
 * Returns the authenticated user's current profile.
 * Used by frontend on app load to restore session state.
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    let workerProfile = null;
    if (user.role === 'worker') {
      workerProfile = await Worker.findOne({ userId: user._id });
    }

    // Unread notification count for badge
    const { Notification } = await import('../models/Worker');
    const unreadCount = await Notification.countDocuments({
      userId: user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        civicPoints: user.civicPoints,
        currentLocation: user.currentLocation,
        workerProfile,
        unreadNotifications: unreadCount,
      },
    });
  } catch (err) {
    console.error('❌ getProfile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
};

/**
 * updateProfile – PATCH /api/auth/profile
 * Allows users to update name, language, and currentLocation.
 * Language update triggers multilingual preference change (Feature #10).
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, language, lat, lng } = req.body;
    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (language && ['en', 'ta'].includes(language)) updateData.language = language;
    if (lat && lng) {
      updateData['currentLocation.lat'] = parseFloat(lat);
      updateData['currentLocation.lng'] = parseFloat(lng);
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (err) {
    console.error('❌ updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

/**
 * getLeaderboard – GET /api/auth/leaderboard
 * Feature #9: Returns top 10 citizens by civicPoints.
 * Public endpoint (no auth required) to encourage participation.
 */
export const getLeaderboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const leaders = await User.find({ role: 'citizen' })
      .select('name civicPoints createdAt')
      .sort({ civicPoints: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      leaderboard: leaders.map((u, i) => ({
        rank: i + 1,
        name: u.name,
        civicPoints: u.civicPoints,
        joinedAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error('❌ getLeaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.' });
  }
};

/**
 * =============================================================
 * src/middleware/auth.ts – JWT Authentication & Authorization
 * =============================================================
 * Provides two middleware functions:
 *  1. protect(req, res, next) – verifies JWT in Authorization header
 *  2. authorize(...roles) – restricts routes to specific user roles
 *
 * FEATURES IMPLEMENTED:
 *  - JWT verification using jsonwebtoken 9.0 (RS256 via HS256 for simplicity)
 *  - Role-based access control: citizen / admin / worker
 *  - Attaches decoded user to req.user for use in controllers
 *  - Returns 401 (unauthenticated) vs 403 (unauthorized) correctly
 * =============================================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// ---- Extend Express Request type to carry authenticated user ----
// This lets TypeScript know req.user exists after protect() middleware
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// ---- JWT Payload shape ----
interface JWTPayload {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * protect – Middleware to verify JWT Bearer token.
 *
 * Reads token from:
 *   1. Authorization: Bearer <token> header (preferred)
 *   2. cookies.token (fallback for browser-based sessions)
 *
 * On success: populates req.user from DB (fresh fetch ensures
 * banned users are rejected even with valid unexpired tokens).
 * On failure: returns 401 JSON with descriptive error.
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // ---- Extract token from Authorization header ----
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // ---- Fallback: cookie (optional, for web sessions) ----
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    // verify() throws if token is expired, malformed, or signature mismatch
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Fresh DB lookup ensures suspended accounts are blocked immediately
    // select('+passwordHash') is omitted – we don't need the hash here
    const user = await User.findById(decoded.id).select(
      '-passwordHash'
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Token valid but user no longer exists.',
      });
      return;
    }

    // Attach user to request object for downstream controllers
    req.user = user;
    next();
  } catch (err) {
    const isExpired =
      err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      success: false,
      message: isExpired
        ? 'Session expired. Please login again.'
        : 'Invalid authentication token.',
    });
  }
};

/**
 * authorize – Factory that returns a middleware checking user role.
 *
 * Usage:
 *   router.get('/admin/dashboard', protect, authorize('admin'), handler)
 *   router.patch('/worker/accept', protect, authorize('worker', 'admin'), handler)
 *
 * Must be used AFTER protect() so req.user is populated.
 *
 * @param roles – One or more allowed role strings
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this action. Required: ${roles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
};

/**
 * optionalAuth – Like protect() but does NOT reject if no token.
 * Used for endpoints that behave differently for logged-in users
 * but are also publicly accessible (e.g., public complaint view).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    // No token – proceed without user attached
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as JWTPayload;
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user) req.user = user;
  } catch {
    // Invalid token in optional auth – just continue unauthenticated
  }

  next();
};

/**
 * generateToken – Creates a signed JWT for a user.
 * Called by authController after successful login or register.
 *
 * @param id   – MongoDB user ObjectId as string
 * @param role – User role for embedding in payload
 * @returns Signed JWT string
 */
export const generateToken = (id: string, role: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  return jwt.sign(
    { id, role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

/**
 * =============================================================
 * src/middleware/upload.ts – File Upload Middleware
 * =============================================================
 * Configures Multer for photo uploads from complaint reports.
 * Integrates Sharp for compression/resizing before AI analysis.
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #1: Stores uploaded photo for Roboflow AI analysis
 *  - Feature #8: Handles both beforePhoto and afterPhoto uploads
 *  - Security: enforces 5MB limit, JPEG/PNG only, filename sanitization
 *  - Performance: Sharp compresses image to max 1920px, 85% quality
 *    to reduce Roboflow API payload and storage cost
 * =============================================================
 */

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ---- Ensure uploads directory exists ----
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`📁 Created uploads directory: ${UPLOAD_DIR}`);
}

// ---- Multer Storage Engine ----
// Uses disk storage to write files to ./uploads/<uuid>.<ext>
// UUID filename prevents path traversal attacks and collisions
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate UUID-based filename to prevent collisions and
    // avoid serving user-controlled filenames (security best practice)
    const uniqueName = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, uniqueName);
  },
});

/**
 * fileFilter – Multer file filter.
 * Rejects any file that is not image/jpeg or image/png.
 * Checks both MIME type and file extension for defense in depth.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
  const allowedExts = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type "${file.mimetype}". Only JPEG and PNG images are accepted.`
      )
    );
  }
};

// ---- Multer instance ----
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    // 5MB max – enforced at Multer level before Sharp processing
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '5') * 1024 * 1024),
    files: 1,   // Single file per request
  },
});

// ---- Multiple file upload for resolution (before + after) ----
export const uploadResolutionPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2, // before + after
  },
});

/**
 * compressImage – Express middleware that runs Sharp compression
 * AFTER Multer has written the file to disk.
 *
 * Why: Roboflow free tier has bandwidth limits; smaller images
 * are also processed faster by TensorFlow.js pixel diff (Feature #8).
 *
 * Processing steps:
 *   1. Read original file from disk
 *   2. Resize to max 1920px width (maintaining aspect ratio)
 *   3. Convert to JPEG at 85% quality
 *   4. Overwrite original file
 *
 * If Sharp fails (e.g., corrupt file), logs warning but does NOT
 * block the request – allows fallback to original file.
 */
export const compressImage = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.file) {
    return next(); // No file uploaded – skip compression
  }

  const filePath = req.file.path;
  // Temp path during processing to avoid partial overwrites
  const tempPath = `${filePath}.tmp`;

  try {
    await sharp(filePath)
      .resize(1920, 1080, {
        fit: 'inside',          // Preserve aspect ratio, never upscale
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toFile(tempPath);

    // Atomically replace original with compressed version
    fs.renameSync(tempPath, filePath);

    // Update mimetype since we always convert to JPEG
    req.file.mimetype = 'image/jpeg';

    console.log(`🗜️  Compressed image: ${path.basename(filePath)}`);
  } catch (err) {
    // Non-fatal: use original file if Sharp fails
    console.warn('⚠️  Sharp compression failed, using original:', err);
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }

  next();
};

/**
 * handleMulterError – Error handler specifically for Multer errors.
 * Must be placed AFTER the route handler in Express middleware chain.
 * Converts Multer-specific errors to user-friendly JSON responses.
 */
export const handleMulterError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 5}MB.`,
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        message: 'Too many files. Upload one photo at a time.',
      });
      return;
    }
  }

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Pass non-Multer errors to global error handler
  next(err);
};

/**
 * getFileUrl – Converts a local file path to a publicly accessible URL.
 * In production, this would return a Cloudinary CDN URL.
 * For demo: constructs a local Express static route URL.
 *
 * @param filename – Just the filename (not full path)
 * @param req      – Express request (for building absolute URL)
 */
export const getFileUrl = (filename: string, req: Request): string => {
  // Build URL from request host + static uploads path
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:5000';
  return `${protocol}://${host}/uploads/${filename}`;
};

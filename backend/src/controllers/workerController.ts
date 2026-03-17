/**
 * =============================================================
 * src/controllers/workerController.ts – Worker Controller
 * =============================================================
 * Manages field worker operations:
 *  - View assigned complaints
 *  - Accept/start an assigned task
 *  - Update real-time location (REST fallback for Feature #7)
 *  - Resolve complaint with after-photo + AI verification (Feature #8)
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #7: updateLocation stores GPS in DB + broadcasts via socket
 *  - Feature #8: resolveComplaint calls Groq to compare before/after photos
 *  - emitResolutionVerified broadcasts result to citizen + admin map
 * =============================================================
 */

import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import Worker from '../models/Worker';
import User from '../models/User';
import { Notification } from '../models/Worker';
import {
  callGroqResolutionVerify,
} from '../utils/aiUtils';
import { emitStatusUpdate, emitResolutionVerified } from '../sockets/socketHandler';
import { Server as SocketServer } from 'socket.io';
import { getFileUrl } from '../middleware/upload';

let io: SocketServer;
export const setWorkerSocketIO = (socketIO: SocketServer): void => {
  io = socketIO;
};

// ==============================================================
// GET /api/worker/assigned
// Returns all complaints currently assigned to this worker
// ==============================================================

/**
 * getAssignedComplaints – Fetches the worker's active assignment queue.
 * Sorted by severity (highest first) to prioritize urgent tasks.
 *
 * Returns full complaint details including:
 *  - GPS location for navigation
 *  - AI severity score and description
 *  - Status (Assigned → InProgress → Resolved)
 */
export const getAssignedComplaints = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Find the Worker document linked to this user
    const worker = await Worker.findOne({ userId: req.user!._id });

    if (!worker) {
      res.status(404).json({
        success: false,
        message: 'Worker profile not found. Please contact admin.',
      });
      return;
    }

    // Fetch complaints assigned to this worker (not yet resolved)
    const complaints = await Complaint.find({
      workerId: worker._id,
      status: { $in: ['Assigned', 'InProgress'] },
    })
      .sort({ severityScore: -1, createdAt: 1 })
      .populate('reportedBy', 'name email')
      .lean();

    res.status(200).json({
      success: true,
      worker: {
        id: worker._id,
        name: worker.name,
        skills: worker.skills,
        isAvailable: worker.isAvailable,
      },
      assignedComplaints: complaints.map((c) => ({
        id: c._id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        severity: c.severityScore,
        location: c.location,
        photoUrl: c.photoUrl,
        aiDescription: c.aiAnalysis?.description,
        reportedBy: c.reportedBy,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error('❌ getAssignedComplaints error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments.' });
  }
};

// ==============================================================
// PATCH /api/worker/accept/:id
// Worker accepts assignment → status changes to InProgress
// ==============================================================

/**
 * acceptAssignment – Worker confirms they are en-route to the complaint.
 * Changes status from "Assigned" to "InProgress".
 * Starts real-time ETA broadcasting on admin map.
 */
export const acceptAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const worker = await Worker.findOne({ userId: req.user!._id });
    if (!worker) {
      res.status(404).json({ success: false, message: 'Worker profile not found.' });
      return;
    }

    const complaint = await Complaint.findOne({
      _id: req.params.id,
      workerId: worker._id,
      status: 'Assigned',
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Assignment not found or already started.',
      });
      return;
    }

    // Update status to InProgress
    complaint.status = 'InProgress';
    await complaint.save();

    // ---- Emit status update to citizen + admin (Feature #7) ----
    if (io) {
      emitStatusUpdate(
        io,
        complaint._id.toString(),
        'InProgress',
        complaint.reportedBy.toString(),
        `Worker ${worker.name} has accepted your complaint and is en-route!`
      );
    }

    // Save notification for citizen
    await Notification.create({
      userId: complaint.reportedBy,
      message: `Worker ${worker.name} is on the way to resolve: "${complaint.title}"`,
      type: 'status-update',
      complaintId: complaint._id,
    });

    res.status(200).json({
      success: true,
      message: 'Assignment accepted. Status updated to InProgress.',
      complaint: {
        id: complaint._id,
        status: complaint.status,
        location: complaint.location,
      },
    });
  } catch (err) {
    console.error('❌ acceptAssignment error:', err);
    res.status(500).json({ success: false, message: 'Failed to accept assignment.' });
  }
};

// ==============================================================
// POST /api/worker/location
// Feature #7: REST endpoint for worker GPS update
// (Socket.io "worker-location" event is the primary method)
// ==============================================================

/**
 * updateLocation – Updates worker's GPS coordinates in DB.
 * Also used as a fallback when WebSocket connection is unavailable.
 * The Socket.io handler (socketHandler.ts) is the preferred realtime path.
 *
 * Body: { lat, lng, complaintId? }
 */
export const updateLocation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      res.status(400).json({ success: false, message: 'lat and lng are required.' });
      return;
    }

    const worker = await Worker.findOneAndUpdate(
      { userId: req.user!._id },
      {
        'currentLocation.lat': parseFloat(lat),
        'currentLocation.lng': parseFloat(lng),
        lastLocationUpdate: new Date(),
      },
      { new: true }
    );

    if (!worker) {
      res.status(404).json({ success: false, message: 'Worker profile not found.' });
      return;
    }

    // Also update User.currentLocation for proximity queries
    await User.findByIdAndUpdate(req.user!._id, {
      'currentLocation.lat': parseFloat(lat),
      'currentLocation.lng': parseFloat(lng),
    });

    res.status(200).json({
      success: true,
      message: 'Location updated.',
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
  } catch (err) {
    console.error('❌ updateLocation error:', err);
    res.status(500).json({ success: false, message: 'Failed to update location.' });
  }
};

// ==============================================================
// POST /api/worker/resolve/:id
// Feature #8: Resolve complaint with after-photo + AI verification
// ==============================================================

/**
 * resolveComplaint – Worker marks issue as resolved by uploading
 * an "after" photo. AI pipeline compares before/after:
 *  1. Multer handles afterPhoto upload
 *  2. Groq compares beforePhotoUrl + afterPhotoUrl (Feature #8)
 *     Receives percentage fixed + verification status + suggestion
 *  3. Updates complaint status to Resolved
 *  4. Emits "resolution-verified" WebSocket event (Feature #8)
 *  5. Removes complaint from worker's assignedComplaints array
 *
 * Body (multipart/form-data):
 *   notes (optional resolution notes)
 * File: afterPhoto
 */
export const resolveComplaint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const worker = await Worker.findOne({ userId: req.user!._id });
    if (!worker) {
      res.status(404).json({ success: false, message: 'Worker profile not found.' });
      return;
    }

    const complaint = await Complaint.findOne({
      _id: req.params.id,
      workerId: worker._id,
      status: { $in: ['Assigned', 'InProgress'] },
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found or not assigned to you.',
      });
      return;
    }

    // After photo is required for AI verification
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'After-photo is required to verify resolution.',
      });
      return;
    }

    const afterPhotoUrl = getFileUrl(req.file.filename, req);
    const { notes = '' } = req.body;

    // ---- AI Resolution Verification (Feature #8) ----
    // Groq compares before and after photo URLs
    // pixelDiffScore can be sent from frontend TensorFlow.js analysis
    const pixelDiffScore = req.body.pixelDiffScore
      ? parseFloat(req.body.pixelDiffScore)
      : undefined;

    console.log(`🔍 Running AI resolution verification for complaint ${complaint._id}...`);
    const verificationResult = await callGroqResolutionVerify(
      complaint.beforePhotoUrl,
      afterPhotoUrl,
      complaint.category,
      pixelDiffScore
    );

    console.log(
      `✅ Verification result: ${verificationResult.fixedPercentage}% fixed, verified=${verificationResult.verified}`
    );

    // ---- Update complaint to Resolved ----
    complaint.status = 'Resolved';
    complaint.afterPhotoUrl = afterPhotoUrl;
    await complaint.save();

    // ---- Remove complaint from worker's active queue ----
    await Worker.findByIdAndUpdate(worker._id, {
      $pull: { assignedComplaints: complaint._id },
    });

    // ---- Emit resolution verification result (Feature #8) ----
    if (io) {
      emitResolutionVerified(
        io,
        complaint._id.toString(),
        verificationResult,
        complaint.reportedBy.toString()
      );
    }

    // ---- Notifications ----
    // Notify the citizen who reported
    await Notification.create({
      userId: complaint.reportedBy,
      message: verificationResult.verified
        ? `Great news! Your complaint "${complaint.title}" has been resolved (${verificationResult.fixedPercentage}% fixed). Thank you for reporting!`
        : `Your complaint "${complaint.title}" has been addressed. Suggestion: ${verificationResult.suggestion}`,
      type: 'resolution',
      complaintId: complaint._id,
    });

    // Award the reporting citizen additional civic points for verified resolution
    if (verificationResult.verified) {
      await User.findByIdAndUpdate(complaint.reportedBy, {
        $inc: { civicPoints: 30 },
      });
    }

    res.status(200).json({
      success: true,
      message: verificationResult.verified
        ? '🎉 Complaint resolved and AI-verified successfully!'
        : `Complaint marked as resolved. ${verificationResult.suggestion}`,
      resolution: {
        complaintId: complaint._id,
        status: 'Resolved',
        afterPhotoUrl,
        aiVerification: verificationResult,
        notes,
      },
    });
  } catch (err) {
    console.error('❌ resolveComplaint error:', err);
    res.status(500).json({ success: false, message: 'Failed to resolve complaint.' });
  }
};

// ==============================================================
// GET /api/worker/notifications
// ==============================================================

export const getWorkerNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const workerUser = req.user!;
    const notifications = await Notification.find({ userId: workerUser._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Mark all as read
    await Notification.updateMany(
      { userId: workerUser._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ success: true, notifications });
  } catch (err) {
    console.error('❌ getWorkerNotifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

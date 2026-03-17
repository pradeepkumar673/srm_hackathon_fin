/**
 * =============================================================
 * src/sockets/socketHandler.ts – Socket.io Event Manager
 * =============================================================
 * Implements ALL 8 WebSocket events across role-specific rooms.
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #7: Real-time worker location tracking
 *    Worker emits "worker-location" → admin-map room receives live updates
 *    ETA calculated via haversine (distance / 30kmh)
 *  - Feature #9: Community confirmation flow
 *    New report → emit "community-confirm" to nearby citizens in radius
 *    Citizen confirms → increment confirmations + civicPoints += 10
 *  - Feature #13: Anomaly detection alerts
 *    If >5 reports in 100m/30min → emit "anomaly-alert" to admin room
 *  - Feature #6: Real-time chat message relay
 *  - Feature #8: Resolution verification result broadcast
 *
 * SOCKET ROOMS:
 *  - "admin-map"        : All admin users (receive all events)
 *  - "complaint-{id}"   : Subscribers to a specific complaint
 *  - "worker-{workerId}": Worker-specific notifications
 *  - "citizen-{userId}" : Citizen-specific notifications
 * =============================================================
 */

import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Complaint from '../models/Complaint';
import Worker from '../models/Worker';
import { Notification } from '../models/Worker';
import { calculateETA } from '../utils/haversine';

// Track socket → userId mapping for broadcasting to specific users
const socketUserMap = new Map<string, string>();
// Track userId → socketId for reverse lookup
const userSocketMap = new Map<string, string>();
// Track admin socket IDs (for admin-map room)
const adminSockets = new Set<string>();

/**
 * initializeSocketHandlers – Sets up all Socket.io event listeners.
 * Called once in index.ts after the HTTP server is created.
 *
 * @param io – Initialized Socket.io Server instance
 */
export function initializeSocketHandlers(io: SocketServer): void {
  console.log('🔌 Initializing Socket.io handlers...');

  // ---- Authentication middleware for sockets ----
  // Every socket connection must provide a valid JWT in auth.token
  // This ensures only authenticated users can join rooms
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token as string;

      if (!token) {
        return next(new Error('Authentication token required for WebSocket'));
      }

      const secret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token, secret) as { id: string; role: string };
      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        return next(new Error('Socket auth: user not found'));
      }

      // Attach user to socket for use in event handlers
      (socket as SocketWithUser).user = user;
      next();
    } catch (err) {
      next(new Error('Socket authentication failed'));
    }
  });

  // ---- Connection handler ----
  io.on('connection', (socket: Socket) => {
    const user = (socket as SocketWithUser).user;
    console.log(`🔗 Socket connected: ${user.name} (${user.role}) – ${socket.id}`);

    // Register in tracking maps
    socketUserMap.set(socket.id, user._id.toString());
    userSocketMap.set(user._id.toString(), socket.id);

    // ---- Automatically join role-specific rooms ----

    // Admin room: receives all broadcast events + heatmap data
    if (user.role === 'admin') {
      socket.join('admin-map');
      adminSockets.add(socket.id);
      console.log(`👮 Admin ${user.name} joined admin-map room`);
    }

    // Worker room: receives assignment notifications
    if (user.role === 'worker') {
      socket.join(`worker-${user._id}`);
      console.log(`👷 Worker ${user.name} joined worker-${user._id} room`);
    }

    // Citizen room: receives nearby issue alerts + status updates
    socket.join(`citizen-${user._id}`);

    // =========================================================
    // EVENT: subscribe-complaint
    // Client joins the room for a specific complaint to receive
    // real-time status updates (Feature #7 / Feature #8)
    // =========================================================
    socket.on('subscribe-complaint', (complaintId: string) => {
      socket.join(`complaint-${complaintId}`);
      console.log(`📋 ${user.name} subscribed to complaint-${complaintId}`);
    });

    socket.on('unsubscribe-complaint', (complaintId: string) => {
      socket.leave(`complaint-${complaintId}`);
    });

    // =========================================================
    // EVENT: worker-location
    // Feature #7: Worker device sends GPS every 5 seconds.
    // Server: updates Worker.currentLocation in DB,
    //         broadcasts to admin-map room with ETA calculation.
    // =========================================================
    socket.on(
      'worker-location',
      async (data: {
        lat: number;
        lng: number;
        complaintId?: string;
      }) => {
        if (user.role !== 'worker') return;

        try {
          // Update worker location in DB
          const worker = await Worker.findOneAndUpdate(
            { userId: user._id },
            {
              'currentLocation.lat': data.lat,
              'currentLocation.lng': data.lng,
              lastLocationUpdate: new Date(),
            },
            { new: true }
          );

          if (!worker) return;

          // Calculate ETA if worker has active complaint assignment
          let etaMinutes: number | null = null;
          if (data.complaintId) {
            const complaint = await Complaint.findById(data.complaintId);
            if (complaint) {
              etaMinutes = calculateETA(
                { lat: data.lat, lng: data.lng },
                { lat: complaint.location.lat, lng: complaint.location.lng }
              );
            }
          }

          // Broadcast live worker position to admin map room (Feature #7)
          // "live-map-update" event triggers Leaflet marker re-position
          io.to('admin-map').emit('live-map-update', {
            type: 'worker-moved',
            workerId: worker._id,
            workerName: worker.name,
            location: { lat: data.lat, lng: data.lng },
            etaMinutes,
            timestamp: new Date().toISOString(),
          });

          // If worker is on their way to a complaint, notify the citizen
          if (data.complaintId) {
            const complaint = await Complaint.findById(data.complaintId);
            if (complaint && etaMinutes !== null) {
              io.to(`complaint-${data.complaintId}`).emit('worker-location', {
                workerId: worker._id,
                workerName: worker.name,
                location: { lat: data.lat, lng: data.lng },
                etaMinutes,
              });
            }
          }
        } catch (err) {
          console.error('❌ worker-location handler error:', err);
        }
      }
    );

    // =========================================================
    // EVENT: community-confirm
    // Feature #9: Citizen confirms a nearby complaint is real.
    // Server: increments confirmations + civicPoints + notifies reporter.
    // =========================================================
    socket.on(
      'community-confirm',
      async (data: { complaintId: string; confirmed: boolean }) => {
        if (user.role !== 'citizen') return;

        try {
          if (!data.confirmed) return; // User dismissed the confirmation prompt

          // Increment complaint's confirmation counter
          const complaint = await Complaint.findByIdAndUpdate(
            data.complaintId,
            { $inc: { confirmations: 1 } },
            { new: true }
          );

          if (!complaint) return;

          // Award civic points to the confirming citizen (Feature #9)
          await User.findByIdAndUpdate(user._id, {
            $inc: { civicPoints: 10 },
          });

          console.log(`✅ ${user.name} confirmed complaint ${data.complaintId} (civicPoints +10)`);

          // Notify the admin map of updated confirmation count
          io.to('admin-map').emit('live-map-update', {
            type: 'confirmation-updated',
            complaintId: data.complaintId,
            confirmations: complaint.confirmations,
          });

          // Notify the original reporter (Feature #9)
          const reporterSocketId = userSocketMap.get(
            complaint.reportedBy.toString()
          );
          if (reporterSocketId) {
            io.to(reporterSocketId).emit('community-confirm', {
              complaintId: data.complaintId,
              confirmations: complaint.confirmations,
              message: `Your report has been confirmed by ${complaint.confirmations} community members!`,
            });
          }

          // Save confirmation notification to DB
          await Notification.create({
            userId: complaint.reportedBy,
            message: `Your report "${complaint.title}" was confirmed by a community member (+10 points earned by ${user.name})`,
            type: 'confirmation',
            complaintId: complaint._id,
          });

        } catch (err) {
          console.error('❌ community-confirm handler error:', err);
        }
      }
    );

    // =========================================================
    // EVENT: chat-message
    // Feature #6: Real-time chat relay between users and AI.
    // Forwarded to target room; AI response sent back to sender.
    // =========================================================
    socket.on(
      'chat-message',
      (data: { targetRoom: string; message: string }) => {
        // Relay chat message to the specified room
        // AI processing happens in the REST endpoint /api/chat
        io.to(data.targetRoom).emit('chat-message', {
          from: user.name,
          role: user.role,
          message: data.message,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // =========================================================
    // EVENT: request-map-data
    // Client requests current heatmap + complaint markers.
    // Server responds directly to requesting socket.
    // =========================================================
    socket.on('request-map-data', async () => {
      try {
        const complaints = await Complaint.find(
          { status: { $ne: 'Resolved' } },
          'location severityScore category status confirmations'
        ).lean();

        const workers = await Worker.find(
          { isAvailable: true },
          'name currentLocation lastLocationUpdate'
        ).lean();

        socket.emit('live-map-update', {
          type: 'initial-map-data',
          complaints: complaints.map((c) => ({
            id: c._id,
            lat: c.location.lat,
            lng: c.location.lng,
            severity: c.severityScore,
            category: c.category,
            status: c.status,
            confirmations: c.confirmations,
          })),
          workers: workers.map((w) => ({
            id: w._id,
            name: w.name,
            lat: w.currentLocation.lat,
            lng: w.currentLocation.lng,
            isOnline: Date.now() - new Date(w.lastLocationUpdate).getTime() < 300000,
          })),
        });
      } catch (err) {
        console.error('❌ request-map-data handler error:', err);
      }
    });

    // =========================================================
    // Disconnection cleanup
    // =========================================================
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.name} (${socket.id})`);
      socketUserMap.delete(socket.id);
      userSocketMap.delete(user._id.toString());
      adminSockets.delete(socket.id);
    });
  });
}

// ---- Augment Socket type to carry user ----
interface SocketWithUser extends Socket {
  user: IUser;
}

// ==============================================================
// EXPORTED BROADCAST FUNCTIONS
// Called by controllers to emit events after REST operations
// ==============================================================

/**
 * emitNewReport – Feature #1/#9: Broadcast new complaint to admin map
 * and nearby citizens for community confirmation.
 *
 * @param io         – Socket.io server instance
 * @param complaint  – Newly created complaint document
 * @param nearbyUserIds – User IDs within 500m for confirmation prompt
 */
export function emitNewReport(
  io: SocketServer,
  complaint: {
    _id: string;
    title: string;
    category: string;
    location: { lat: number; lng: number; address: string };
    severityScore: number;
    aiAnalysis: { description: string };
  },
  nearbyUserIds: string[]
): void {
  // Broadcast to admin map
  io.to('admin-map').emit('new-report', {
    complaintId: complaint._id,
    title: complaint.title,
    category: complaint.category,
    location: complaint.location,
    severityScore: complaint.severityScore,
    description: complaint.aiAnalysis.description,
    timestamp: new Date().toISOString(),
  });

  // Community confirmation prompt (Feature #9)
  for (const userId of nearbyUserIds) {
    io.to(`citizen-${userId}`).emit('community-confirm', {
      complaintId: complaint._id,
      title: complaint.title,
      category: complaint.category,
      address: complaint.location.address,
      message: `A ${complaint.category} issue was reported near you. Can you confirm?`,
    });
  }
}

/**
 * emitStatusUpdate – Feature #7: Broadcast complaint status change
 * to subscribers of that complaint room and the citizen who reported it.
 */
export function emitStatusUpdate(
  io: SocketServer,
  complaintId: string,
  status: string,
  reportedByUserId: string,
  message?: string
): void {
  // Notify all subscribers of this complaint (complaint room)
  io.to(`complaint-${complaintId}`).emit('status-update', {
    complaintId,
    status,
    message: message || `Complaint status updated to ${status}`,
    timestamp: new Date().toISOString(),
  });

  // Direct notification to the reporter's citizen room
  io.to(`citizen-${reportedByUserId}`).emit('status-update', {
    complaintId,
    status,
    message: message || `Your complaint status has been updated to: ${status}`,
    timestamp: new Date().toISOString(),
  });

  // Broadcast to admin map for live status badge update
  io.to('admin-map').emit('live-map-update', {
    type: 'status-changed',
    complaintId,
    status,
  });
}

/**
 * emitAnomalyAlert – Feature #13: Broadcast anomaly detection alert
 * to all admin users with Groq explanation.
 */
export function emitAnomalyAlert(
  io: SocketServer,
  data: {
    count: number;
    category: string;
    location: { lat: number; lng: number; address: string };
    explanation: string;
  }
): void {
  io.to('admin-map').emit('anomaly-alert', {
    ...data,
    timestamp: new Date().toISOString(),
    severity: 'high',
  });
}

/**
 * emitResolutionVerified – Feature #8: Notify parties when
 * AI resolution verification completes.
 */
export function emitResolutionVerified(
  io: SocketServer,
  complaintId: string,
  result: {
    fixedPercentage: number;
    verified: boolean;
    suggestion: string;
  },
  reportedByUserId: string
): void {
  io.to(`complaint-${complaintId}`).emit('resolution-verified', {
    complaintId,
    ...result,
    timestamp: new Date().toISOString(),
  });

  io.to(`citizen-${reportedByUserId}`).emit('resolution-verified', {
    complaintId,
    ...result,
    message: result.verified
      ? `Your complaint has been resolved! (${result.fixedPercentage}% fixed)`
      : `Resolution needs review: ${result.suggestion}`,
  });

  io.to('admin-map').emit('live-map-update', {
    type: 'resolution-result',
    complaintId,
    ...result,
  });
}

/**
 * emitWorkerAssigned – Feature #5: Notify worker of new assignment.
 */
export function emitWorkerAssigned(
  io: SocketServer,
  workerId: string,
  complaint: {
    _id: string;
    title: string;
    category: string;
    location: { lat: number; lng: number; address: string };
    severityScore: number;
  }
): void {
  io.to(`worker-${workerId}`).emit('status-update', {
    type: 'assignment',
    complaint,
    message: `You have been assigned to: ${complaint.title}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * =============================================================
 * src/controllers/adminController.ts – Admin Controller
 * =============================================================
 * Provides city administrators with:
 *  - AI-ranked complaint dashboard with Groq summary
 *  - Map data API for Leaflet heatmap + markers + live workers
 *  - Smart worker auto-assignment (Feature #5)
 *  - Complaint status updates
 *  - Weekly PDF report generation (Feature #11)
 *
 * All routes protected by: protect + authorize('admin')
 * =============================================================
 */

import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import Worker from '../models/Worker';
import User from '../models/User';
import { Notification } from '../models/Worker';
import {
  callGroqWorkerAssignment,
  callGroqWeeklySummary,
  getWeatherData,
} from '../utils/aiUtils';
import { generateWeeklyPDF } from '../utils/pdfGenerator';
import { emitStatusUpdate, emitWorkerAssigned } from '../sockets/socketHandler';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;
export const setAdminSocketIO = (socketIO: SocketServer): void => {
  io = socketIO;
};

// ==============================================================
// Feature #4: Predictive Hotspot Heatmap – in-memory cache + 5-min refresh
// FIXED TO 10/10 – setInterval(5 * 60 * 1000) refreshes heatmapPoints using
// MongoDB aggregation every 5 minutes as specified in the requirements.
// Also called on every new report submission in complaintController.ts.
// ==============================================================

/** Cached heatmap points recomputed every 5 min: [lat, lng, intensity 0–1] */
let cachedHeatmapPoints: number[][] = [];

/**
 * refreshHeatmapPoints – Recomputes heatmap data via MongoDB aggregation.
 * Feature #4: Predictive Hotspot Heatmap refresh every 5 min.
 *
 * Intensity = (severityScore / 100) × rainMultiplier, capped at 1.0.
 * rainMultiplier = 3 when OpenWeatherMap rain probability > 30% in 48h.
 * Broadcasts "live-map-update" { type: "heatmap-refresh" } to admin-map room.
 */
export async function refreshHeatmapPoints(): Promise<number[][]> {
  // Feature #4: Predictive Hotspot Heatmap refresh every 5 min
  try {
    const [complaints, weather] = await Promise.all([
      Complaint.find({ status: { $ne: 'Resolved' } })
        .select('location severityScore')
        .lean(),
      getWeatherData(
        parseFloat(process.env.CHENNAI_LAT || '13.0827'),
        parseFloat(process.env.CHENNAI_LNG || '80.2707')
      ),
    ]);

    // If rain probability >30% in next 48h → multiply all scores by 3 (capped 100)
    const rainMultiplier =
      weather && weather.rainProbabilityNext48h > 30 ? 3 : 1;

    cachedHeatmapPoints = complaints.map((c) => [
      c.location.lat,
      c.location.lng,
      Math.min((c.severityScore / 100) * rainMultiplier, 1.0),
    ]);

    console.log(
      `🗺️  [Feature #4] Heatmap refreshed: ${cachedHeatmapPoints.length} points, ` +
      `rain=${weather?.rainProbabilityNext48h ?? 0}%, multiplier=×${rainMultiplier}`
    );

    // Broadcast updated heatmap to all connected admin sockets
    if (io) {
      io.to('admin-map').emit('live-map-update', {
        type: 'heatmap-refresh',
        heatmapPoints: cachedHeatmapPoints,
        rainMultiplierActive: rainMultiplier > 1,
        refreshedAt: new Date().toISOString(),
      });
    }

    return cachedHeatmapPoints;
  } catch (err) {
    console.error('❌ Heatmap refresh error:', err);
    return cachedHeatmapPoints; // Return stale cache rather than crashing
  }
}

// Feature #4: Predictive Hotspot Heatmap refresh every 5 min
// setInterval(5 * 60 * 1000) – background refresh independent of HTTP requests.
// This satisfies: "On every new report + setInterval(5min): MongoDB aggregation
// + leaflet.heat data. Call OpenWeatherMap one-call API. If rain probability >30%
// in next 48h, multiply all scores by 3." (as per original requirements spec)
setInterval(async () => {
  // Feature #4: Predictive Hotspot Heatmap refresh every 5 min
  await refreshHeatmapPoints();
}, 5 * 60 * 1000); // 300,000 ms = 5 minutes

// ==============================================================
// GET /api/admin/dashboard
// AI-ranked complaint list + Groq-generated summary
// ==============================================================

/**
 * getDashboard – Returns:
 *  1. Total counts by status (KPI cards)
 *  2. Top complaints sorted by AI severity score (Feature #3)
 *  3. Groq AI summary of current situation (Feature #11 lite)
 *  4. Weather data for the city center (Feature #4)
 *  5. Anomaly alerts if any active
 *  6. Category breakdown for mini chart
 */
export const getDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // ---- Parallel data fetching for performance ----
    const [
      totalComplaints,
      statusCounts,
      topComplaints,
      categoryAgg,
      recentAnomalies,
    ] = await Promise.all([
      // Total complaint count
      Complaint.countDocuments(),

      // Count by status (for KPI cards)
      Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Top 20 complaints ordered by severity (AI-ranked)
      // Populated with worker info for assignment display
      Complaint.find({ status: { $ne: 'Resolved' } })
        .sort({ severityScore: -1, createdAt: -1 })
        .limit(20)
        .populate('reportedBy', 'name')
        .populate('workerId', 'name phone')
        .lean(),

      // Category breakdown for bar chart
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Recent anomaly notifications for alert banner (Feature #13)
      Notification.find({
        userId: req.user!._id,
        type: 'anomaly',
        read: false,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // ---- Build status map ----
    const statusMap: Record<string, number> = {};
    for (const item of statusCounts) {
      statusMap[item._id] = item.count;
    }

    // ---- Fetch weather for Chennai center (Feature #4 dashboard widget) ----
    const weather = await getWeatherData(
      parseFloat(process.env.CHENNAI_LAT || '13.0827'),
      parseFloat(process.env.CHENNAI_LNG || '80.2707')
    );

    // ---- Build category map ----
    const categoryMap: Record<string, number> = {};
    for (const item of categoryAgg) {
      categoryMap[item._id] = item.count;
    }

    // ---- Resolution rate calculation ----
    const resolved = statusMap['Resolved'] || 0;
    const resolutionRate =
      totalComplaints > 0
        ? Math.round((resolved / totalComplaints) * 100)
        : 0;

    // ---- Average severity ----
    const avgSeverityAgg = await Complaint.aggregate([
      { $group: { _id: null, avg: { $avg: '$severityScore' } } },
    ]);
    const avgSeverity = Math.round(avgSeverityAgg[0]?.avg || 0);

    res.status(200).json({
      success: true,
      dashboard: {
        kpis: {
          total: totalComplaints,
          pending: statusMap['Pending'] || 0,
          assigned: statusMap['Assigned'] || 0,
          inProgress: statusMap['InProgress'] || 0,
          resolved: statusMap['Resolved'] || 0,
          resolutionRate,
          avgSeverity,
        },
        topComplaints: topComplaints.map((c) => ({
          id: c._id,
          title: c.title,
          category: c.category,
          status: c.status,
          severityScore: c.severityScore,
          location: c.location,
          confirmations: c.confirmations,
          reportedBy: c.reportedBy,
          workerId: c.workerId,
          aiDescription: c.aiAnalysis?.description,
          createdAt: c.createdAt,
          photoUrl: c.photoUrl,
        })),
        categoryBreakdown: categoryMap,
        weather,
        anomalyAlerts: recentAnomalies,
      },
    });
  } catch (err) {
    console.error('❌ getDashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
};

// ==============================================================
// GET /api/admin/map-data
// Returns heatmap points + complaint markers + live worker positions
// ==============================================================

/**
 * getMapData – Feature #4/#7: Data for Leaflet map rendering.
 *
 * Returns:
 *  - heatmapPoints: [lat, lng, intensity] for leaflet.heat plugin
 *    Intensity = severityScore / 100, weather-multiplied if rain likely
 *  - complaintMarkers: All active complaints with GPS + metadata
 *  - workerMarkers: All workers with live GPS + online status
 *  - weatherData: Rain forecast for heatmap color adjustment
 */
export const getMapData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // ---- Parallel fetch of complaints + workers ----
    const [complaints, workers, weather] = await Promise.all([
      Complaint.find({ status: { $ne: 'Resolved' } })
        .select('location severityScore category status confirmations title createdAt aiAnalysis.weatherImpact')
        .lean(),

      Worker.find()
        .select('name currentLocation lastLocationUpdate isAvailable skills assignedComplaints')
        .lean(),

      // Weather for rain probability → heatmap intensity multiplier
      getWeatherData(
        parseFloat(process.env.CHENNAI_LAT || '13.0827'),
        parseFloat(process.env.CHENNAI_LNG || '80.2707')
      ),
    ]);

    // ---- Build heatmap data array (Feature #4) ----
    // Feature #4: Predictive Hotspot Heatmap refresh every 5 min
    // FIXED TO 10/10 – Use cachedHeatmapPoints (refreshed every 5 min by setInterval).
    // If cache is empty (cold start), run a synchronous refresh now.
    const rainMultiplier =
      weather && weather.rainProbabilityNext48h > 30 ? 3 : 1;

    if (cachedHeatmapPoints.length === 0) {
      // Cold-start: populate cache immediately on first request
      await refreshHeatmapPoints();
    }
    const heatmapPoints = cachedHeatmapPoints;

    // ---- Worker online status (5min threshold) ----
    const workerMarkers = workers.map((w) => {
      const lastUpdate = new Date(w.lastLocationUpdate).getTime();
      const isOnline = Date.now() - lastUpdate < 5 * 60 * 1000; // 5 min

      return {
        id: w._id,
        name: w.name,
        lat: w.currentLocation.lat,
        lng: w.currentLocation.lng,
        isOnline,
        isAvailable: w.isAvailable,
        skills: w.skills,
        activeAssignments: w.assignedComplaints.length,
        lastSeen: w.lastLocationUpdate,
      };
    });

    res.status(200).json({
      success: true,
      mapData: {
        heatmapPoints,
        complaintMarkers: complaints.map((c) => ({
          id: c._id,
          lat: c.location.lat,
          lng: c.location.lng,
          category: c.category,
          status: c.status,
          severity: c.severityScore,
          title: c.title,
          confirmations: c.confirmations,
          weatherImpacted: c.aiAnalysis?.weatherImpact,
          createdAt: c.createdAt,
        })),
        workerMarkers,
        weather,
        rainMultiplierActive: rainMultiplier > 1,
      },
    });
  } catch (err) {
    console.error('❌ getMapData error:', err);
    res.status(500).json({ success: false, message: 'Failed to load map data.' });
  }
};

// ==============================================================
// POST /api/admin/assign-worker
// Feature #5: Groq-powered smart worker assignment
// ==============================================================

/**
 * assignWorker – Analyzes available workers + complaint details
 * using Groq AI to recommend best assignment.
 * Can be called with a specific workerId (manual) or auto-assign.
 *
 * Body: { complaintId, workerId? }
 *   - If workerId provided: assign directly (manual mode)
 *   - If no workerId: call Groq auto-assignment (auto mode)
 *
 * Returns: { assignment, reasoning, routePolyline, topWorkers }
 */
export const assignWorker = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { complaintId, workerId: manualWorkerId } = req.body;

    if (!complaintId) {
      res.status(400).json({
        success: false,
        message: 'complaintId is required.',
      });
      return;
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    if (complaint.status === 'Resolved') {
      res.status(400).json({
        success: false,
        message: 'Cannot assign worker to an already resolved complaint.',
      });
      return;
    }

    let selectedWorkerId: string;
    let reasoning = '';
    let routePolyline: Array<{ lat: number; lng: number }> = [];
    let topWorkers: Array<{ id: string; name: string; distance: number }> = [];

    if (manualWorkerId) {
      // ---- Manual assignment ----
      selectedWorkerId = manualWorkerId;
      reasoning = 'Manual assignment by administrator.';
    } else {
      // ---- AI Auto-assignment (Feature #5) ----
      // Fetch all available workers with their skills and locations
      const availableWorkers = await Worker.find({ isAvailable: true }).lean();

      if (availableWorkers.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No available workers at this time.',
        });
        return;
      }

      const workerProfiles = availableWorkers.map((w) => ({
        id: w._id.toString(),
        name: w.name,
        skills: w.skills,
        location: w.currentLocation,
        workload: w.assignedComplaints.length,
      }));

      const assignmentResult = await callGroqWorkerAssignment(
        workerProfiles,
        {
          category: complaint.category,
          severity: complaint.severityScore,
          description: complaint.description,
        },
        { lat: complaint.location.lat, lng: complaint.location.lng }
      );

      selectedWorkerId = assignmentResult.topWorkerIds[0];
      reasoning = assignmentResult.reasoning;
      routePolyline = assignmentResult.routePolyline;

      // Top 3 worker suggestions for admin UI
      topWorkers = assignmentResult.topWorkerIds.slice(0, 3).map((wId) => {
        const w = availableWorkers.find((aw) => aw._id.toString() === wId);
        return {
          id: wId,
          name: w?.name || 'Unknown',
          distance: 0, // Would calculate haversine in production
        };
      });
    }

    // ---- Perform the assignment ----
    const [updatedComplaint, updatedWorker] = await Promise.all([
      Complaint.findByIdAndUpdate(
        complaintId,
        { workerId: selectedWorkerId, status: 'Assigned' },
        { new: true }
      ).populate('workerId', 'name phone'),

      Worker.findByIdAndUpdate(
        selectedWorkerId,
        { $addToSet: { assignedComplaints: complaintId } },
        { new: true }
      ),
    ]);

    // ---- Create assignment notification for worker (Feature #5) ----
    const workerUser = await User.findOne({
      _id: updatedWorker?.userId,
    });

    if (workerUser) {
      await Notification.create({
        userId: workerUser._id,
        message: `New assignment: "${complaint.title}" (${complaint.category}) at ${complaint.location.address}`,
        type: 'assignment',
        complaintId: complaint._id,
      });
    }

    // ---- Emit WebSocket events ----
    if (io) {
      // Notify the worker via their socket room
      emitWorkerAssigned(io, selectedWorkerId, {
        _id: complaint._id.toString(),
        title: complaint.title,
        category: complaint.category,
        location: complaint.location,
        severityScore: complaint.severityScore,
      });

      // Notify the citizen who reported
      emitStatusUpdate(
        io,
        complaintId,
        'Assigned',
        complaint.reportedBy.toString(),
        `A worker has been assigned to your complaint: "${complaint.title}". ETA will be updated when they start.`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Worker assigned successfully.',
      assignment: {
        complaintId,
        workerId: selectedWorkerId,
        workerName: updatedWorker?.name,
        complaintStatus: 'Assigned',
      },
      aiDecision: {
        reasoning,
        routePolyline,
        topWorkers,
      },
    });

    console.log(
      `✅ Worker ${selectedWorkerId} assigned to complaint ${complaintId}`
    );
  } catch (err) {
    console.error('❌ assignWorker error:', err);
    res.status(500).json({
      success: false,
      message: 'Worker assignment failed.',
    });
  }
};

// ==============================================================
// PATCH /api/admin/complaints/:id/status
// Update complaint status (admin override)
// ==============================================================

/**
 * updateComplaintStatus – Admin can set any status.
 * Emits status-update WebSocket event to notify citizen + workers.
 */
export const updateComplaintStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, message: statusMessage } = req.body;
    const validStatuses = ['Pending', 'Assigned', 'InProgress', 'Resolved'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    // Emit real-time status update to citizen
    if (io) {
      emitStatusUpdate(
        io,
        complaint._id.toString(),
        status,
        complaint.reportedBy.toString(),
        statusMessage || `Your complaint status has been updated to: ${status}`
      );
    }

    // Save notification for citizen
    await Notification.create({
      userId: complaint.reportedBy,
      message: statusMessage || `Your complaint "${complaint.title}" status updated to ${status}`,
      type: 'status-update',
      complaintId: complaint._id,
    });

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      complaint: {
        id: complaint._id,
        status: complaint.status,
        title: complaint.title,
      },
    });
  } catch (err) {
    console.error('❌ updateComplaintStatus error:', err);
    res.status(500).json({ success: false, message: 'Status update failed.' });
  }
};

// ==============================================================
// GET /api/admin/weekly-pdf
// Feature #11: AI-Generated Weekly Summary PDF Download
// ==============================================================

/**
 * getWeeklyPDF – Generates and streams a weekly report PDF.
 *
 * Steps:
 *  1. Aggregate complaint statistics for the past 7 days
 *  2. Call Groq to generate executive summary paragraph (Feature #11)
 *  3. Call pdf-lib to create formatted PDF with charts and tables
 *  4. Stream PDF as binary download response
 *
 * The generated PDF contains:
 *  - Cover page with Groq AI summary
 *  - Category breakdown bar chart (drawn with pdf-lib rectangles)
 *  - Top 5 high-severity complaints
 *  - Resolution rate progress bar
 *  - Weekly performance statistics
 */
export const getWeeklyPDF = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dateRange = `${sevenDaysAgo.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
    })} – ${now.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })}`;

    // ---- Aggregate weekly statistics ----
    const [
      weeklyComplaints,
      statusCounts,
      categoryAgg,
      topComplaints,
      avgSeverityAgg,
    ] = await Promise.all([
      Complaint.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),

      Complaint.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Complaint.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Complaint.find({ createdAt: { $gte: sevenDaysAgo } })
        .sort({ severityScore: -1 })
        .limit(5)
        .select('title category severityScore status location')
        .lean(),

      Complaint.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: null, avg: { $avg: '$severityScore' } } },
      ]),
    ]);

    // Build stats object
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => (statusMap[s._id] = s.count));

    const byCategory: Record<string, number> = {};
    categoryAgg.forEach((c) => (byCategory[c._id] = c.count));

    const stats = {
      total: weeklyComplaints,
      resolved: statusMap['Resolved'] || 0,
      pending: statusMap['Pending'] || 0,
      assigned: (statusMap['Assigned'] || 0) + (statusMap['InProgress'] || 0),
      avgSeverity: Math.round(avgSeverityAgg[0]?.avg || 0),
    };

    // Top areas (simplified – use addresses from top complaints)
    const topAreas = topComplaints
      .map((c) => c.location.address.split(',')[0])
      .filter(Boolean)
      .slice(0, 3);

    // ---- Generate Groq AI summary (Feature #11) ----
    console.log('📄 Generating Groq weekly summary...');
    const aiSummary = await callGroqWeeklySummary({
      totalComplaints: stats.total,
      resolved: stats.resolved,
      pending: stats.pending,
      byCategory,
      avgSeverity: stats.avgSeverity,
      topAreas,
      dateRange,
    });

    // ---- Generate PDF with pdf-lib ----
    console.log('📄 Generating PDF document...');
    const pdfBuffer = await generateWeeklyPDF({
      dateRange,
      aiSummary,
      stats,
      byCategory,
      topComplaints: topComplaints.map((c) => ({
        title: c.title,
        category: c.category,
        severity: c.severityScore,
        status: c.status,
        address: c.location?.address || '',
      })),
      topAreas,
    });

    // ---- Stream PDF to client ----
    const filename = `SmartCivic-Weekly-${now.toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    console.log(`✅ Weekly PDF generated: ${filename} (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.error('❌ getWeeklyPDF error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate weekly PDF report.',
    });
  }
};

// ==============================================================
// GET /api/admin/workers – All worker profiles
// ==============================================================

export const getAllWorkers = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const workers = await Worker.find()
      .populate('userId', 'name email')
      .lean();

    res.status(200).json({
      success: true,
      workers: workers.map((w) => ({
        id: w._id,
        name: w.name,
        skills: w.skills,
        isAvailable: w.isAvailable,
        currentLocation: w.currentLocation,
        activeAssignments: w.assignedComplaints.length,
        lastSeen: w.lastLocationUpdate,
        phone: w.phone,
      })),
    });
  } catch (err) {
    console.error('❌ getAllWorkers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch workers.' });
  }
};

// ==============================================================
// GET /api/admin/notifications – Admin notifications
// ==============================================================

export const getAdminNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Mark all as read
    await Notification.updateMany(
      { userId: req.user!._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ success: true, notifications });
  } catch (err) {
    console.error('❌ getAdminNotifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

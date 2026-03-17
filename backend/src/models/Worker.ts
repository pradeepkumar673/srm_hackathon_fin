/**
 * =============================================================
 * src/models/Worker.ts – Field Worker Model
 * =============================================================
 * Represents a municipal field worker entity (separate from User).
 * A Worker document is linked to a User document with role="worker".
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #5: skills array used by Groq for intelligent matching
 *  - Feature #7: currentLocation updated in real-time via Socket.io
 *    (Worker emits "worker-location" every 5s → stored here)
 *  - lastLocationUpdate: used to detect stale/offline workers
 *  - assignedComplaints: array for workload balancing in Feature #5
 * =============================================================
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IWorker extends Document {
  _id: mongoose.Types.ObjectId;
  // userId: links to User document (role="worker") for auth + profile
  userId: mongoose.Types.ObjectId;
  name: string;
  // skills: used by Feature #5 Smart Worker Assignment
  // Groq analyzes complaint category + worker skills to find best match
  // Valid skills: plumber (water leakage), electrician (street lights),
  //               road-worker (potholes, road damage), sanitation (garbage)
  skills: ('plumber' | 'electrician' | 'road-worker' | 'sanitation')[];
  // currentLocation: updated every 5 seconds by Feature #7 WebSocket
  // Used for haversine distance calculation in smart assignment (Feature #5)
  // and rendered as live moving icon on admin Leaflet map
  currentLocation: {
    lat: number;
    lng: number;
  };
  // assignedComplaints: workload indicator for Feature #5
  // Groq uses count of assignedComplaints in prompt to balance assignments
  assignedComplaints: mongoose.Types.ObjectId[];
  // lastLocationUpdate: timestamp of last GPS ping from worker's device
  // Admin UI shows "Offline" badge if >5 minutes stale
  lastLocationUpdate: Date;
  // isAvailable: manual toggle + auto-set false when resolving an issue
  isAvailable: boolean;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Skills array – must match at least one for assignment eligibility
    skills: {
      type: [String],
      enum: ['plumber', 'electrician', 'road-worker', 'sanitation'],
      default: [],
    },

    currentLocation: {
      lat: { type: Number, default: 13.0827 },
      lng: { type: Number, default: 80.2707 },
    },

    // Array of complaint ObjectIds currently assigned to this worker
    assignedComplaints: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }],

    // ISO timestamp – used to detect offline workers (Feature #7)
    lastLocationUpdate: {
      type: Date,
      default: Date.now,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    phone: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Index for geospatial proximity queries (Feature #5)
WorkerSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 });
// Index for available workers only
WorkerSchema.index({ isAvailable: 1 });

const Worker: Model<IWorker> = mongoose.model<IWorker>('Worker', WorkerSchema);
export default Worker;


/**
 * =============================================================
 * Notification Model
 * =============================================================
 * Persists in-app notifications for all user roles.
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #9: "A nearby issue was confirmed by community"
 *  - Feature #13: Anomaly alerts pushed to admin notifications
 *  - Feature #7: Status change notifications to citizens
 *  - Feature #5: Worker assignment notification
 * Types: 'assignment' | 'status-update' | 'confirmation' | 'anomaly' |
 *        'resolution' | 'chat' | 'general'
 * =============================================================
 */

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;       // Recipient user
  message: string;                        // Human-readable message
  type: 'assignment' | 'status-update' | 'confirmation' | 'anomaly' | 'resolution' | 'chat' | 'general';
  read: boolean;                          // Mark as read on fetch
  complaintId?: mongoose.Types.ObjectId; // Related complaint (if any)
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    message: {
      type: String,
      required: true,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: ['assignment', 'status-update', 'confirmation', 'anomaly', 'resolution', 'chat', 'general'],
      default: 'general',
    },

    // read: false by default; set to true when user views notification panel
    read: {
      type: Boolean,
      default: false,
    },

    complaintId: {
      type: Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Index for unread notifications per user (badge count query)
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

/**
 * =============================================================
 * src/models/User.ts – User Mongoose Model
 * =============================================================
 * Defines the User schema for citizens, admins, and workers.
 * Used by: authController (register/login), complaint confirmations,
 *          gamification (civicPoints), multilingual support (language).
 *
 * FEATURES IMPLEMENTED:
 *  - Role-based access: "citizen" | "admin" | "worker"
 *  - Real-time GPS location stored for proximity queries (Feature #7)
 *  - civicPoints gamification (Feature #9 – community validation)
 *  - Language preference for multilingual AI responses (Feature #10)
 *  - Password hashing via bcryptjs (comparePassword instance method)
 *  - Timestamps auto-managed by Mongoose
 * =============================================================
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// ---- TypeScript interface for type safety ----
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: 'citizen' | 'admin' | 'worker';
  // currentLocation: used for Feature #7 (real-time tracking) and
  // Feature #5 (smart worker assignment – haversine distance calculation)
  currentLocation: {
    lat: number;
    lng: number;
  };
  // civicPoints: Feature #9 – earned by confirming nearby issues
  // shown in public leaderboard route GET /api/leaderboard
  civicPoints: number;
  // language: Feature #10 – determines which language Groq responds in
  language: 'en' | 'ta';
  createdAt: Date;
  updatedAt: Date;
  // Instance method: compare plain-text password against stored hash
  comparePassword(plain: string): Promise<boolean>;
}

// ---- Schema Definition ----
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      // Basic email format validation
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      // Never select password hash in queries by default (security)
      select: false,
    },

    // role: drives middleware authorization checks.
    // "citizen"  – can report, view own complaints, confirm others
    // "admin"    – full dashboard, assign workers, generate PDF
    // "worker"   – accept tasks, update location, resolve issues
    role: {
      type: String,
      enum: ['citizen', 'admin', 'worker'],
      default: 'citizen',
    },

    // currentLocation: GPS coordinates updated by:
    //   Citizens – on login / location permission grant
    //   Workers  – every 5s via socket (Feature #7 real-time tracking)
    currentLocation: {
      lat: { type: Number, default: 13.0827 }, // Default: Chennai center
      lng: { type: Number, default: 80.2707 },
    },

    // civicPoints: incremented +10 each time the user confirms a
    // nearby issue via the community validation socket event (Feature #9)
    civicPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    // language: "en" = English, "ta" = Tamil (Groq translation Feature #10)
    language: {
      type: String,
      enum: ['en', 'ta'],
      default: 'en',
    },
  },
  {
    // Mongoose auto-manages createdAt and updatedAt timestamps
    timestamps: true,
    // toJSON: remove __v and ensure id instead of _id in responses
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete (ret as any).__v;
        delete (ret as any).passwordHash; // Never expose hash in JSON output
        return ret;
      },
    },
  }
);

// ---- Indexes ----
// Unique index on email (already enforced by unique:true above)
// Additional index on role for admin queries filtering by role
UserSchema.index({ role: 1 });
// Index for leaderboard sort (Feature #9 GET /api/leaderboard)
UserSchema.index({ civicPoints: -1 });

// ---- Instance Method: comparePassword ----
// Used in authController.login to verify submitted password
// against the bcrypt hash stored in DB.
UserSchema.methods.comparePassword = async function (
  plain: string
): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

// ---- Pre-save Hook: Hash password before storing ----
// Only re-hashes if passwordHash field is modified (avoids re-hashing on unrelated saves)
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const saltRounds = 12; // bcrypt cost factor – higher = more secure but slower
  this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
  next();
});

// ---- Model Export ----
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;

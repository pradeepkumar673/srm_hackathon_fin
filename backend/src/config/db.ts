/**
 * =============================================================
 * src/config/db.ts – MongoDB Connection Manager
 * =============================================================
 * Establishes and monitors MongoDB connection using Mongoose 8.5.
 * Implements reconnection logic and emits connection events.
 * Used by: src/index.ts on server startup.
 * =============================================================
 */

import mongoose from 'mongoose';

/**
 * connectDB – Opens a Mongoose connection to MongoDB.
 * Reads MONGODB_URI from environment variables.
 * Uses recommended connection options for production stability:
 *   - serverSelectionTimeoutMS: how long to wait for server
 *   - socketTimeoutMS: idle socket timeout
 * Registers event listeners for connected/disconnected/error.
 */
export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    // mongoose.connect returns the Mongoose instance; await ensures
    // the initial handshake completes before the server starts accepting requests.
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,  // Fail fast if DB unreachable
      socketTimeoutMS: 45000,          // Close idle sockets after 45s
    });

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

    // ---- Connection event listeners ----

    // Fires when a previously connected connection reconnects.
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Fires when connection drops. Mongoose will auto-reconnect.
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected – attempting reconnect...');
    });

    // Fires on connection errors after initial connect.
    mongoose.connection.on('error', (err: Error) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ MongoDB initial connection failed: ${message}`);
    // Exit process so PM2 / Docker can restart cleanly.
    process.exit(1);
  }
};

/**
 * disconnectDB – Gracefully closes the Mongoose connection.
 * Called during SIGTERM/SIGINT handlers in index.ts.
 */
export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed');
};

import mongoose from "mongoose";
import { env } from "../config/env.js";

/**
 * Single MongoDB connection utility.
 *
 * - One connection is shared by the whole process (Better Auth reuses it).
 * - Connection events are registered once.
 * - Concurrent start-up calls share the same in-flight promise.
 */
mongoose.set("strictQuery", true);

let listenersRegistered = false;
let connecting: Promise<void> | null = null;

function registerListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
  mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("⚠️ MongoDB disconnected"));
}

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (connecting) return connecting;

  registerListeners();

  connecting = (async () => {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
    });
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}

/** Better Auth expects a native MongoDB Db handle. */
export function getNativeDb(): mongoose.mongo.Db {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected");
  return db;
}

export const mongooseInstance = mongoose;

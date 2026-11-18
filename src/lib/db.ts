import mongoose from "mongoose";
import { env } from "../config/env.js";

mongoose.set("strictQuery", true);

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;
  mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
  mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("⚠️ MongoDB disconnected"));

  await mongoose.connect(env.MONGODB_URI, { dbName: "pizzahub" });
  connected = true;
}

export async function disconnectDB(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export const mongooseInstance = mongoose;

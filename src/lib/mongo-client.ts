import mongoose from "mongoose";
import { env } from "../config/env.js";

const { MongoClient } = mongoose.mongo;

/**
 * Dedicated native MongoDB client for Better Auth using Mongoose's bundled
 * MongoDB driver to ensure 100% zero-dependency serverless compatibility on Vercel.
 */
export const mongoClient = new MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10_000,
  maxPoolSize: 10,
});

export const authDb = mongoClient.db(env.MONGODB_DB_NAME);

let isConnected = false;

export async function connectMongoClient(): Promise<void> {
  if (isConnected) return;
  try {
    await mongoClient.connect();
    isConnected = true;
  } catch (err) {
    console.error("Failed to connect MongoClient for Better Auth:", err);
  }
}
